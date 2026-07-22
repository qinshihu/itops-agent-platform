/**
 * vmManagementService 审计日志子模块（2026-07-21 拆分）
 *
 * 把主类 2 个审计方法抽为模块级纯函数：
 * - logAudit: 内部写日志
 * - getAuditLogs: 公开列出日志
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../../../utils/logger';
import { vmAuditLogRepository } from '../../../../../repositories';

export interface AuditLogEntry {
  id: string;
  platformId: string;
  vmId: string | null;
  vmName: string | null;
  operation: string;
  userId: string | null;
  username: string | null;
  parameters: Record<string, unknown> | null;
  result: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

/** 写一条审计日志（11 个参数原样保留，外部 API 不变） */
export function logAudit(
  platformId: string,
  vmId: string | null,
  vmName: string | null,
  operation: string,
  userId: string | null,
  username: string | null,
  parameters: Record<string, unknown> | null,
  result: string,
  status: 'success' | 'failed',
  errorMessage?: string,
  startedAt?: string,
  completedAt?: string,
): void {
  try {
    vmAuditLogRepository.create({
      id: randomUUID(),
      platform_id: platformId,
      vm_id: vmId,
      vm_name: vmName,
      operation,
      user_id: userId,
      username,
      parameters: parameters ? JSON.stringify(parameters) : null,
      result,
      status,
      error_message: errorMessage,
      started_at: startedAt,
      completed_at: completedAt,
    });
  } catch (error) {
    logger.error('❌ 记录审计日志失败:', error);
  }
}

/** 获取审计日志列表 */
export function getAuditLogs(
  platformId?: string,
  vmId?: string,
  limit = 100,
): Array<Record<string, unknown>> {
  try {
    const { rows } = vmAuditLogRepository.list({ platform_id: platformId, vm_id: vmId, page: 1, limit });
    return rows.map(row => ({
      id: row.id,
      platformId: row.platform_id,
      vmId: row.vm_id,
      vmName: row.vm_name,
      operation: row.operation,
      userId: row.user_id,
      username: row.username,
      parameters: row.parameters ? JSON.parse(row.parameters) : undefined,
      result: row.result,
      status: row.status,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));
  } catch (error) {
    logger.error('❌ 获取审计日志失败:', error);
    return [];
  }
}
