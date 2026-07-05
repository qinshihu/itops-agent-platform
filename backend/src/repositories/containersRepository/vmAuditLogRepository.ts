/**
 * vmAuditLogRepository — vm_audit_logs 表数据访问层
 *
 * 覆盖表：vm_audit_logs (v055)
 */

import db from '../../models/database';

// ── 类型定义 ──

export interface VmAuditLogRecord {
  id: string;
  platform_id: string;
  vm_id: string | null;
  vm_name: string | null;
  operation: string;
  user_id: string | null;
  username: string | null;
  parameters: string | null;
  result: string | null;
  status: string;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface VmAuditLogCreateInput {
  id: string;
  platform_id: string;
  vm_id?: string | null;
  vm_name?: string | null;
  operation: string;
  user_id?: string | null;
  username?: string | null;
  parameters?: string | null;
  result?: string | null;
  status?: string;
  error_message?: string | null;
  started_at?: string;
  completed_at?: string | null;
}

export interface VmAuditLogListFilters {
  platform_id?: string;
  vm_id?: string;
  page?: number;
  limit?: number;
}

// ── repository 实现 ──

export const vmAuditLogRepository = {
  create(input: VmAuditLogCreateInput): void {
    db.prepare(`
      INSERT INTO vm_audit_logs (
        id, platform_id, vm_id, vm_name, operation, user_id, username,
        parameters, result, status, error_message, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.platform_id,
      input.vm_id ?? null,
      input.vm_name ?? null,
      input.operation,
      input.user_id ?? null,
      input.username ?? null,
      input.parameters ?? null,
      input.result ?? null,
      input.status ?? 'started',
      input.error_message ?? null,
      input.started_at ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
      input.completed_at ?? null,
    );
  },

  list(filters: VmAuditLogListFilters = {}): { rows: VmAuditLogRecord[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.platform_id) {
      where += ' AND platform_id = ?';
      params.push(filters.platform_id);
    }
    if (filters.vm_id) {
      where += ' AND vm_id = ?';
      params.push(filters.vm_id);
    }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM vm_audit_logs ${where}`).get(...params) as { count: number })?.count || 0;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const rows = db.prepare(`SELECT * FROM vm_audit_logs ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as VmAuditLogRecord[];

    return { rows, total };
  },
};