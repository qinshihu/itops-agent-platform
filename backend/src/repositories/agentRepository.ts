/**
 * agentRepository — agents 表的统一数据访问层
 *
 * 取代 agentRoutes.ts / agentExecutor.ts / copilotService.ts /
 *       llmService/index.ts / agentToolRegistry.ts / dashboardRoutes.ts /
 *       aiModelService.ts 等散落的 db.prepare 调用。
 *
 * agents 表结构（v001 + v002 + v004）：
 *   id, name, avatar, role, system_prompt, model(DEFAULT 'doubao-4o'),
 *   temperature(DEFAULT 0.7), enabled(DEFAULT 1), is_preset(DEFAULT 0),
 *   category, tags, description, usage_count(DEFAULT 0), last_used_at,
 *   created_at, updated_at,
 *   api_provider(DEFAULT 'doubao'), primary_model_id, fallback_model_id
 *
 * 注意：agent_tools 表不存在；工具注册在内存 AgentToolRegistry 中，不在此仓库范围内。
 */

import db from '../models/database';

// ── 类型定义 ──

export interface AgentRecord {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string | null;
  system_prompt?: string | null;
  model?: string | null;
  temperature: number;
  enabled: number;
  is_preset: number;
  category?: string | null;
  tags?: string | null;
  description?: string | null;
  usage_count: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
  api_provider?: string | null;
  primary_model_id?: string | null;
  fallback_model_id?: string | null;
}

/** 含模型名称的联表记录（list/getByIdWithModels 返回） */
export interface AgentWithModelNames extends AgentRecord {
  primary_model_name?: string | null;
  fallback_model_name?: string | null;
}

/** 列表过滤条件 */
export interface AgentListFilters {
  category?: string;
  enabled?: number;
  search?: string;
}

/** 创建 Agent 输入 */
export interface AgentCreateInput {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string | null;
  system_prompt?: string | null;
  model?: string | null;
  temperature?: number;
  enabled?: number;
  is_preset?: number;
  category?: string | null;
  tags?: string | null;
  description?: string | null;
  api_provider?: string | null;
  primary_model_id?: string | null;
  fallback_model_id?: string | null;
}

/** 更新 Agent 输入（动态 SET） */
export interface AgentUpdateInput {
  name?: string;
  avatar?: string | null;
  role?: string | null;
  system_prompt?: string | null;
  model?: string | null;
  temperature?: number;
  enabled?: number;
  category?: string | null;
  tags?: string | null;
  description?: string | null;
  api_provider?: string | null;
  primary_model_id?: string | null;
  fallback_model_id?: string | null;
}

/** LLM 执行所需字段 */
export interface AgentLlmConfig {
  id: string;
  name: string;
  system_prompt: string | null;
  temperature: number;
  model: string | null;
  api_provider: string | null;
  primary_model_id: string | null;
  fallback_model_id: string | null;
}

// ── repository 实现 ──

export const agentRepository = {
  // ── SELECT：列表 ──

  /**
   * 列出 Agent（含模型名称联表，支持动态过滤）
   * 对应 agentRoutes.ts S1
   */
  list(filters?: AgentListFilters): AgentWithModelNames[] {
    let sql = `
      SELECT a.*, pm.name as primary_model_name, fm.name as fallback_model_name
      FROM agents a
      LEFT JOIN ai_models pm ON a.primary_model_id = pm.id
      LEFT JOIN ai_models fm ON a.fallback_model_id = fm.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters?.category) {
      sql += ' AND a.category = ?';
      params.push(filters.category);
    }
    if (filters?.enabled !== undefined) {
      sql += ' AND a.enabled = ?';
      params.push(filters.enabled);
    }
    if (filters?.search) {
      sql += ' AND (a.name LIKE ? OR a.role LIKE ? OR a.description LIKE ?)';
      const pattern = `%${filters.search}%`;
      params.push(pattern, pattern, pattern);
    }
    sql += ' ORDER BY a.is_preset DESC, a.usage_count DESC, a.created_at DESC';
    return db.prepare(sql).all(...params) as AgentWithModelNames[];
  },

  // ── SELECT：单条查询 ──

  /**
   * 按 id 获取完整记录（无联表）
   * 对应 agentRoutes.ts S3
   */
  getById(id: string): AgentRecord | undefined {
    return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRecord | undefined;
  },

  /**
   * 按 id 获取完整记录 + 模型名称
   * 对应 agentRoutes.ts S2
   */
  getByIdWithModels(id: string): AgentWithModelNames | undefined {
    return db.prepare(`
      SELECT a.*, pm.name as primary_model_name, fm.name as fallback_model_name
      FROM agents a
      LEFT JOIN ai_models pm ON a.primary_model_id = pm.id
      LEFT JOIN ai_models fm ON a.fallback_model_id = fm.id
      WHERE a.id = ?
    `).get(id) as AgentWithModelNames | undefined;
  },

  /**
   * 按 id 获取 name/role/category（测试推荐用）
   * 对应 agentRoutes.ts S4
   */
  getNameRoleCategory(id: string): { name: string; role: string | null; category: string | null } | undefined {
    return db.prepare('SELECT name, role, category FROM agents WHERE id = ?')
      .get(id) as { name: string; role: string | null; category: string | null } | undefined;
  },

  /**
   * 按 id 获取 id/name/system_prompt（agentExecutor 用）
   * 对应 agentExecutor.ts S5
   */
  getNamePrompt(id: string): { id: string; name: string; system_prompt: string | null } | undefined {
    return db.prepare('SELECT id, name, system_prompt FROM agents WHERE id = ?')
      .get(id) as { id: string; name: string; system_prompt: string | null } | undefined;
  },

  /**
   * 按 id 获取 LLM 执行配置（8 字段）
   * 对应 llmService/index.ts S6
   */
  getLlmConfig(id: string): AgentLlmConfig | undefined {
    return db.prepare(`
      SELECT id, name, system_prompt, temperature, model, api_provider, primary_model_id, fallback_model_id
      FROM agents WHERE id = ?
    `).get(id) as AgentLlmConfig | undefined;
  },

  /**
   * 按 name 获取 id（预设初始化用）
   * 对应 presets/initWorkflows.ts S14
   */
  getIdByName(name: string): string | undefined {
    const row = db.prepare('SELECT id FROM agents WHERE name = ?').get(name) as { id: string } | undefined;
    return row?.id;
  },

  // ── SELECT：统计 ──

  /**
   * 统计 Agent 总数
   * 对应 agentRoutes.ts S7
   */
  countAll(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    return row.count;
  },

  /**
   * 统计启用 Agent 数
   * 对应 agentRoutes.ts S8
   */
  countEnabled(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM agents WHERE enabled = 1').get() as { count: number };
    return row.count;
  },

  /**
   * 统计预设 Agent 数
   * 对应 agentRoutes.ts S9 / database.ts
   */
  countPreset(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM agents WHERE is_preset = 1').get() as { count: number };
    return row.count;
  },

  /**
   * 仪表盘统计：总数 + 启用数
   * 对应 dashboardRoutes.ts S11
   */
  getStats(): { total: number; enabled: number } {
    const row = db.prepare('SELECT COUNT(*) as total, SUM(enabled) as enabled FROM agents')
      .get() as { total: number; enabled: number | null };
    return { total: row.total, enabled: row.enabled ?? 0 };
  },

  /**
   * 按分类统计 Agent 数
   * 对应 agentRoutes.ts S10
   */
  countByCategory(): Array<{ category: string; count: number }> {
    return db.prepare(`
      SELECT category, COUNT(*) as count
      FROM agents
      WHERE category IS NOT NULL
      GROUP BY category
    `).all() as Array<{ category: string; count: number }>;
  },

  /**
   * 统计使用指定主模型的 Agent 数（删除模型时引用检查）
   * 对应 aiModelService.ts S12
   */
  countByPrimaryModelId(modelId: string): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM agents WHERE primary_model_id = ?')
      .get(modelId) as { count: number };
    return row.count;
  },

  /**
   * 统计使用指定备用模型的 Agent 数
   * 对应 aiModelService.ts S13
   */
  countByFallbackModelId(modelId: string): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM agents WHERE fallback_model_id = ?')
      .get(modelId) as { count: number };
    return row.count;
  },

  // ── INSERT ──

  /**
   * 创建 Agent（15 字段完整 INSERT）
   * 对应 agentRoutes.ts I1
   */
  create(input: AgentCreateInput): void {
    db.prepare(`
      INSERT INTO agents (id, name, avatar, role, system_prompt, model, temperature,
        enabled, is_preset, category, tags, description, api_provider, primary_model_id, fallback_model_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.avatar ?? null,
      input.role ?? null,
      input.system_prompt ?? null,
      input.model ?? 'doubao-4o',
      input.temperature ?? 0.7,
      input.enabled ?? 1,
      input.is_preset ?? 0,
      input.category ?? null,
      input.tags ?? null,
      input.description ?? null,
      input.api_provider ?? 'doubao',
      input.primary_model_id ?? null,
      input.fallback_model_id ?? null
    );
  },

  // ── UPDATE ──

  /**
   * 动态更新 Agent 字段（构建 SET 子句）
   * 对应 agentRoutes.ts U1（原为固定字段，这里改为动态以支持部分更新）
   */
  update(id: string, fields: AgentUpdateInput): number {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) { setClauses.push('name = ?'); values.push(fields.name); }
    if (fields.avatar !== undefined) { setClauses.push('avatar = ?'); values.push(fields.avatar); }
    if (fields.role !== undefined) { setClauses.push('role = ?'); values.push(fields.role); }
    if (fields.system_prompt !== undefined) { setClauses.push('system_prompt = ?'); values.push(fields.system_prompt); }
    if (fields.model !== undefined) { setClauses.push('model = ?'); values.push(fields.model); }
    if (fields.temperature !== undefined) { setClauses.push('temperature = ?'); values.push(fields.temperature); }
    if (fields.enabled !== undefined) { setClauses.push('enabled = ?'); values.push(fields.enabled); }
    if (fields.category !== undefined) { setClauses.push('category = ?'); values.push(fields.category); }
    if (fields.tags !== undefined) { setClauses.push('tags = ?'); values.push(fields.tags); }
    if (fields.description !== undefined) { setClauses.push('description = ?'); values.push(fields.description); }
    if (fields.api_provider !== undefined) { setClauses.push('api_provider = ?'); values.push(fields.api_provider); }
    if (fields.primary_model_id !== undefined) { setClauses.push('primary_model_id = ?'); values.push(fields.primary_model_id); }
    if (fields.fallback_model_id !== undefined) { setClauses.push('fallback_model_id = ?'); values.push(fields.fallback_model_id); }

    if (setClauses.length === 0) return 0;

    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);

    const result = db.prepare(`UPDATE agents SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return (result as { changes: number }).changes;
  },

  /**
   * 增加使用统计（usage_count + 1, last_used_at + updated_at）
   * 对应 agentRoutes.ts U2 / providerAdapters.ts U3
   */
  incrementUsageStats(id: string): void {
    db.prepare(`
      UPDATE agents
      SET usage_count = usage_count + 1,
          last_used_at = datetime('now','localtime'),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(id);
  },

  /**
   * 更新所有预设 Agent 的模型字段（settingsRoutes.ts 的 API key 配置联动用）
   */
  updatePresetModel(model: string): number {
    const result = db.prepare(`
      UPDATE agents
      SET model = ?, updated_at = datetime('now','localtime')
      WHERE is_preset = 1
    `).run(model);
    return (result as { changes: number }).changes;
  },

  /**
   * 清空所有预设 Agent 的模型字段
   */
  clearPresetModel(): number {
    const result = db.prepare(`
      UPDATE agents
      SET model = NULL, updated_at = datetime('now','localtime')
      WHERE is_preset = 1
    `).run();
    return (result as { changes: number }).changes;
  },

  // ── DELETE ──

  /**
   * 按 id 删除 Agent
   * 对应 agentRoutes.ts D1
   */
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return (result as { changes: number }).changes > 0;
  },
};
