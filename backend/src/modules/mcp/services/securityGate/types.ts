/**
 * securityGate 类型定义（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L28-73 的 4 个 interface 抽出：
 * - SecurityCheckResult：安全检查结果
 * - SecurityGateConfig：安全门配置
 * - ApprovalTicket：审批票据
 * - SecurityLevel：门控级别（type alias）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

/** 检测到的安全级别 */
export type SecurityLevel = 'block' | 'warn' | 'allow';

/** 安全检查结果 */
export interface SecurityCheckResult {
  /** 是否通过 */
  passed: boolean;
  /** 阻断原因 */
  reason?: string;
  /** 安全级别 */
  level?: SecurityLevel;
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

/** 默认安全门配置 */
export const DEFAULT_SECURITY_GATE_CONFIG: SecurityGateConfig = {
  enforceReadOnly: true,
  destructiveRequiresApprovalToken: true,
  maxArgDepth: 5,
  maxArgValueLength: 10_000,
  promptInjectionDetection: 'block',
  credentialLeakDetection: 'warn',
  auditEnabled: true,
};
