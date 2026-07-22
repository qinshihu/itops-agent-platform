/**
 * securityGate 第 2 层：破坏性审批（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L230-327 (含 getApprovalTicket / cleanExpiredTickets) 抽出
 * 高危操作（requiresApproval=true）需要有效审批票据
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { logger } from '../../../../utils/logger';
import type { RegisteredTool, ToolCallContext } from '../types';
import type { SecurityCheckResult, SecurityGateConfig, ApprovalTicket } from './types';

/** 第 2 层：检查是否需要审批票据 */
export function checkApproval(
  config: SecurityGateConfig,
  approvalTickets: Map<string, ApprovalTicket>,
  tool: RegisteredTool,
  context: ToolCallContext,
): SecurityCheckResult {
  if (!tool.annotations.requiresApproval) {
    return { passed: true };
  }

  if (!config.destructiveRequiresApprovalToken) {
    return { passed: true };
  }

  // context 中可以携带审批票据
  const ticketId = (context.rawParams as Record<string, unknown> | undefined)
    ?.__approval_ticket as string | undefined;
  if (!ticketId) {
    return {
      passed: false,
      level: 'block',
      reason:
        `Tool "${tool.name}" requires approval (risk: ${tool.annotations.riskLevel}). ` +
        `Provide __approval_ticket to execute.`,
    };
  }

  const ticket = approvalTickets.get(ticketId);
  if (!ticket) {
    return {
      passed: false,
      level: 'block',
      reason: `Invalid approval ticket: ${ticketId}`,
    };
  }
  if (!ticket.approved) {
    return {
      passed: false,
      level: 'block',
      reason: `Approval ticket ${ticketId} not yet approved`,
    };
  }
  if (Date.now() > ticket.expiresAt) {
    return {
      passed: false,
      level: 'block',
      reason: `Approval ticket ${ticketId} expired`,
    };
  }
  return { passed: true };
}

/** 创建审批票据 */
export function createApprovalTicket(
  approvalTickets: Map<string, ApprovalTicket>,
  toolName: string,
  userId: string,
  reason: string,
  ttlMs = 300_000, // 默认 5 分钟
): ApprovalTicket {
  const ticketId = `mcp_approval_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const ticket: ApprovalTicket = {
    ticketId,
    toolName,
    userId,
    reason,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    approved: false,
  };
  approvalTickets.set(ticketId, ticket);
  logger.info(
    `Approval ticket created: ${ticketId} for tool "${toolName}" by ${userId}`,
  );
  return ticket;
}

/** 审批通过 */
export function approve(
  approvalTickets: Map<string, ApprovalTicket>,
  ticketId: string,
  approverId: string,
): boolean {
  const ticket = approvalTickets.get(ticketId);
  if (!ticket || Date.now() > ticket.expiresAt) return false;
  ticket.approved = true;
  ticket.approvedBy = approverId;
  logger.info(`Approval ticket ${ticketId} approved by ${approverId}`);
  return true;
}

/** 获取审批票据 */
export function getApprovalTicket(
  approvalTickets: Map<string, ApprovalTicket>,
  ticketId: string,
): ApprovalTicket | undefined {
  return approvalTickets.get(ticketId);
}

/** 清理过期票据 */
export function cleanExpiredTickets(
  approvalTickets: Map<string, ApprovalTicket>,
): number {
  let count = 0;
  const now = Date.now();
  for (const [id, ticket] of approvalTickets) {
    if (now > ticket.expiresAt) {
      approvalTickets.delete(id);
      count++;
    }
  }
  if (count > 0) {
    logger.info(`Cleaned ${count} expired approval tickets`);
  }
  return count;
}
