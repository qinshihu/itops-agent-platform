import db from '../models/database';
import { randomUUID } from 'crypto';

export interface AiRemediationRecord {
  id: string;
  alert_id: string;
  device_id?: string;
  device_name?: string;
  device_ip?: string;
  task_id: string | null;
  workflow_id: string | null;
  diagnosis: string;
  remediation_commands: unknown;
  risk_level: string;
  status: string;
  execution_result?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface AiRemediationCreateInput {
  alert_id: string;
  device_id?: string;
  device_name?: string;
  device_ip?: string;
  diagnosis: string;
  remediation_commands: unknown;
  risk_level: string;
}

export const aiRemediationRepository = {
  create(input: AiRemediationCreateInput): AiRemediationRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO ai_remediations (
        id, alert_id, device_id, device_name, device_ip, task_id, workflow_id,
        diagnosis, remediation_commands, risk_level, status, execution_result,
        error_message, created_at, updated_at
      ) VALUES (
        @id, @alert_id, @device_id, @device_name, @device_ip, @task_id, @workflow_id,
        @diagnosis, @remediation_commands, @risk_level, @status, @execution_result,
        @error_message, @created_at, @updated_at
      )
    `).run({
      id,
      alert_id: input.alert_id,
      device_id: input.device_id ?? null,
      device_name: input.device_name ?? null,
      device_ip: input.device_ip ?? null,
      task_id: null,
      workflow_id: null,
      diagnosis: input.diagnosis,
      remediation_commands: JSON.stringify(input.remediation_commands),
      risk_level: input.risk_level,
      status: 'pending',
      execution_result: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    });

    return this.getById(id)!;
  },

  update(record: AiRemediationRecord): void {
    db.prepare(`
      UPDATE ai_remediations SET
        task_id = @task_id,
        workflow_id = @workflow_id,
        status = @status,
        execution_result = @execution_result,
        error_message = @error_message,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: record.id,
      task_id: record.task_id,
      workflow_id: record.workflow_id,
      status: record.status,
      execution_result: record.execution_result ?? null,
      error_message: record.error_message ?? null,
      updated_at: record.updated_at,
    });
  },

  getById(id: string): AiRemediationRecord | null {
    const row = db.prepare('SELECT * FROM ai_remediations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...row,
      remediation_commands: JSON.parse((row.remediation_commands as string) || '[]'),
    } as AiRemediationRecord;
  },

  getByAlertId(alertId: string): AiRemediationRecord | null {
    const row = db.prepare(
      'SELECT * FROM ai_remediations WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(alertId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...row,
      remediation_commands: JSON.parse((row.remediation_commands as string) || '[]'),
    } as AiRemediationRecord;
  },

  list(limit = 50): AiRemediationRecord[] {
    const rows = db.prepare(
      'SELECT * FROM ai_remediations ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as Record<string, unknown>[];
    return rows.map(row => ({
      ...row,
      remediation_commands: JSON.parse((row.remediation_commands as string) || '[]'),
    })) as AiRemediationRecord[];
  },

  /**
   * 真实统计：MTTR + 成功率 + 状态分布 + 趋势
   * - MTTR：status='completed' 的 (julianday(updated_at) - julianday(created_at)) * 86400 秒 平均
   * - 成功率：completed / (completed + failed)
   * - 趋势：本周 vs 上周的 completed 数对比
   */
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    mttrSeconds: number | null;
    mttrCount: number;
    successRate: number;
    completedThisWeek: number;
    completedLastWeek: number;
    weekOverWeekDelta: number;
  } {
    const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM ai_remediations').get() as { cnt: number };

    // 状态分布
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) as cnt FROM ai_remediations GROUP BY status
    `).all() as Array<{ status: string; cnt: number }>;
    const byStatus: Record<string, number> = {};
    for (const r of statusRows) byStatus[r.status] = r.cnt;

    // MTTR（仅 status='completed' 且 updated_at > created_at）
    const mttrRow = db.prepare(`
      SELECT
        AVG((julianday(updated_at) - julianday(created_at)) * 86400) as avg_seconds,
        COUNT(*) as cnt
      FROM ai_remediations
      WHERE status = 'completed'
        AND updated_at > created_at
        AND (julianday(updated_at) - julianday(created_at)) * 86400 < 86400  -- 排除异常（>1天）
    `).get() as { avg_seconds: number | null; cnt: number };

    // 成功率
    const completed = byStatus['completed'] || 0;
    const failed = byStatus['failed'] || 0;
    const successRate = (completed + failed) > 0 ? completed / (completed + failed) : 0;

    // 本周 vs 上周
    const thisWeekRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM ai_remediations
      WHERE status = 'completed' AND created_at >= datetime('now', '-7 days')
    `).get() as { cnt: number };
    const lastWeekRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM ai_remediations
      WHERE status = 'completed'
        AND created_at >= datetime('now', '-14 days')
        AND created_at < datetime('now', '-7 days')
    `).get() as { cnt: number };
    const completedThisWeek = thisWeekRow.cnt;
    const completedLastWeek = lastWeekRow.cnt;
    const weekOverWeekDelta = completedLastWeek > 0
      ? (completedThisWeek - completedLastWeek) / completedLastWeek
      : (completedThisWeek > 0 ? 1 : 0);

    return {
      total: totalRow.cnt,
      byStatus,
      mttrSeconds: mttrRow.avg_seconds,
      mttrCount: mttrRow.cnt,
      successRate,
      completedThisWeek,
      completedLastWeek,
      weekOverWeekDelta,
    };
  },

  /**
   * 告警降噪率：从 ai_remediations 自动处理的告警 / 总告警
   * （用 alert_id 关联）
   */
  getNoiseFilterRate(): {
    autoHandled: number;
    total: number;
    rate: number;
  } {
    const autoRow = db.prepare(`
      SELECT COUNT(DISTINCT alert_id) as cnt FROM ai_remediations
      WHERE alert_id IS NOT NULL AND alert_id != ''
    `).get() as { cnt: number };
    // 总告警：尝试读 alerts 表，缺则返回 -1（前端走 N/A）
    let total = -1;
    try {
      const r = db.prepare('SELECT COUNT(*) as cnt FROM alerts').get() as { cnt: number };
      total = r.cnt;
    } catch {
      total = -1;
    }
    const rate = (autoRow.cnt > 0 && total > 0) ? autoRow.cnt / total : 0;
    return { autoHandled: autoRow.cnt, total, rate };
  },

  /** 更新状态字段（用于 finalizeWorkflow 回滚等场景） */
  updateStatusFields(id: string, status: string, executionResult?: string, errorMessage?: string): void {
    db.prepare(`
      UPDATE ai_remediations SET status = ?, execution_result = ?, error_message = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(status, executionResult ?? null, errorMessage ?? null, id);
  },
};