// ── processingRecords 子 repository ──

import db from '../../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AlertProcessingRecord as AlertProcessingRecordType } from '../types/alert';
import type { AlertProcessingRecord } from './types';

export const processingRecordsRepo = {
  /**
   * 保存初始处理记录（INSERT）
   * 对应：AlertProcessor.saveProcessingRecord
   */
  create(recordId: string, alertId: string, status: string): void {
    db.prepare(`
      INSERT INTO alert_processing_records (id, alert_id, status, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(recordId, alertId, status);
  },

  /**
   * 保存策略决策（UPDATE strategy + decision_reason）
   * 对应：AlertProcessor.saveDecision
   */
  updateDecision(recordId: string, strategy: string, reason: string): void {
    db.prepare(`
      UPDATE alert_processing_records
      SET strategy = ?, decision_reason = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(strategy, reason, recordId);
  },

  /**
   * 更新最终处理状态（UPDATE 全部结果字段）
   * 对应：AlertProcessor.finalizeProcessingRecord
   */
  finalize(recordId: string, input: {
    status: string;
    execution_id?: string | null;
    task_id?: string | null;
    aars_log_id?: string | null;
    remediation_id?: string | null;
    error_message?: string | null;
  }): void {
    db.prepare(`
      UPDATE alert_processing_records
      SET status = ?,
          execution_id = ?,
          task_id = ?,
          aars_log_id = ?,
          remediation_id = ?,
          error_message = ?,
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.status,
      input.execution_id || null,
      input.task_id || null,
      input.aars_log_id || null,
      input.remediation_id || null,
      input.error_message || null,
      recordId
    );
  },

  /**
   * 按 alertId 查询最近一条处理记录
   * 对应：AlertProcessor.getRecordByAlertId
   */
  getByAlertId(alertId: string): AlertProcessingRecord | undefined {
    return db.prepare(
      'SELECT * FROM alert_processing_records WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(alertId) as AlertProcessingRecord | undefined;
  },
};
