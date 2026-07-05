// ── aarsLogs 子 repository ──

import db from '../../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AarsResponseLog } from '../types/alert';
import type { AarsResponseLogInput, AarsResponseLogRecord } from './types';

export const aarsLogsRepo = {
  /**
   * 按 alertId 查询 AARS 响应日志
   * 对应：alertAutoResponseService.getLogByAlertId
   */
  getByAlertId(alertId: string): AarsResponseLogRecord | undefined {
    return db.prepare('SELECT * FROM aars_response_logs WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1').get(alertId) as AarsResponseLogRecord | undefined;
  },

  /**
   * 列出 AARS 日志（按 started_at 倒序）
   * 对应：alertAutoResponseService.getLogs
   */
  list(limit = 50): AarsResponseLogRecord[] {
    return db.prepare('SELECT * FROM aars_response_logs ORDER BY started_at DESC LIMIT ?').all(limit) as AarsResponseLogRecord[];
  },

  /**
   * 保存 AARS 日志（INSERT OR REPLACE，15 字段）
   * 对应：alertAutoResponseService.saveLog
   */
  save(input: AarsResponseLogInput): void {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO aars_response_logs
        (id, alert_id, device_id, device_type, access_method, status,
         diagnosis_result, root_cause, remediation_plan, verification_result,
         execution_status, approval_status, error_message, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.alert_id, input.device_id ?? null, input.device_type ?? null,
      input.access_method ?? null, input.status,
      input.diagnosis_result ?? null, input.root_cause ?? null,
      input.remediation_plan ?? null, input.verification_result ?? null,
      input.execution_status ?? null, input.approval_status ?? 'not_needed',
      input.error_message ?? null, now, now
    );
  },

  /**
   * 标记日志完成（设置 completed_at + updated_at）
   * 对应：alertAutoResponseService.updateLogCompleted
   */
  updateCompleted(id: string): void {
    db.prepare(`
      UPDATE aars_response_logs SET completed_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?
    `).run(id);
  },

  /**
   * AARS 统计信息
   * 对应：alertAutoResponseService.getStats
   */
  getStats(): { total: number; success: number; failed: number; pendingApproval: number; escalated: number } {
    const total = (db.prepare('SELECT COUNT(*) as c FROM aars_response_logs').get() as { c: number }).c;
    const success = (db.prepare("SELECT COUNT(*) as c FROM aars_response_logs WHERE status = 'resolved' AND execution_status = 'success'").get() as { c: number }).c;
    const failed = (db.prepare("SELECT COUNT(*) as c FROM aars_response_logs WHERE status = 'failed'").get() as { c: number }).c;
    const pendingApproval = (db.prepare("SELECT COUNT(*) as c FROM aars_response_logs WHERE status = 'pending_approval'").get() as { c: number }).c;
    const escalated = (db.prepare("SELECT COUNT(*) as c FROM aars_response_logs WHERE status = 'escalated'").get() as { c: number }).c;
    return { total, success, failed, pendingApproval, escalated };
  },

  /**
   * 检查告警是否已被 AARS 处理（status 不在 identifying/pending 中）
   * 对应：alertFetcher.isAlreadyProcessedByAARS
   */
  existsProcessedByAlertId(alertId: string): boolean {
    const record = db.prepare(`
      SELECT 1 FROM aars_response_logs
      WHERE alert_id = ?
      AND status NOT IN ('identifying', 'pending')
      LIMIT 1
    `).get(alertId);
    return !!record;
  },
};