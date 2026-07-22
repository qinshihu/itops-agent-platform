/**
 * securityGate 检测模式库（2026-07-21 拆分）
 *
 * 把原 securityGate.ts L75-153 的 2 套模式库抽出：
 * - INJECTION_PATTERNS: Prompt Injection 检测（参考 OWASP LLM01 + promptfoo 标准）
 * - CREDENTIAL_PATTERNS: 凭证泄露检测（覆盖主流云厂商）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

/** Prompt Injection 检测模式库 */
export const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
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

/** 凭证检测模式库 */
export const CREDENTIAL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
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
