/**
 * securityGate 6 层编排器（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L468-545 的 check + checkOutput 抽出
 *
 * 6 层顺序：
 *   L1 只读 → L2 审批 → L3 注入 → L5 上下文隔离 → (执行) → L4 输出凭证
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { logger } from '../../../../utils/logger';
import type { RegisteredTool, ToolInput, ToolCallContext } from '../types';
import type { SecurityCheckResult, SecurityGateConfig, ApprovalTicket } from './types';
import { checkReadOnly } from './layer1ReadOnly';
import { checkApproval } from './layer2Approval';
import { detectPromptInjection } from './layer3Injection';
import { detectCredentialLeakInResult } from './layer4CredentialLeak';
import { checkContextIsolation } from './layer5Isolation';
import { audit } from './layer6Audit';
import type { SecurityAuditEntry } from './layer6Audit';

export interface SecurityContext {
  config: SecurityGateConfig;
  approvalTickets: Map<string, ApprovalTicket>;
  auditLog: SecurityAuditEntry[];
}

/** 主入口：对工具调用执行完整 6 层安全检查 */
export function check(
  ctx: SecurityContext,
  tool: RegisteredTool,
  args: ToolInput,
  context: ToolCallContext,
): SecurityCheckResult {
  // --- 第 1 层：只读模式 ---
  const readOnlyCheck = checkReadOnly(ctx.config, tool);
  if (!readOnlyCheck.passed) {
    audit(ctx.auditLog, ctx.config, tool.name, context, false, readOnlyCheck.reason, args);
    return readOnlyCheck;
  }

  // --- 第 2 层：破坏性审批 ---
  const approvalCheck = checkApproval(ctx.config, ctx.approvalTickets, tool, context);
  if (!approvalCheck.passed) {
    audit(ctx.auditLog, ctx.config, tool.name, context, false, approvalCheck.reason, args);
    return approvalCheck;
  }

  // --- 第 3 层：Prompt Injection 检测 ---
  const injectionRisks = detectPromptInjection(ctx.config, args);
  if (injectionRisks.length > 0) {
    if (ctx.config.promptInjectionDetection === 'block') {
      const reason = `Prompt injection detected:\n${injectionRisks.join('\n')}`;
      audit(ctx.auditLog, ctx.config, tool.name, context, false, reason, args);
      return {
        passed: false,
        level: 'block',
        reason,
        risks: injectionRisks,
      };
    }
    if (ctx.config.promptInjectionDetection === 'warn') {
      logger.warn(
        `[SecurityGate] Injection warning for ${tool.name}: ${injectionRisks.join(', ')}`,
      );
    }
  }

  // --- 第 5 层：上下文隔离 ---
  const isolationCheck = checkContextIsolation(tool, context);
  if (!isolationCheck.passed) {
    audit(ctx.auditLog, ctx.config, tool.name, context, false, isolationCheck.reason, args);
    return isolationCheck;
  }

  // --- 全部通过 ---
  audit(ctx.auditLog, ctx.config, tool.name, context, true, undefined, args);
  return { passed: true };
}

/** 对工具执行结果进行输出检测（第 4 层：凭证泄露） */
export function checkOutput(
  ctx: SecurityContext,
  tool: RegisteredTool,
  result: { content?: Array<{ text?: string }> },
): SecurityCheckResult {
  const credentialRisks = detectCredentialLeakInResult(ctx.config, result);
  if (credentialRisks.length > 0) {
    if (ctx.config.credentialLeakDetection === 'block') {
      return {
        passed: false,
        level: 'block',
        reason: `Credential leak detected in output:\n${credentialRisks.join('\n')}`,
        risks: credentialRisks,
      };
    }
    if (ctx.config.credentialLeakDetection === 'warn') {
      logger.warn(
        `[SecurityGate] Credential leak warning for ${tool.name}: ${credentialRisks.join(', ')}`,
      );
    }
  }
  return { passed: true };
}
