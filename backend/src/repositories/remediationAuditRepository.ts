/**
 * remediationAuditRepository — remediation 域统一数据访问层
 *
 * 覆盖以下表：
 *   - remediation_audits          (审计执行记录)
 *   - remediation_executions      (修复执行记录)
 *   - remediation_cooldowns       (修复冷却期)
 *   - remediation_history         (修复历史记录)
 *
 * 取代 executionTracker.ts / remediationActions.ts 等散落的 db.prepare 调用。
 */

import db from '../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { v4 as uuidv4 } from 'uuid';

// ── 类型定义 ──

export interface RemediationAuditRecord {
  id: string;
  rca_id: string;
  policy_id?: string | null;
  server_id: string;
  risk_level: string;
  status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  execution_log?: string | null;
  result?: string | null;
  is_rollback?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
}

export interface RemediationAuditJoinRow extends RemediationAuditRecord {
  rca_title?: string;
  policy_name?: string;
}

export interface RemediationAuditCreateInput {
  id: string;
  rca_id: string;
  policy_id?: string | null;
  server_id: string;
  risk_level: string;
  status: string;
  created_at: string;
}

export interface RemediationAuditUpdateInput {
  status?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  execution_log?: string | null;
  result?: string | null;
  is_rollback?: number;
  completed_at?: string | null;
}

export interface RemediationAuditListFilters {
  status?: string;
  risk_level?: string;
  page?: number;
  limit?: number;
}

export interface RemediationExecutionRecord {
  id: string;
  policy_id: string;
  alert_id: string;
  alert_snapshot?: string | null;
  status: string;
  status_reason?: string | null;
  approval_required?: number;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_comment?: string | null;
  workflow_execution_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  execution_result?: string | null;
  verification_status?: string | null;
  verification_result?: string | null;
  verification_completed_at?: string | null;
  rollback_triggered?: number;
  rollback_execution_id?: string | null;
  rollback_completed_at?: string | null;
  rollback_result?: string | null;
  execution_duration_ms?: number | null;
  created_at: string;
}

export interface RemediationExecutionCreateInput {
  id: string;
  policy_id: string;
  alert_id: string;
  alert_snapshot?: string | null;
  status: string;
  status_reason?: string | null;
  approval_required?: number;
  created_at: string;
}

export interface RemediationExecutionListFilters {
  policy_id?: string;
  alert_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface RemediationExecutionStats {
  total_triggers: number;
  success_count: number;
  failed_count: number;
  rolled_back_count: number;
  success_rate: number;
  avg_duration_ms: number;
  top_root_causes: string[];
  daily_stats: Array<{ date: string; triggers: number; success: number; failed: number }>;
}

// ── repository 实现 ──

export const remediationAuditRepository = {
  // ═══ remediation_audits ═══

  getById(id: string): RemediationAuditRecord | undefined {
    return db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(id) as RemediationAuditRecord | undefined;
  },

  /** 获取 audit 并 JOIN rca + policy */
  getByIdWithJoins(id: string): RemediationAuditJoinRow | undefined {
    return db.prepare(`
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      WHERE a.id = ?
    `).get(id) as RemediationAuditJoinRow | undefined;
  },

  create(input: RemediationAuditCreateInput): void {
    db.prepare(`
      INSERT INTO remediation_audits (
        id, rca_id, policy_id, server_id, risk_level, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.rca_id, input.policy_id ?? null, input.server_id, input.risk_level, input.status, input.created_at);
  },

  /** 动态更新 audit 字段 */
  update(id: string, updates: RemediationAuditUpdateInput): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    if (updates.status !== undefined) { setClauses.push('status = ?'); values.push(updates.status); }
    if (updates.approved_by !== undefined) { setClauses.push('approved_by = ?'); values.push(updates.approved_by); }
    if (updates.approved_at !== undefined) { setClauses.push('approved_at = ?'); values.push(updates.approved_at); }
    if (updates.execution_log !== undefined) { setClauses.push('execution_log = ?'); values.push(updates.execution_log); }
    if (updates.result !== undefined) { setClauses.push('result = ?'); values.push(updates.result); }
    if (updates.is_rollback !== undefined) { setClauses.push('is_rollback = ?'); values.push(updates.is_rollback); }
    if (updates.completed_at !== undefined) { setClauses.push('completed_at = ?'); values.push(updates.completed_at); }
    if (setClauses.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE remediation_audits SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  /** 带 JOIN 的列表查询 */
  listWithJoins(filters: RemediationAuditListFilters = {}): { audits: RemediationAuditJoinRow[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.status) { where += ' AND a.status = ?'; params.push(filters.status); }
    if (filters.risk_level) { where += ' AND a.risk_level = ?'; params.push(filters.risk_level); }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM remediation_audits ${where.replace('a.', '')}`).get(...params) as { count: number }).count;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const audits = db.prepare(`
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as RemediationAuditJoinRow[];

    return { audits, total };
  },

  // ═══ remediation_executions ═══

  createExecution(input: RemediationExecutionCreateInput): void {
    db.prepare(`
      INSERT INTO remediation_executions (
        id, policy_id, alert_id, alert_snapshot, status, status_reason, approval_required, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.policy_id, input.alert_id, input.alert_snapshot ?? null, input.status, input.status_reason ?? null, input.approval_required ?? 0, input.created_at);
  },

  getExecutionById(id: string): RemediationExecutionRecord {
    const execution = db.prepare('SELECT * FROM remediation_executions WHERE id = ?').get(id) as RemediationExecutionRecord | undefined;
    if (!execution) throw new Error(`Execution not found: ${id}`);
    return execution;
  },

  listExecutions(filters: RemediationExecutionListFilters = {}): { executions: RemediationExecutionRecord[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.policy_id) { where += ' AND policy_id = ?'; params.push(filters.policy_id); }
    if (filters.alert_id) { where += ' AND alert_id = ?'; params.push(filters.alert_id); }
    if (filters.status) { where += ' AND status = ?'; params.push(filters.status); }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM remediation_executions ${where}`).get(...params) as { count: number }).count;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const executions = db.prepare(`SELECT * FROM remediation_executions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as RemediationExecutionRecord[];

    return { executions, total };
  },

  /** 动态更新 execution 字段 */
  updateExecution(id: string, updates: Record<string, unknown>): void {
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id') {
        setClauses.push(`${key} = @${key}`);
        params[key] = value;
      }
    }
    if (setClauses.length === 0) return;
    db.prepare(`UPDATE remediation_executions SET ${setClauses.join(', ')} WHERE id = @id`).run(params);
  },

  /** 更新 execution 状态（含时间戳） */
  updateExecutionStatus(id: string, status: string, reason?: string): void {
    const fields: string[] = ['status = ?'];
    const params: unknown[] = [status];

    if (reason) { fields.push('status_reason = ?'); params.push(reason); }
    if (['success', 'failed', 'rolled_back', 'rejected', 'skipped'].includes(status)) {
      fields.push('completed_at = ?'); params.push(new Date().toISOString());
    }
    if (status === 'running') {
      fields.push('started_at = ?'); params.push(new Date().toISOString());
    }

    params.push(id);
    db.prepare(`UPDATE remediation_executions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  },

  getExecutionStats(policyId: string, sinceDate: string): RemediationExecutionStats {
    const totalResult = db.prepare(`SELECT COUNT(*) as count FROM remediation_executions WHERE policy_id = ? AND created_at > ?`).get(policyId, sinceDate) as { count: number };
    const successResult = db.prepare(`SELECT COUNT(*) as count FROM remediation_executions WHERE policy_id = ? AND status = 'success' AND created_at > ?`).get(policyId, sinceDate) as { count: number };
    const failedResult = db.prepare(`SELECT COUNT(*) as count FROM remediation_executions WHERE policy_id = ? AND status = 'failed' AND created_at > ?`).get(policyId, sinceDate) as { count: number };
    const rolledBackResult = db.prepare(`SELECT COUNT(*) as count FROM remediation_executions WHERE policy_id = ? AND status = 'rolled_back' AND created_at > ?`).get(policyId, sinceDate) as { count: number };
    const avgDurationResult = db.prepare(`SELECT AVG(execution_duration_ms) as avg_duration FROM remediation_executions WHERE policy_id = ? AND execution_duration_ms IS NOT NULL AND created_at > ?`).get(policyId, sinceDate) as { avg_duration: number | null };

    const dailyStats = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as triggers,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM remediation_executions
      WHERE policy_id = ? AND created_at > ?
      GROUP BY DATE(created_at) ORDER BY date
    `).all(policyId, sinceDate) as Array<{ date: string; triggers: number; success: number; failed: number }>;

    const total = totalResult.count;
    return {
      total_triggers: total,
      success_count: successResult.count,
      failed_count: failedResult.count,
      rolled_back_count: rolledBackResult.count,
      success_rate: total > 0 ? Math.round((successResult.count / total) * 10000) / 100 : 0,
      avg_duration_ms: avgDurationResult.avg_duration ? Math.round(avgDurationResult.avg_duration) : 0,
      top_root_causes: [],
      daily_stats: dailyStats,
    };
  },

  cleanupOldExecutions(days: number): number {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare('DELETE FROM remediation_executions WHERE created_at < ?').run(cutoffDate);
    return (result as { changes: number }).changes;
  },

  // ═══ remediation_cooldowns ═══

  upsertCooldown(policyId: string, alertId: string, cooldownUntil: string): void {
    db.prepare(`
      INSERT INTO remediation_cooldowns (policy_id, alert_id, cooldown_until)
      VALUES (?, ?, ?)
      ON CONFLICT (policy_id, alert_id) DO UPDATE SET cooldown_until = excluded.cooldown_until, created_at = datetime('now','localtime')
    `).run(policyId, alertId, cooldownUntil);
  },

  getCooldown(policyId: string, alertId: string): { cooldown_until: string } | undefined {
    return db.prepare(`
      SELECT cooldown_until FROM remediation_cooldowns
      WHERE policy_id = ? AND alert_id = ?
    `).get(policyId, alertId) as { cooldown_until: string } | undefined;
  },

  countRecentExecutions(policyId: string, sinceDate: string): number {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };
    return result.count;
  },

  // ═══ remediation_history ═══

  insertHistory(input: {
    id: string;
    policy_id: string;
    alert_source: string | null;
    alert_severity: string | null;
    execution_status: string;
    resolution: string;
    duration_ms: number | null;
  }): void {
    db.prepare(`
      INSERT INTO remediation_history (
        id, policy_id, alert_source, alert_severity, execution_status, resolution, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.policy_id, input.alert_source, input.alert_severity, input.execution_status, input.resolution, input.duration_ms);
  },
};