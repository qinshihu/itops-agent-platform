import db from '../../models/database';
import type { ApprovalRequest } from '../../types';
import type { ApprovalListFilters } from './types';

export const approvalsRepo = {
  list(filters: ApprovalListFilters = {}): ApprovalRequest[] {
    let query = 'SELECT * FROM approval_requests';
    const params: unknown[] = [];

    if (filters.status) {
      query += ' WHERE status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params) as ApprovalRequest[];
  },

  countPending(): number {
    const result = db
      .prepare("SELECT COUNT(*) as count FROM approval_requests WHERE status = 'pending'")
      .get() as { count: number };
    return result.count;
  },

  getById(id: string): ApprovalRequest | undefined {
    return db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id) as ApprovalRequest | undefined;
  },

  /** 创建审批请求 */
  create(input: {
    id: string;
    task_id: string;
    node_id: string;
    node_label: string;
    description: string;
    timeout_at: string | null;
    timeout_action: string;
  }): void {
    db.prepare(`
      INSERT INTO approval_requests (id, task_id, node_id, node_label, description, status, timeout_at, timeout_action)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(input.id, input.task_id, input.node_id, input.node_label, input.description, input.timeout_at, input.timeout_action);
  },

  /** 审批通过 */
  approve(id: string, approvedBy: string): void {
    db.prepare(`
      UPDATE approval_requests
      SET status = 'approved', approved_by = ?, approved_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(approvedBy, id);
  },

  /** 审批拒绝 */
  reject(id: string, rejectedBy: string, reason: string): void {
    db.prepare(`
      UPDATE approval_requests
      SET status = 'rejected', approved_by = ?, reject_reason = ?, approved_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(rejectedBy, reason, id);
  },

  /** 审批超时 */
  timeout(id: string): void {
    db.prepare(`
      UPDATE approval_requests
      SET status = 'timeout', updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(id);
  },
};