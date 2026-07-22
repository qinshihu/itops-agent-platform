/**
 * securityGate 第 3 层：Prompt Injection 检测（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L329-363 的 detectPromptInjection 抽出
 * 递归扫描参数值，检测注入模式
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { SecurityGateConfig } from './types';
import type { ToolInput } from '../types';
import { INJECTION_PATTERNS } from './patterns';

/** 第 3 层：递归扫描参数值检测注入 */
export function detectPromptInjection(
  config: SecurityGateConfig,
  args: ToolInput,
  depth = 0,
): string[] {
  if (config.promptInjectionDetection === 'off') return [];

  const risks: string[] = [];
  if (depth > config.maxArgDepth) return risks;

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      // 检查长度
      if (value.length > config.maxArgValueLength) {
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
        ...detectPromptInjection(
          config,
          value as Record<string, unknown>,
          depth + 1,
        ),
      );
    }
  }

  return risks;
}
