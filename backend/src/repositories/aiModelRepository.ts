/**
 * aiModelRepository — ai_models 表的统一数据访问层
 *
 * 取代 aiModelService.ts 中散落的 db.prepare 调用。
 *
 * ai_models 表结构（v003）：
 *   id, name, provider_type, api_key, api_base, model_id,
 *   enabled, sort_order, is_default, tags(JSON),
 *   last_test_status, last_test_time, created_at, updated_at
 */

import db from '../models/database';

// ── 类型定义 ──

export interface AIModelRecord {
  id: string;
  name: string;
  provider_type: string;
  api_key?: string | null;
  api_base?: string | null;
  model_id: string;
  enabled: number;
  sort_order: number;
  is_default: number;
  tags?: string | null;
  last_test_status?: string | null;
  last_test_time?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIModelCreateInput {
  id: string;
  name: string;
  provider_type: string;
  api_key?: string | null;
  api_base?: string | null;
  model_id: string;
  enabled: number;
  sort_order: number;
  is_default: number;
  tags?: string | null;
}

export interface AIModelUpdateInput {
  name?: string;
  provider_type?: string;
  api_key?: string | null;
  api_base?: string | null;
  model_id?: string;
  enabled?: number;
  is_default?: number;
  tags?: string | null;
}

// ── repository 实现 ──

export const aiModelRepository = {
  /** 获取所有模型（按 sort_order + created_at 排序） */
  listAll(): AIModelRecord[] {
    return db.prepare('SELECT * FROM ai_models ORDER BY sort_order ASC, created_at ASC').all() as AIModelRecord[];
  },

  /** 获取所有启用的模型 */
  listEnabled(): AIModelRecord[] {
    return db.prepare(
      'SELECT * FROM ai_models WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC'
    ).all() as AIModelRecord[];
  },

  /** 按 id 获取单个模型 */
  getById(id: string): AIModelRecord | undefined {
    return db.prepare('SELECT * FROM ai_models WHERE id = ?').get(id) as AIModelRecord | undefined;
  },

  /** 获取默认模型（启用 + is_default=1，或兜底第一个启用） */
  getDefault(): AIModelRecord | undefined {
    const defaultModel = db.prepare(
      'SELECT * FROM ai_models WHERE enabled = 1 AND is_default = 1 ORDER BY sort_order ASC LIMIT 1'
    ).get() as AIModelRecord | undefined;
    if (defaultModel) return defaultModel;

    return db.prepare(
      'SELECT * FROM ai_models WHERE enabled = 1 ORDER BY sort_order ASC LIMIT 1'
    ).get() as AIModelRecord | undefined;
  },

  /** 获取最大 sort_order */
  getMaxSortOrder(): number {
    const row = db.prepare('SELECT MAX(sort_order) as max_order FROM ai_models').get() as { max_order: number | null };
    return row?.max_order ?? -1;
  },

  /** 创建模型 */
  create(input: AIModelCreateInput): void {
    db.prepare(`
      INSERT INTO ai_models (
        id, name, provider_type, api_key, api_base, model_id,
        enabled, sort_order, is_default, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.provider_type,
      input.api_key ?? null,
      input.api_base ?? null,
      input.model_id,
      input.enabled,
      input.sort_order,
      input.is_default,
      input.tags ?? null
    );
  },

  /** 动态更新模型字段 */
  update(id: string, updates: AIModelUpdateInput): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { setClauses.push('name = ?'); values.push(updates.name); }
    if (updates.provider_type !== undefined) { setClauses.push('provider_type = ?'); values.push(updates.provider_type); }
    if (updates.api_key !== undefined) { setClauses.push('api_key = ?'); values.push(updates.api_key); }
    if (updates.api_base !== undefined) { setClauses.push('api_base = ?'); values.push(updates.api_base); }
    if (updates.model_id !== undefined) { setClauses.push('model_id = ?'); values.push(updates.model_id); }
    if (updates.enabled !== undefined) { setClauses.push('enabled = ?'); values.push(updates.enabled); }
    if (updates.is_default !== undefined) { setClauses.push('is_default = ?'); values.push(updates.is_default); }
    if (updates.tags !== undefined) { setClauses.push('tags = ?'); values.push(updates.tags); }

    if (setClauses.length === 0) return;

    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);

    db.prepare(`UPDATE ai_models SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  /** 清除所有模型的 is_default 标志 */
  clearAllDefaults(): void {
    db.prepare('UPDATE ai_models SET is_default = 0').run();
  },

  /** 删除模型 */
  delete(id: string): void {
    db.prepare('DELETE FROM ai_models WHERE id = ?').run(id);
  },

  /** 更新单个模型的 sort_order */
  updateSortOrder(id: string, sortOrder: number): void {
    db.prepare(
      "UPDATE ai_models SET sort_order = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(sortOrder, id);
  },

  /** 更新模型测试状态 */
  updateTestStatus(id: string, status: 'success' | 'failed'): void {
    db.prepare(`
      UPDATE ai_models
      SET last_test_status = ?, last_test_time = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(status, id);
  },
};