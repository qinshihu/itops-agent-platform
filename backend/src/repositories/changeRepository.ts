/**
 * changeRepository — change_records 表的统一数据访问层
 *
 * 覆盖 changeService.ts 中 8 处直接 db.prepare 调用，包括：
 *   - CRUD（create / getById / update / delete）
 *   - 列表分页查询（list）
 *   - 标记根因（markAsRootCause）
 *   - 按服务器查询最近变更（getRecentByServer）
 */

import db from '../models/database';

// ── 类型定义 ──

export interface ChangeRecord {
  id: string;
  server_id: string;
  change_type: string;
  description: string | null;
  changed_by: string | null;
  status: string;
  related_alert_id: string | null;
  is_root_cause: number;
  metadata: string | null;
  created_at: string;
}

export interface ChangeCreateInput {
  id: string;
  server_id: string;
  change_type: string;
  description?: string | null;
  changed_by?: string | null;
  status?: string;
  related_alert_id?: string | null;
  metadata?: string | null;
  created_at: string;
}

export interface ChangeListFilters {
  server_id?: string;
  change_type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ChangeUpdateFields {
  change_type?: string;
  description?: string | null;
  changed_by?: string | null;
  status?: string;
  related_alert_id?: string | null;
  metadata?: string | null;
}

// ── repository 实现 ──

export const changeRepository = {
  /** 按 ID 查询 */
  getById(id: string): ChangeRecord | undefined {
    return db.prepare('SELECT * FROM change_records WHERE id = ?').get(id) as ChangeRecord | undefined;
  },

  /** 创建变更记录 */
  create(input: ChangeCreateInput): void {
    db.prepare(`
      INSERT INTO change_records (id, server_id, change_type, description, changed_by, status, related_alert_id, is_root_cause, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      input.id, input.server_id, input.change_type,
      input.description ?? null, input.changed_by ?? null,
      input.status ?? 'completed', input.related_alert_id ?? null,
      input.metadata ?? null, input.created_at,
    );
  },

  /** 列表查询（分页） */
  list(filters: ChangeListFilters = {}): { records: ChangeRecord[]; total: number } {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filters.server_id) { conditions.push('server_id = ?'); params.push(filters.server_id); }
    if (filters.change_type) { conditions.push('change_type = ?'); params.push(filters.change_type); }
    if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }

    const where = conditions.join(' AND ');
    const total = (db.prepare(`SELECT COUNT(*) as total FROM change_records WHERE ${where}`).get(...params) as { total: number }).total;

    const records = db.prepare(
      `SELECT * FROM change_records WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, filters.limit ?? 20, filters.offset ?? 0) as ChangeRecord[];

    return { records, total };
  },

  /** 动态更新字段 */
  update(id: string, fields: ChangeUpdateFields): number {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (fields.change_type !== undefined) { sets.push('change_type = ?'); params.push(fields.change_type); }
    if (fields.description !== undefined) { sets.push('description = ?'); params.push(fields.description); }
    if (fields.changed_by !== undefined) { sets.push('changed_by = ?'); params.push(fields.changed_by); }
    if (fields.status !== undefined) { sets.push('status = ?'); params.push(fields.status); }
    if (fields.related_alert_id !== undefined) { sets.push('related_alert_id = ?'); params.push(fields.related_alert_id); }
    if (fields.metadata !== undefined) { sets.push('metadata = ?'); params.push(fields.metadata); }

    if (sets.length === 0) return 0;

    sets.push("updated_at = datetime('now','localtime')");
    params.push(id);

    return db.prepare(`UPDATE change_records SET ${sets.join(', ')} WHERE id = ?`).run(...params).changes;
  },

  /** 标记为根因 */
  markAsRootCause(id: string): void {
    db.prepare("UPDATE change_records SET is_root_cause = 1, updated_at = datetime('now','localtime') WHERE id = ?").run(id);
  },

  /** 按服务器查询最近变更 */
  getRecentByServer(serverId: string, hours: number): ChangeRecord[] {
    return db.prepare(`
      SELECT * FROM change_records WHERE server_id = ? AND created_at >= datetime('now', ?) ORDER BY created_at DESC
    `).all(serverId, `-${hours} hours`) as ChangeRecord[];
  },

  /** 删除变更记录 */
  delete(id: string): boolean {
    return db.prepare('DELETE FROM change_records WHERE id = ?').run(id).changes > 0;
  },
};