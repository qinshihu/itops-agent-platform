/**
 * auditLogRepository — audit_logs 表的统一数据访问层
 *
 * audit_logs 是跨模块表（告警/服务器/认证/基础设施均使用），
 * 独立于领域 repository，供所有模块共享。
 */

import db from '../models/database';

export interface AuditLogRecord {
  id: string;
  user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditLogInsertInput {
  id: string;
  user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
}

export interface AuditLogListFilters {
  action?: string;
  resource_type?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export const auditLogRepository = {
  /** 插入审计日志 */
  insert(input: AuditLogInsertInput): void {
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.user_id ?? null,
      input.action,
      input.resource_type,
      input.resource_id ?? null,
      input.details ?? null,
      input.ip_address ?? null
    );
  },

  /** 按 ID 查询 */
  getById(id: string): AuditLogRecord | undefined {
    return db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id) as AuditLogRecord | undefined;
  },

  /** 列表查询（带过滤+分页） */
  list(filters: AuditLogListFilters = {}): AuditLogRecord[] {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.resource_type) {
      query += ' AND resource_type = ?';
      params.push(filters.resource_type);
    }
    if (filters.user_id) {
      query += ' AND user_id = ?';
      params.push(filters.user_id);
    }
    if (filters.start_date) {
      query += ' AND created_at >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND created_at <= ?';
      params.push(filters.end_date);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit ?? 50);
    params.push(filters.offset ?? 0);

    return db.prepare(query).all(...params) as AuditLogRecord[];
  },

  /** 计数（带过滤） */
  count(filters: Omit<AuditLogListFilters, 'limit' | 'offset'> = {}): number {
    let query = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.resource_type) {
      query += ' AND resource_type = ?';
      params.push(filters.resource_type);
    }
    if (filters.user_id) {
      query += ' AND user_id = ?';
      params.push(filters.user_id);
    }
    if (filters.start_date) {
      query += ' AND created_at >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND created_at <= ?';
      params.push(filters.end_date);
    }

    return (db.prepare(query).get(...params) as { total: number }).total;
  },

  /** 按动作类型统计（最近 7 天） */
  getActionStats(): Array<{ action: string; count: number }> {
    return db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY action
      ORDER BY count DESC
    `).all() as Array<{ action: string; count: number }>;
  },

  /** 按资源类型统计（最近 7 天） */
  getResourceStats(): Array<{ resource_type: string; count: number }> {
    return db.prepare(`
      SELECT resource_type, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY resource_type
      ORDER BY count DESC
    `).all() as Array<{ resource_type: string; count: number }>;
  },

  /** 今日操作数 */
  getTodayCount(): number {
    return (db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= datetime('now', 'start of day')
    `).get() as { count: number }).count;
  },
};
