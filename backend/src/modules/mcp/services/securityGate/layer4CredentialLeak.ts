/**
 * securityGate 第 4 层：凭证泄露检测（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L372-396 的 2 个函数抽出：
 * - detectCredentialLeak: 扫描文本中的凭证模式
 * - detectCredentialLeakInResult: 扫描工具输出结果的凭证
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { SecurityGateConfig } from './types';
import { CREDENTIAL_PATTERNS } from './patterns';

/** 第 4 层：扫描文本中的凭证 */
export function detectCredentialLeak(
  config: SecurityGateConfig,
  text: string,
): string[] {
  if (config.credentialLeakDetection === 'off') return [];

  const findings: string[] = [];
  for (const { pattern, label } of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) {
      findings.push(`[${label}] 疑似凭证泄露`);
    }
  }
  return findings;
}

/** 第 4 层：扫描工具输出结果中的凭证 */
export function detectCredentialLeakInResult(
  config: SecurityGateConfig,
  result: { content?: Array<{ text?: string }> },
): string[] {
  if (!result.content) return [];
  const fullText = result.content
    .filter((c) => c.text)
    .map((c) => c.text)
    .join('\n');
  return detectCredentialLeak(config, fullText);
}
