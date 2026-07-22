import db from '../../models/database';
import type { WorkflowRecord, WorkflowCreateInput, WorkflowUpdateInput } from './types';

// ── workflows 子 repository ──

export const workflowsRepo = {
  /**
   * 列出全部工作流（模板优先，再按创建时间倒序）
   * 对应 workflowRoutes.ts W-SELECT-1
   */
  list(): WorkflowRecord[] {
    return db.prepare('SELECT * FROM workflows ORDER BY is_template DESC, created_at DESC').all() as WorkflowRecord[];
  },

  /**
   * MCP 工具查询（支持 status 过滤 + limit）
   * 对应：toolDefinitions workflow.list
   */
  listWithFilters(filters: { status?: string; limit?: number }): WorkflowRecord[] {
    let query = 'SELECT id, name, description, status, trigger_type, created_at, updated_at FROM workflows WHERE 1=1';
    const params: unknown[] = [];
    if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }
    query += ` LIMIT ${filters.limit || 20}`;
    return db.prepare(query).all(...params) as WorkflowRecord[];
  },

  /**
   * 按 id 获取完整工作流
   * 对应 workflowRoutes.ts W-SELECT-2
   */
  getById(id: string): WorkflowRecord | undefined {
    return db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRecord | undefined;
  },

  /**
   * 按 id 检查是否存在
   * 对应 scheduledTaskRoutes.ts W-SELECT-3 / alertMappingRoutes.ts
   */
  existsById(id: string): boolean {
    const row = db.prepare('SELECT id FROM workflows WHERE id = ?').get(id);
    return !!row;
  },

  /**
   * 列出模板工作流的 id/name（预设初始化用）
   * 对应 presets/linkRemediationWorkflows.ts W-SELECT-4 / initAlertMappings.ts
   */
  listTemplates(): Array<{ id: string; name: string }> {
    return db.prepare('SELECT id, name FROM workflows WHERE is_template = 1')
      .all() as Array<{ id: string; name: string }>;
  },

  /**
   * 获取第一个模板 id（按 id 排序）
   * 对应 AlertProcessor.ts W-SELECT-5
   */
  getFirstTemplateId(): string | undefined {
    const row = db.prepare('SELECT id FROM workflows WHERE is_template = 1 ORDER BY id LIMIT 1')
      .get() as { id: string } | undefined;
    return row?.id;
  },

  /**
   * 获取第一个模板 id（无排序）
   * 对应 presets/initRemediationPolicies.ts W-SELECT-6
   */
  getAnyTemplateId(): string | undefined {
    const row = db.prepare('SELECT id FROM workflows WHERE is_template = 1 LIMIT 1')
      .get() as { id: string } | undefined;
    return row?.id;
  },

  /**
   * 按名称关键词模糊匹配模板 id
   * 对应 presets/initRemediationPolicies.ts W-SELECT-7
   */
  findTemplateIdByNameKeywords(pattern: string): string | undefined {
    const row = db.prepare(`SELECT id FROM workflows WHERE is_template = 1 AND (${pattern}) LIMIT 1`)
      .get() as { id: string } | undefined;
    return row?.id;
  },

  /**
   * 统计工作流总数和模板数
   * 对应 dashboardRoutes.ts W-SELECT-8
   */
  countWithTemplates(): { total: number; templates: number } {
    const row = db.prepare('SELECT COUNT(*) as total, SUM(is_template) as templates FROM workflows')
      .get() as { total: number; templates: number | null };
    return { total: row.total, templates: row.templates ?? 0 };
  },

  /**
   * 统计模板数
   * 对应 models/database.ts W-SELECT-9
   */
  countTemplates(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM workflows WHERE is_template = 1')
      .get() as { count: number };
    return row.count;
  },

  /**
   * 创建工作流（7 字段）
   * 对应 workflowRoutes.ts W-INSERT-1
   */
  create(input: WorkflowCreateInput): void {
    db.prepare(`
      INSERT INTO workflows (id, name, description, nodes, edges, agent_configs, is_template)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.description ?? null,
      input.nodes ?? null,
      input.edges ?? null,
      input.agent_configs ?? null,
      input.is_template ?? 0
    );
  },

  /**
   * 创建工作流（含 created_at/updated_at，9 字段，命名参数）
   * 对应 aiRemediationService.ts W-INSERT-3
   */
  createWithTimestamps(input: WorkflowCreateInput & { created_at: string; updated_at: string }): void {
    db.prepare(`
      INSERT INTO workflows (id, name, description, nodes, edges, agent_configs, is_template, created_at, updated_at)
      VALUES (@id, @name, @description, @nodes, @edges, @agent_configs, @is_template, @created_at, @updated_at)
    `).run(input);
  },

  /**
   * 创建预设工作流（6 字段，无 agent_configs）
   * 对应 presets/initWorkflows.ts W-INSERT-4
   */
  createPreset(input: {
    id: string; name: string; description?: string | null; nodes?: string | null; edges?: string | null; is_template: number;
  }): void {
    db.prepare(`
      INSERT INTO workflows (id, name, description, nodes, edges, is_template)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.description ?? null,
      input.nodes ?? null,
      input.edges ?? null,
      input.is_template
    );
  },

  /**
   * 更新工作流（固定 6 字段 + updated_at）
   * 对应 workflowRoutes.ts W-UPDATE-1
   */
  update(id: string, input: WorkflowUpdateInput): number {
    const result = db.prepare(`
      UPDATE workflows
      SET name = ?, description = ?, nodes = ?, edges = ?, agent_configs = ?,
          is_template = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.name,
      input.description ?? null,
      input.nodes ?? null,
      input.edges ?? null,
      input.agent_configs ?? null,
      input.is_template,
      id
    );
    return (result as { changes: number }).changes;
  },

  /**
   * 按 id 删除工作流
   * 对应 workflowRoutes.ts W-DELETE-1
   */
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    return (result as { changes: number }).changes > 0;
  },
};
