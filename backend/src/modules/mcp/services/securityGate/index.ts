/**
 * securityGate 子模块 barrel export（2026-07-21 拆分）
 *
 * 上层调用：`from './securityGate'` 仍兼容（securityGate.ts 是 re-export）
 * 拆分后行为：
 * - 10 个子模块按 6 层架构 + 编排 + 类型 + 模式库分离
 * - 上层 import 路径不变
 */

// Types
export type { SecurityCheckResult, SecurityGateConfig, ApprovalTicket, SecurityLevel } from './types';
export { DEFAULT_SECURITY_GATE_CONFIG } from './types';

// Pattern 库
export { INJECTION_PATTERNS, CREDENTIAL_PATTERNS } from './patterns';

// 6 层 + 编排
export { checkReadOnly } from './layer1ReadOnly';
export {
  checkApproval,
  createApprovalTicket,
  approve,
  getApprovalTicket,
  cleanExpiredTickets,
} from './layer2Approval';
export { detectPromptInjection } from './layer3Injection';
export { detectCredentialLeak, detectCredentialLeakInResult } from './layer4CredentialLeak';
export { checkContextIsolation } from './layer5Isolation';
export {
  audit,
  getAuditLog,
  getConfig,
  updateConfig,
  type SecurityAuditEntry,
} from './layer6Audit';
export { check, checkOutput, type SecurityContext } from './orchestrator';
