/**
 * securityGate 第 1 层：只读模式（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L196-220 的 checkReadOnly 抽出
 * 在 enforceReadOnly 模式下，拒绝 非只读 + 非审批 的工具
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { RegisteredTool } from '../types';
import type { SecurityCheckResult, SecurityGateConfig } from './types';

/** 第 1 层：只读模式检查 */
export function checkReadOnly(
  config: SecurityGateConfig,
  tool: RegisteredTool,
): SecurityCheckResult {
  if (!config.enforceReadOnly) {
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
