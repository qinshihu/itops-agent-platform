// ── noiseReduction 子 repository ──

import db from '../../models/database';
import type { AlertNoiseReductionCreateInput, AlertNoiseReductionRecord } from './types';

export const noiseReductionRepo = {
  /**
   * 按 fingerprint 查询降噪记录
   * 对应：alertNoiseReductionService.processAlert
   */
  getByFingerprint(fingerprint: string): AlertNoiseReductionRecord | undefined {
    return db.prepare('SELECT * FROM alert_noise_reduction WHERE alert_fingerprint = ?').get(fingerprint) as AlertNoiseReductionRecord | undefined;
  },

  /**
   * 创建降噪记录（INSERT OR IGNORE）
   * 对应：alertNoiseReductionService.handleNewRecord
   * 返回受影响行数（0 表示已存在，调用方需回退到 handleExistingRecord）
   */
  create(input: AlertNoiseReductionCreateInput): number {
    const result = db.prepare(`
      INSERT OR IGNORE INTO alert_noise_reduction (id, alert_fingerprint, alert_source, alert_title, occurrence_count, first_occurrence, last_occurrence)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(input.id, input.alert_fingerprint, input.alert_source, input.alert_title, input.first_occurrence, input.last_occurrence) as { changes?: number } | undefined;
    return result?.changes ?? 1;
  },

  /**
   * 更新发生次数 + 最后发生时间
   * 对应：alertNoiseReductionService.handleExistingRecord
   */
  updateOccurrence(fingerprint: string, count: number, lastOccurrence: string): void {
    db.prepare('UPDATE alert_noise_reduction SET occurrence_count = ?, last_occurrence = ? WHERE alert_fingerprint = ?').run(count, lastOccurrence, fingerprint);
  },

  /**
   * 自动抑制（频繁告警）
   * 对应：alertNoiseReductionService.handleExistingRecord 的抑制分支
   */
  suppress(fingerprint: string, reason: string, until: string): void {
    db.prepare('UPDATE alert_noise_reduction SET is_suppressed = 1, suppression_reason = ?, suppression_until = ? WHERE alert_fingerprint = ?').run(reason, until, fingerprint);
  },

  /**
   * 手动抑制指定 fingerprint
   * 对应：alertNoiseReductionService.manuallySuppressAlert
   */
  manuallySuppress(fingerprint: string, reason: string, until: string): number {
    return db.prepare('UPDATE alert_noise_reduction SET is_suppressed = 1, suppression_reason = ?, suppression_until = ? WHERE alert_fingerprint = ?').run(reason, until, fingerprint).changes;
  },

  /**
   * 取消抑制
   * 对应：alertNoiseReductionService.unsuppressAlert
   */
  unsuppress(fingerprint: string): number {
    return db.prepare('UPDATE alert_noise_reduction SET is_suppressed = 0, suppression_reason = NULL, suppression_until = NULL WHERE alert_fingerprint = ?').run(fingerprint).changes;
  },

  /**
   * 降噪统计
   * 对应：alertNoiseReductionService.getNoiseReductionStats
   */
  getStats(): { total: number; suppressed: number; duplicates: number } {
    return db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN is_suppressed = 1 THEN 1 ELSE 0 END) as suppressed,
             SUM(occurrence_count - 1) as duplicates
      FROM alert_noise_reduction
    `).get() as { total: number; suppressed: number; duplicates: number };
  },

  /**
   * 列出已抑制的告警
   * 对应：alertNoiseReductionService.getSuppressedAlerts
   */
  listSuppressed(limit = 50): AlertNoiseReductionRecord[] {
    return db.prepare('SELECT * FROM alert_noise_reduction WHERE is_suppressed = 1 ORDER BY last_occurrence DESC LIMIT ?').all(limit) as AlertNoiseReductionRecord[];
  },

  /**
   * 清理旧记录
   * 对应：alertNoiseReductionService.cleanupOldRecords
   */
  cleanup(cutoffDate: string): number {
    return db.prepare('DELETE FROM alert_noise_reduction WHERE last_occurrence < ?').run(cutoffDate).changes;
  },
};