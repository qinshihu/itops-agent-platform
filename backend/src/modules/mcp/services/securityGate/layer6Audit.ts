/**
 * securityGate 第 6 层：审计日志（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L428-457 + L552-565 的 audit + getConfig/getAuditLog 抽出
 * 全量审计日志（生产环境应异步写入 DB / Redis Stream）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { logger } from '../../../../utils/logger';
import type { ToolCallContext } from '../types';
import type { SecurityGateConfig } from './types';

/** 审计日志条目（运行时结构） */
export interface SecurityAuditEntry {
  timestamp: number;
  toolName: string;
  userId?: string;
  pass: boolean;
  reason?: string;
  argsSize: number;
}

/** 第 6 层：写审计日志（含阻断事件 INFO 单独记录） */
export function audit(
  auditLog: SecurityAuditEntry[],
  config: SecurityGateConfig,
  toolName: string,
  context: ToolCallContext,
  pass: boolean,
  reason?: string,
  args?: Record<string, unknown>,
): void {
  if (!config.auditEnabled) return;

  auditLog.push({
    timestamp: Date.now(),
    toolName,
    userId: context.userId,
    pass,
    reason,
    argsSize: args ? JSON.stringify(args).length : 0,
  });

  // 阻断事件单独 WARN 日志
  if (!pass) {
    logger.warn(
      `[SecurityGate] BLOCKED: ${toolName} | user=${context.userId || 'anonymous'} | reason=${reason}`,
    );
  }

  // 只保留最近 10,000 条（生产用队列异步写入）
  if (auditLog.length > 10_000) {
    auditLog.splice(0, auditLog.length - 5_000);
  }
}

/** 获取最近的审计日志 */
export function getAuditLog(auditLog: SecurityAuditEntry[], limit = 50): SecurityAuditEntry[] {
  return auditLog.slice(-limit);
}

/** 拷贝配置（避免外部 mutation） */
export function getConfig(config: SecurityGateConfig): Readonly<SecurityGateConfig> {
  return { ...config };
}

/** 增量更新配置 */
export function updateConfig(
  config: SecurityGateConfig,
  partial: Partial<SecurityGateConfig>,
): SecurityGateConfig {
  const next = { ...config, ...partial };
  logger.info(`SecurityGate config updated: ${Object.keys(partial).join(', ')}`);
  return next;
}
