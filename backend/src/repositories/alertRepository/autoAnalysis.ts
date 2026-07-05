// ── autoAnalysis 子 repository（alert_auto_analysis 表）──

import db from '../../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AlertAutoAnalysis } from '../types/alert';

/** alert_auto_analysis 表记录 */
export interface AutoAnalysisRecord {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: 'network_device' | 'server';
  status: 'pending' | 'running' | 'completed' | 'failed';
  diagnosis: string;
  summary: string;
  raw_output: string;
  commands_executed: string;
  error_message?: string | null;
  duration_ms: number;
  created_at: string;
}

/** 持久化输入（commands_executed 为已 JSON 序列化的字符串） */
export interface AutoAnalysisSaveInput {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: string;
  status: string;
  diagnosis: string | null;
  summary: string | null;
  raw_output: string | null;
  commands_executed: string;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

export const autoAnalysisRepo = {
  /**
   * 持久化分析记录（INSERT OR REPLACE）
   * 对应：resultWriter.saveRecord
   */
  save(input: AutoAnalysisSaveInput): void {
    db.prepare(`
      INSERT OR REPLACE INTO alert_auto_analysis
        (id, alert_id, device_id, device_name, device_ip, device_type, status, diagnosis, summary, raw_output, commands_executed, error_message, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.alert_id, input.device_id, input.device_name,
      input.device_ip, input.device_type, input.status,
      input.diagnosis, input.summary, input.raw_output,
      input.commands_executed, input.error_message,
      input.duration_ms, input.created_at
    );
  },

  /**
   * 获取分析记录列表（按 created_at 倒序）
   * 对应：resultWriter.getAnalysisHistory
   */
  list(limit = 50): AutoAnalysisRecord[] {
    return db.prepare(`
      SELECT * FROM alert_auto_analysis ORDER BY created_at DESC LIMIT ?
    `).all(limit) as AutoAnalysisRecord[];
  },

  /**
   * 根据告警 ID 获取最新分析记录
   * 对应：resultWriter.getByAlertId
   */
  getByAlertId(alertId: string): AutoAnalysisRecord | undefined {
    return db.prepare(
      'SELECT * FROM alert_auto_analysis WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(alertId) as AutoAnalysisRecord | undefined;
  },
};
