/**
 * MCP Security Gate — 6 层安全防护
 *
 * 参照 sxdevops 的 Preflight 模式，结合 OWASP 对 AI 应用的安全建议
 *
 * ┌─────────────────────────────────────────────────┐
 * │  第 1 层：只读模式          — 默认拒绝写操作       │
 * │  第 2 层：破坏性审批        — 高风险操作需确认      │
 * │  第 3 层：参数注入检测      — 检测 Prompt Injection│
 * │  第 4 层：凭证泄露检测      — 输入/输出双向扫描     │
 * │  第 5 层：上下文隔离        — 用户间数据隔离        │
 * │  第 6 层：审计日志          — 全量调用记录          │
 * └─────────────────────────────────────────────────┘
 */

import {
  type RegisteredTool,
  type ToolCallContext,
  type ToolInput,
} from './types';
import { logger } from '../../../utils/logger';

// ============================================================
// 类型定义
// ============================================================

/** 安全检查结果 */
export interface SecurityCheckResult {
  /** 是否通过 */
  passed: boolean;
  /** 阻断原因 */
  reason?: string;
  /** 安全级别 */
  level?: 'block' | 'warn' | 'allow';
  /** 检测到的风险 */
  risks?: string[];
}

/** 安全门配置 */
export interface SecurityGateConfig {
  /** 默认只读模式（拒绝所有写操作） */
  enforceReadOnly: boolean;

  /** 破坏性操作是否需要审批 token */
  destructiveRequiresApprovalToken: boolean;

  /** 最大参数深度（防止嵌套注入） */
  maxArgDepth: number;

  /** 参数值最大长度 */
  maxArgValueLength: number;

  /** Prompt Injection 检测模式 */
  promptInjectionDetection: 'off' | 'warn' | 'block';

  /** 凭证泄露检测 */
  credentialLeakDetection: 'off' | 'warn' | 'block';

  /** 审计日志开关 */
  auditEnabled: boolean;
}

/** 审批票据 */
export interface ApprovalTicket {
  ticketId: string;
  toolName: string;
  userId: string;
  reason: string;
  createdAt: number;
  expiresAt: number;
  approved: boolean;
  approvedBy?: string;
}

// ============================================================
// Prompt Injection 模式库
// ============================================================

/**
 * 参考 OWASP LLM01 和 promptfoo 的标准注入检测模式
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    // "忽略之前的指令" 类
    pattern:
      /(ignore|forget|disregard|override)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|directions?|rules?|constraints?)/i,
    label: '指令覆盖尝试',
  },
  {
    // "你现在是" 角色劫持
    pattern:
      /(you\s+are\s+now|act\s+as\s+(a|an)|pretend\s+to\s+be|you\s+will\s+now\s+roleplay)/i,
    label: '角色劫持尝试',
  },
  {
    // "输出格式劫持"
    pattern:
      /(output|respond|reply)\s+(only|exclusively|just)\s+(as|in|with)/i,
    label: '输出格式劫持',
  },
  {
    // 系统提示词泄露
    pattern:
      /(system\s*(prompt|message|instruction)s?|隐藏的?\s*(指令|规则|提示))/i,
    label: '提示词探测',
  },
  {
    // 代码注入
    pattern:
      /\$\{.*\}|`[^`]*\$\([^)]*\)[^`]*`|eval\s*\(|system\s*\(|exec\s*\(|os\.system|subprocess/i,
    label: '代码注入尝试',
  },
  {
    // SQL 注入（参数中出现原始 SQL）
    pattern:
      /\b(UNION\s+SELECT|DROP\s+TABLE|ALTER\s+TABLE|INSERT\s+INTO\s+(USERS|ADMIN)|--\s*$)/i,
    label: 'SQL 注入尝试',
  },
  {
    // DAN / jailbreak
    pattern: /\b(DAN|jailbreak|developer\s*mode|god\s*mode|bypass|绕过)\b/i,
    label: '越狱尝试',
  },
];

// ============================================================
// 凭证模式库
// ============================================================

const CREDENTIAL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /sk-[a-zA-Z0-9]{32,}/, label: 'OpenAI API Key' },
  { pattern: /sk-ant-[a-zA-Z0-9-]{32,}/, label: 'Anthropic API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, label: 'GitHub Personal Access Token' },
  { pattern: /gho_[a-zA-Z0-9]{36}/, label: 'GitHub OAuth Token' },
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key ID' },
  {
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
    label: 'Private Key (PEM)',
  },
  {
    pattern: /ya29\.[0-9A-Za-z\-_]+/,
    label: 'Google OAuth Token',
  },
  { pattern: /xox[baprs]-[0-9A-Za-z-]+/, label: 'Slack Token' },
  {
    pattern: /(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i,
    label: '硬编码凭证',
  },
  {
    pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
    label: 'Bearer Token',
  },
];

// ============================================================
// SecurityGate 类
// ============================================================

export class SecurityGate {
  private config: SecurityGateConfig;

  /** 审批票据缓存（生产环境应放 Redis） */
  private approvalTickets: Map<string, ApprovalTicket> = new Map();

  /** 调用审计日志（生产环境应异步写入 DB） */
  private auditLog: Array<{
    timestamp: number;
    toolName: string;
    userId?: string;
    pass: boolean;
    reason?: string;
    argsSize: number;
  }> = [];

  constructor(config?: Partial<SecurityGateConfig>) {
    this.config = {
      enforceReadOnly: true,
      destructiveRequiresApprovalToken: true,
      maxArgDepth: 5,
      maxArgValueLength: 10_000,
      promptInjectionDetection: 'block',
      credentialLeakDetection: 'warn',
      auditEnabled: true,
      ...config,
    };
  }

  // ============================================================
  // 第 1 层：只读模式
  // ============================================================

  /**
   * 检查工具是否为只读操作
   * 在 enforceReadOnly 模式下，拒绝 非只读 + 非审批 的工具
   */
  private checkReadOnly(tool: RegisteredTool): SecurityCheckResult {
    if (!this.config.enforceReadOnly) {
      return { passed: true };
    }

    // 只读 -> 放行
    if (tool.annotations.readOnlyHint) {
      return { passed: true };
    }

    // 非只读但需要审批 -> 放行（由第 2 层接管）
    if (tool.annotations.requiresApproval) {
      return { passed: true };
    }

    // 写操作且不需要审批 -> 阻断
    return {
      passed: false,
      level: 'block',
      reason: `Tool "${tool.name}" is not read-only and requires approval. ` +
        `Current mode: enforceReadOnly. ` +
        `Risk: ${tool.annotations.riskLevel}. ` +
        `Set annotations.requiresApproval=true to allow with approval ticket.`,
    };
  }

  // ============================================================
  // 第 2 层：破坏性审批
  // ============================================================

  /**
   * 检查是否需要审批票据
   * 高危操作（风险 MEDIUM+ 且 requiresApproval=true）需要有效审批票据
   */
  private checkApproval(
    tool: RegisteredTool,
    context: ToolCallContext
  ): SecurityCheckResult {
    if (!tool.annotations.requiresApproval) {
      return { passed: true };
    }

    if (!this.config.destructiveRequiresApprovalToken) {
      return { passed: true };
    }

    // context 中可以携带审批票据
    const ticketId = (context.rawParams)
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

    const ticket = this.approvalTickets.get(ticketId);
    if (!ticket) {
      return {
        passed: false,
        level: 'block',
        reason: `Approval ticket "${ticketId}" not found.`,
      };
    }

    if (!ticket.approved) {
      return {
        passed: false,
        level: 'block',
        reason: `Approval ticket "${ticketId}" is not approved.`,
      };
    }

    if (Date.now() > ticket.expiresAt) {
      this.approvalTickets.delete(ticketId);
      return {
        passed: false,
        level: 'block',
        reason: `Approval ticket "${ticketId}" has expired.`,
      };
    }

    return { passed: true };
  }

  /**
   * 创建审批票据
   */
  createApprovalTicket(
    toolName: string,
    userId: string,
    reason: string,
    ttlMs = 300_000 // 默认 5 分钟
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
    this.approvalTickets.set(ticketId, ticket);
    logger.info(
      `Approval ticket created: ${ticketId} for tool "${toolName}" by ${userId}`
    );
    return ticket;
  }

  /**
   * 审批通过
   */
  approve(ticketId: string, approverId: string): boolean {
    const ticket = this.approvalTickets.get(ticketId);
    if (!ticket || Date.now() > ticket.expiresAt) return false;
    ticket.approved = true;
    ticket.approvedBy = approverId;
    logger.info(`Approval ticket ${ticketId} approved by ${approverId}`);
    return true;
  }

  // ============================================================
  // 第 3 层：Prompt Injection 检测
  // ============================================================

  /**
   * 递归扫描参数值，检测注入模式
   */
  private detectPromptInjection(
    args: ToolInput,
    depth = 0
  ): string[] {
    if (this.config.promptInjectionDetection === 'off') return [];

    const risks: string[] = [];
    if (depth > this.config.maxArgDepth) return risks;

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        // 检查长度
        if (value.length > this.config.maxArgValueLength) {
          risks.push(`参数 "${key}" 长度 ${value.length} 超出限制`);
        }
        // 检查注入模式
        for (const { pattern, label } of INJECTION_PATTERNS) {
          if (pattern.test(value)) {
            risks.push(`[${label}] 检测到: 参数 "${key}" 包含可疑内容`);
            // 只报第一个不重复的模式
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        risks.push(
          ...this.detectPromptInjection(
            value as Record<string, unknown>,
            depth + 1
          )
        );
      }
    }

    return risks;
  }

  // ============================================================
  // 第 4 层：凭证泄露检测
  // ============================================================

  /**
   * 扫描文本中的凭证模式
   */
  private detectCredentialLeak(text: string): string[] {
    if (this.config.credentialLeakDetection === 'off') return [];

    const findings: string[] = [];
    for (const { pattern, label } of CREDENTIAL_PATTERNS) {
      if (pattern.test(text)) {
        findings.push(`[${label}] 疑似凭证泄露`);
      }
    }
    return findings;
  }

  /**
   * 扫描工具输出结果中的凭证
   */
  private detectCredentialLeakInResult(
    result: { content?: Array<{ text?: string }> }
  ): string[] {
    if (!result.content) return [];
    const fullText = result.content
      .filter((c) => c.text)
      .map((c) => c.text)
      .join('\n');
    return this.detectCredentialLeak(fullText);
  }

  // ============================================================
  // 第 5 层：上下文隔离
  // ============================================================

  private checkContextIsolation(
    _tool: RegisteredTool,
    context: ToolCallContext
  ): SecurityCheckResult {
    // 如果提供了 userId，确保它在受限上下文内
    if (context.userId) {
      // 防止通过参数构造跨用户访问
      if (context.rawParams) {
        const rawUserId = (
          context.rawParams as Record<string, unknown>
        ).__user_id as string | undefined;
        if (rawUserId && rawUserId !== context.userId) {
          return {
            passed: false,
            level: 'block',
            reason: `Context isolation violation: cannot access resources of user "${rawUserId}" from user "${context.userId}"`,
          };
        }
      }
    }
    return { passed: true };
  }

  // ============================================================
  // 第 6 层：审计日志
  // ============================================================

  private audit(
    toolName: string,
    context: ToolCallContext,
    pass: boolean,
    reason?: string,
    args?: Record<string, unknown>
  ): void {
    if (!this.config.auditEnabled) return;

    this.auditLog.push({
      timestamp: Date.now(),
      toolName,
      userId: context.userId,
      pass,
      reason,
      argsSize: args ? JSON.stringify(args).length : 0,
    });

    // 阻断事件单独 INFO 日志
    if (!pass) {
      logger.warn(
        `[SecurityGate] BLOCKED: ${toolName} | user=${context.userId || 'anonymous'} | reason=${reason}`
      );
    }

    // 只保留最近 10,000 条（生产用队列异步写入）
    if (this.auditLog.length > 10_000) {
      this.auditLog = this.auditLog.slice(-5_000);
    }
  }

  // ============================================================
  // 主入口：完整安全检查
  // ============================================================

  /**
   * 对工具调用执行完整 6 层安全检查
   *
   * 调用链：只读检查 → 审批检查 → 注入检测 → 上下文隔离 →（执行）→ 凭证检测
   */
  check(
    tool: RegisteredTool,
    args: ToolInput,
    context: ToolCallContext
  ): SecurityCheckResult {
    // --- 第 1 层：只读模式 ---
    const readOnlyCheck = this.checkReadOnly(tool);
    if (!readOnlyCheck.passed) {
      this.audit(tool.name, context, false, readOnlyCheck.reason, args);
      return readOnlyCheck;
    }

    // --- 第 2 层：破坏性审批 ---
    const approvalCheck = this.checkApproval(tool, context);
    if (!approvalCheck.passed) {
      this.audit(tool.name, context, false, approvalCheck.reason, args);
      return approvalCheck;
    }

    // --- 第 3 层：Prompt Injection 检测 ---
    const injectionRisks = this.detectPromptInjection(args);
    if (injectionRisks.length > 0) {
      if (this.config.promptInjectionDetection === 'block') {
        const reason = `Prompt injection detected:\n${injectionRisks.join('\n')}`;
        this.audit(tool.name, context, false, reason, args);
        return {
          passed: false,
          level: 'block',
          reason,
          risks: injectionRisks,
        };
      }
      if (this.config.promptInjectionDetection === 'warn') {
        logger.warn(
          `[SecurityGate] Injection warning for ${tool.name}: ${injectionRisks.join(', ')}`
        );
      }
    }

    // --- 第 5 层：上下文隔离 ---
    const isolationCheck = this.checkContextIsolation(tool, context);
    if (!isolationCheck.passed) {
      this.audit(tool.name, context, false, isolationCheck.reason, args);
      return isolationCheck;
    }

    // --- 全部通过 ---
    this.audit(tool.name, context, true, undefined, args);
    return { passed: true };
  }

  /**
   * 对工具执行结果进行输出检测（第 4 层：凭证泄露）
   * 在工具调用完成后独立执行
   */
  checkOutput(
    tool: RegisteredTool,
    result: { content?: Array<{ text?: string }> }
  ): SecurityCheckResult {
    const credentialRisks = this.detectCredentialLeakInResult(result);
    if (credentialRisks.length > 0) {
      if (this.config.credentialLeakDetection === 'block') {
        return {
          passed: false,
          level: 'block',
          reason: `Credential leak detected in output:\n${credentialRisks.join('\n')}`,
          risks: credentialRisks,
        };
      }
      if (this.config.credentialLeakDetection === 'warn') {
        logger.warn(
          `[SecurityGate] Credential leak warning for ${tool.name}: ${credentialRisks.join(', ')}`
        );
      }
    }
    return { passed: true };
  }

  // ============================================================
  // 配置与管理
  // ============================================================

  /** 获取当前配置 */
  getConfig(): Readonly<SecurityGateConfig> {
    return { ...this.config };
  }

  /** 更新配置 */
  updateConfig(partial: Partial<SecurityGateConfig>): void {
    this.config = { ...this.config, ...partial };
    logger.info(`SecurityGate config updated: ${Object.keys(partial).join(', ')}`);
  }

  /** 获取最近的审计日志 */
  getAuditLog(limit = 50) {
    return this.auditLog.slice(-limit);
  }

  /** 获取审批票据状态 */
  getApprovalTicket(ticketId: string): ApprovalTicket | undefined {
    return this.approvalTickets.get(ticketId);
  }

  /** 清理过期审批票据 */
  cleanExpiredTickets(): number {
    const now = Date.now();
    let count = 0;
    for (const [id, ticket] of this.approvalTickets) {
      if (now > ticket.expiresAt) {
        this.approvalTickets.delete(id);
        count++;
      }
    }
    if (count > 0) {
      logger.debug(`Cleaned ${count} expired approval tickets`);
    }
    return count;
  }
}

// ============================================================
// 单例
// ============================================================

export const securityGate = new SecurityGate({
  enforceReadOnly: true,
  destructiveRequiresApprovalToken: true,
  promptInjectionDetection: 'block',
  credentialLeakDetection: 'warn',
  auditEnabled: true,
});
