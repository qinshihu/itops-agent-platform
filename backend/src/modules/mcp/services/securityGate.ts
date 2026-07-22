/**
 * SecurityGate 主类（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 securityGate.ts 600 行包含：
 *   - 3 个 interface (SecurityCheckResult / SecurityGateConfig / ApprovalTicket)
 *   - INJECTION_PATTERNS / CREDENTIAL_PATTERNS 模式库
 *   - 6 层安全检查（只读/审批/注入/凭证/隔离/审计）
 *   - 6 层编排器 check + checkOutput
 *   - 配置 getter/setter
 *
 * 拆分后行为：
 *   - 10 个子文件按 6 层 + orchestrator + types + patterns 分离（见 securityGate/）
 *   - 主类保留所有公开方法签名 100% 兼容
 *   - 每个 method 1-line delegate 转发到子模块
 *   - 所有 mutable state (config / approvalTickets / auditLog) 通过 SecurityContext 上下文传递
 *
 * 外部 `import { securityGate, SecurityGate } from './securityGate'` 仍兼容
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { RegisteredTool, ToolInput, ToolCallContext } from './types';
import { DEFAULT_SECURITY_GATE_CONFIG } from './securityGate/types';
import type { SecurityCheckResult, SecurityGateConfig, ApprovalTicket } from './securityGate/types';
import { checkReadOnly } from './securityGate/layer1ReadOnly';
import {
  checkApproval,
  createApprovalTicket,
  approve,
  getApprovalTicket,
  cleanExpiredTickets,
} from './securityGate/layer2Approval';
import { detectPromptInjection } from './securityGate/layer3Injection';
import {
  detectCredentialLeak,
  detectCredentialLeakInResult,
} from './securityGate/layer4CredentialLeak';
import { checkContextIsolation } from './securityGate/layer5Isolation';
import type { SecurityAuditEntry } from './securityGate/layer6Audit';
import {
  audit as auditFn,
  getAuditLog as getAuditLogFn,
  getConfig as getConfigFn,
  updateConfig as updateConfigFn,
} from './securityGate/layer6Audit';
import type { SecurityContext } from './securityGate/orchestrator';
import { check as checkFn, checkOutput as checkOutputFn } from './securityGate/orchestrator';

// 重新导出类型与子模块 symbols（桶兼容）
export type {
  SecurityCheckResult,
  SecurityGateConfig,
  ApprovalTicket,
  SecurityLevel,
} from './securityGate/types';
export { DEFAULT_SECURITY_GATE_CONFIG } from './securityGate/types';
export { INJECTION_PATTERNS, CREDENTIAL_PATTERNS } from './securityGate/patterns';

export class SecurityGate {
  private ctx: SecurityContext;

  constructor(config?: Partial<SecurityGateConfig>) {
    this.ctx = {
      config: { ...DEFAULT_SECURITY_GATE_CONFIG, ...(config || {}) },
      approvalTickets: new Map<string, ApprovalTicket>(),
      auditLog: [],
    };
  }

  // ============================================================
  // 6 层检查（保留为公开方法，外部 tests/diagnostic 调用）
  // ============================================================

  checkReadOnlyPublic(tool: RegisteredTool): SecurityCheckResult {
    return checkReadOnly(this.ctx.config, tool);
  }

  checkApprovalPublic(tool: RegisteredTool, context: ToolCallContext): SecurityCheckResult {
    return checkApproval(this.ctx.config, this.ctx.approvalTickets, tool, context);
  }

  detectPromptInjectionPublic(args: ToolInput, depth?: number): string[] {
    return detectPromptInjection(this.ctx.config, args, depth);
  }

  detectCredentialLeakPublic(text: string): string[] {
    return detectCredentialLeak(this.ctx.config, text);
  }

  detectCredentialLeakInResultPublic(result: { content?: Array<{ text?: string }> }): string[] {
    return detectCredentialLeakInResult(this.ctx.config, result);
  }

  checkContextIsolationPublic(tool: RegisteredTool, context: ToolCallContext): SecurityCheckResult {
    return checkContextIsolation(tool, context);
  }

  private audit(
    toolName: string,
    context: ToolCallContext,
    pass: boolean,
    reason?: string,
    args?: Record<string, unknown>,
  ): void {
    auditFn(this.ctx.auditLog, this.ctx.config, toolName, context, pass, reason, args);
  }

  // ============================================================
  // 主入口：完整安全检查（6 层编排）
  // ============================================================

  check(tool: RegisteredTool, args: ToolInput, context: ToolCallContext): SecurityCheckResult {
    return checkFn(this.ctx, tool, args, context);
  }

  checkOutput(
    tool: RegisteredTool,
    result: { content?: Array<{ text?: string }> },
  ): SecurityCheckResult {
    return checkOutputFn(this.ctx, tool, result);
  }

  // ============================================================
  // 审批票据管理
  // ============================================================

  createApprovalTicket(
    toolName: string,
    userId: string,
    reason: string,
    ttlMs?: number,
  ): ApprovalTicket {
    return createApprovalTicket(this.ctx.approvalTickets, toolName, userId, reason, ttlMs);
  }

  approve(ticketId: string, approverId: string): boolean {
    return approve(this.ctx.approvalTickets, ticketId, approverId);
  }

  getApprovalTicket(ticketId: string): ApprovalTicket | undefined {
    return getApprovalTicket(this.ctx.approvalTickets, ticketId);
  }

  cleanExpiredTickets(): number {
    return cleanExpiredTickets(this.ctx.approvalTickets);
  }

  // ============================================================
  // 配置管理
  // ============================================================

  getConfig(): Readonly<SecurityGateConfig> {
    return getConfigFn(this.ctx.config);
  }

  updateConfig(partial: Partial<SecurityGateConfig>): void {
    this.ctx.config = updateConfigFn(this.ctx.config, partial);
  }

  // ============================================================
  // 审计日志
  // ============================================================

  getAuditLog(limit?: number): SecurityAuditEntry[] {
    return getAuditLogFn(this.ctx.auditLog, limit);
  }
}

// 单例（保留 backward compat）
export const securityGate = new SecurityGate({
  enforceReadOnly: true,
  destructiveRequiresApprovalToken: true,
  promptInjectionDetection: 'block',
  credentialLeakDetection: 'warn',
  maxArgDepth: 5,
  maxArgValueLength: 10_000,
  auditEnabled: true,
});
