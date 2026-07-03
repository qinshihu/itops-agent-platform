/**
 * 告警抓取与去重逻辑
 */

import { alertRepository } from '../../../../repositories';

/** 查找未分析的高优告警，排除正在处理中的 */
export function fetchPendingAlerts(processingIds: Set<string>): { id: string; title: string; severity: string; source: string }[] {
  const rows = alertRepository.listPendingForAutoAnalysis();
  return rows.filter((r: { id: string }) => !processingIds.has(r.id));
}

/** 检查告警是否已被 AARS v2 处理（去重，避免重复分析） */
export function isAlreadyProcessedByAARS(alertId: string): boolean {
  try {
    return alertRepository.aarsLogs.existsProcessedByAlertId(alertId);
  } catch {
    return false;
  }
}
