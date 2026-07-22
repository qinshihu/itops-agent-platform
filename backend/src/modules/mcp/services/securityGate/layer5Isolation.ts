/**
 * securityGate 第 5 层：上下文隔离（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L402-423 的 checkContextIsolation 抽出
 * 防止通过参数构造跨用户访问
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { RegisteredTool, ToolCallContext } from '../types';
import type { SecurityCheckResult } from './types';

/** 第 5 层：上下文隔离检查 */
export function checkContextIsolation(
  _tool: RegisteredTool,
  context: ToolCallContext,
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
