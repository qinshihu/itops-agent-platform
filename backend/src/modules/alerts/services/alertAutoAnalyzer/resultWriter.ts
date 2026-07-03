/**
 * 分析结果持久化与查询
 */

import { alertRepository } from '../../../../repositories';

// ====================== 类型定义 ======================

export interface AutoAnalysisResult {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: 'network_device' | 'server';
  status: 'pending' | 'running' | 'completed' | 'failed';
  diagnosis: string;           // AI 诊断结论
  summary: string;             // 简短摘要
  raw_output: string;          // SSH 原始输出
  commands_executed: string[]; // 执行的命令列表
  error_message?: string;
  duration_ms: number;
  created_at: string;
}

// ====================== 持久化 ======================

/** 持久化分析记录（INSERT OR REPLACE） */
export function saveRecord(record: AutoAnalysisResult): void {
  alertRepository.autoAnalysis.save({
    id: record.id,
    alert_id: record.alert_id,
    device_id: record.device_id,
    device_name: record.device_name,
    device_ip: record.device_ip,
    device_type: record.device_type,
    status: record.status,
    diagnosis: record.diagnosis || null,
    summary: record.summary || null,
    raw_output: record.raw_output || null,
    commands_executed: JSON.stringify(record.commands_executed),
    error_message: record.error_message || null,
    duration_ms: record.duration_ms,
    created_at: record.created_at,
  });
}

/** 获取分析记录列表 */
export function getAnalysisHistory(limit = 50): AutoAnalysisResult[] {
  const records = alertRepository.autoAnalysis.list(limit);
  return records.map(parseRecord);
}

/** 根据告警 ID 获取分析记录 */
export function getByAlertId(alertId: string): AutoAnalysisResult | undefined {
  const record = alertRepository.autoAnalysis.getByAlertId(alertId);
  return record ? parseRecord(record) : undefined;
}

/** 将数据库记录解析为 AutoAnalysisResult（反序列化 commands_executed） */
function parseRecord(record: ReturnType<typeof alertRepository.autoAnalysis.getByAlertId>): AutoAnalysisResult {
  if (!record) throw new Error('Record is undefined');
  let commands: string[] = [];
  try {
    commands = record.commands_executed ? JSON.parse(record.commands_executed) : [];
  } catch { /* ignore */ }
  return {
    id: record.id,
    alert_id: record.alert_id,
    device_id: record.device_id,
    device_name: record.device_name,
    device_ip: record.device_ip,
    device_type: record.device_type as 'network_device' | 'server',
    status: record.status as AutoAnalysisResult['status'],
    diagnosis: record.diagnosis || '',
    summary: record.summary || '',
    raw_output: record.raw_output || '',
    commands_executed: commands,
    error_message: record.error_message || undefined,
    duration_ms: record.duration_ms,
    created_at: record.created_at,
  };
}
