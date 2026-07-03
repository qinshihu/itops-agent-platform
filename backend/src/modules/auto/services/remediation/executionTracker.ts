import { v4 as uuidv4 } from 'uuid';
import db from '../../../../models/database';
import { logger } from '../../../../utils/logger';
import type { RemediationPolicy, RemediationExecution, PolicyStats } from '../../../../types';

export const executionTrackerMixin = {
  async createSkippedExecution(policy: RemediationPolicy, alert: { id: string; source: string; severity?: string; title?: string; content?: string }, reason: string): Promise<RemediationExecution> {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO remediation_executions (
        id, policy_id, alert_id, alert_snapshot, status, status_reason, created_at
      ) VALUES (?, ?, ?, ?, 'skipped', ?, ?)
    `).run(
      id,
      policy.id,
      alert.id,
      JSON.stringify(alert),
      reason,
      now
    );

    return this.getExecution(id);
  },

  getExecution(id: string): RemediationExecution {
    const execution = db.prepare('SELECT * FROM remediation_executions WHERE id = ?').get(id) as RemediationExecution | undefined;
    if (!execution) {
      throw new Error(`Execution not found: ${id}`);
    }
    return execution;
  },

  listExecutions(filters: { policy_id?: string; alert_id?: string; status?: string; page?: number; limit?: number }): { executions: RemediationExecution[]; total: number } {
    let sql = 'SELECT * FROM remediation_executions WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM remediation_executions WHERE 1=1';
    const params: unknown[] = [];

    if (filters.policy_id) {
      sql += ' AND policy_id = ?';
      countSql += ' AND policy_id = ?';
      params.push(filters.policy_id);
    }

    if (filters.alert_id) {
      sql += ' AND alert_id = ?';
      countSql += ' AND alert_id = ?';
      params.push(filters.alert_id);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const executions = db.prepare(sql).all(...params) as RemediationExecution[];
    const totalResult = db.prepare(countSql).get(...params) as { count: number };

    return { executions, total: totalResult.count };
  },

  async getPolicyStats(policyId: string, days: number): Promise<PolicyStats> {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };

    const successResult = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND status = 'success' AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };

    const failedResult = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND status = 'failed' AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };

    const rolledBackResult = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND status = 'rolled_back' AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };

    const avgDurationResult = db.prepare(`
      SELECT AVG(execution_duration_ms) as avg_duration FROM remediation_executions
      WHERE policy_id = ? AND execution_duration_ms IS NOT NULL AND created_at > ?
    `).get(policyId, sinceDate) as { avg_duration: number | null };

    const total = totalResult.count;
    const successRate = total > 0 ? (successResult.count / total) * 100 : 0;

    const dailyStats = db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as triggers,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM remediation_executions
      WHERE policy_id = ? AND created_at > ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(policyId, sinceDate) as Array<{ date: string; triggers: number; success: number; failed: number }>;

    return {
      total_triggers: total,
      success_count: successResult.count,
      failed_count: failedResult.count,
      rolled_back_count: rolledBackResult.count,
      success_rate: Math.round(successRate * 100) / 100,
      avg_duration_ms: avgDurationResult.avg_duration ? Math.round(avgDurationResult.avg_duration) : 0,
      top_root_causes: [],
      daily_stats: dailyStats
    };
  },

  updateExecutionStatus(id: string, status: RemediationExecution['status'], reason?: string): void {
    const fields: string[] = ['status = ?'];
    const params: unknown[] = [status];

    if (reason) {
      fields.push('status_reason = ?');
      params.push(reason);
    }

    if (['success', 'failed', 'rolled_back', 'rejected', 'skipped'].includes(status)) {
      fields.push('completed_at = ?');
      params.push(new Date().toISOString());
    }

    if (status === 'running') {
      fields.push('started_at = ?');
      params.push(new Date().toISOString());
    }

    params.push(id);
    db.prepare(`UPDATE remediation_executions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  },

  updateExecution(id: string, updates: Partial<RemediationExecution>): void {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = @${key}`);
        params[key] = value;
      }
    }

    if (fields.length === 0) return;

    const sql = `UPDATE remediation_executions SET ${fields.join(', ')} WHERE id = @id`;
    db.prepare(sql).run(params);
  },

  resolveAlert(alertId: string): void {
    try {
      const result = db.prepare(`
        UPDATE alerts SET status = 'resolved', updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(alertId);
      if (result.changes > 0) {
        logger.info(`Alert ${alertId} marked as resolved by auto-remediation`);
      }
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
    }
  },

  updateCooldown(policy: RemediationPolicy, alert: Record<string, unknown>): void {
    if (alert.id && typeof alert.id === 'string') {
      const cooldownUntil = new Date(Date.now() + policy.cooldown_seconds * 1000).toISOString();
      db.prepare(`
        INSERT INTO remediation_cooldowns (policy_id, alert_id, cooldown_until)
        VALUES (?, ?, ?)
        ON CONFLICT (policy_id, alert_id) DO UPDATE SET cooldown_until = excluded.cooldown_until, created_at = datetime('now','localtime')
      `).run(policy.id, alert.id, cooldownUntil);
    }
  },

  recordHistory(execution: RemediationExecution, policy: RemediationPolicy, status: string, reason?: string): void {
    try {
      const alert = JSON.parse(execution.alert_snapshot || '{}');
      db.prepare(`
        INSERT INTO remediation_history (
          id, policy_id, alert_source, alert_severity, execution_status, resolution, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        policy.id,
        alert.source,
        alert.severity,
        status,
        reason || 'Auto-remediated',
        execution.execution_duration_ms || null
      );
    } catch (error) {
      logger.error('Failed to record remediation history:', error);
    }
  },

  notifySelfHeal(alertId: string | undefined, _alertTitle: string | undefined): void {
    if (!alertId) return;
    try {
      const alert = db.prepare('SELECT source, title FROM alerts WHERE id = ?').get(alertId) as { source: string; title: string } | undefined;
      if (!alert) return;

      db.prepare(`
        INSERT OR REPLACE INTO settings (key, value)
        VALUES (?, ?)
      `).run(
        `self_healed:${alert.source}:${alert.title}`,
        new Date().toISOString()
      );
      logger.info(`🔄 [SelfHeal] Alert ${alertId} self-healed, noise reduction updated`);
    } catch (e) {
      logger.warn('Failed to update noise reduction after self-heal:', e);
    }
  },

  async cleanupOldExecutions(days: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      DELETE FROM remediation_executions WHERE created_at < ?
    `).run(cutoffDate);
    logger.info(`Cleaned up ${result.changes} old remediation executions`);
  },
};
