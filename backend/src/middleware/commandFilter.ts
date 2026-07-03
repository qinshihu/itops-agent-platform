import { parse as parseShell } from 'shell-quote';

export interface CommandPolicy {
  name: string;
  description: string;
  action: 'block' | 'warn' | 'allow';
  blockedRoles: string[];
}

// 危险命令名集合（不再用正则锚定完整命令行）
const DANGEROUS_COMMAND_NAMES = new Map<string, CommandPolicy>([
  ['rm', { name: 'filesystem_destructive', description: '破坏性文件系统操作', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['dd', { name: 'filesystem_destructive', description: '破坏性文件系统操作', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['shred', { name: 'filesystem_destructive', description: '破坏性文件系统操作', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['mkfs', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['fdisk', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['parted', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['cryptsetup', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['lvremove', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['vgremove', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['iptables', { name: 'network_destructive', description: '网络破坏性操作', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['ip', { name: 'network_destructive', description: '网络破坏性操作', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['tc', { name: 'network_destructive', description: '网络破坏性操作', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['kill', { name: 'process_kill', description: '批量终止进程', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['killall', { name: 'process_kill', description: '批量终止进程', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['pkill', { name: 'process_kill', description: '批量终止进程', action: 'block', blockedRoles: ['viewer', 'operator'] }],
  ['reboot', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['shutdown', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['halt', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
  ['init', { name: 'system_critical', description: '系统关键操作', action: 'block', blockedRoles: ['viewer', 'operator', 'admin'] }],
]);

// 凭据访问关键词（warn 级别）
const CREDENTIAL_PATTERNS: Array<{ pattern: RegExp; policy: CommandPolicy }> = [
  { pattern: /\/etc\/shadow/, policy: { name: 'credential_access', description: '凭据访问尝试', action: 'warn', blockedRoles: ['viewer'] } },
  { pattern: /\/etc\/passwd/, policy: { name: 'credential_access', description: '凭据访问尝试', action: 'warn', blockedRoles: ['viewer'] } },
  { pattern: /\.pem\b/, policy: { name: 'credential_access', description: '凭据访问尝试', action: 'warn', blockedRoles: ['viewer'] } },
  { pattern: /id_rsa/, policy: { name: 'credential_access', description: '凭据访问尝试', action: 'warn', blockedRoles: ['viewer'] } },
  { pattern: /\.key\b/, policy: { name: 'credential_access', description: '凭据访问尝试', action: 'warn', blockedRoles: ['viewer'] } },
  { pattern: /\bPASSWORD\b/i, policy: { name: 'credential_access', description: '凭据访问尝试', action: 'warn', blockedRoles: ['viewer'] } },
  { pattern: /\bSECRET\b/i, policy: { name: 'credential_access', description: '凭据访问尝试', action: 'warn', blockedRoles: ['viewer'] } },
];

// 权限提升命令（warn 级别）
const PRIVILEGE_ESCALATION = new Set(['su', 'sudo']);

// 命令链操作符
const CHAIN_OPERATORS = new Set([';', '&&', '||', '|']);

/**
 * 将命令字符串按操作符分割为独立段
 * 返回每段的命令名（第一个 token）
 */
function extractCommandSegments(command: string): string[] {
  let tokens: ReturnType<typeof parseShell>;
  try {
    tokens = parseShell(command);
  } catch {
    // 解析失败时回退到简单空格分割
    return command.trim().split(/\s+/).filter(Boolean);
  }

  const segments: string[] = [];
  let currentCmd = '';

  for (const token of tokens) {
    if (typeof token === 'string') {
      if (CHAIN_OPERATORS.has(token)) {
        if (currentCmd) segments.push(currentCmd);
        currentCmd = '';
      } else if (!currentCmd) {
        currentCmd = token;
      }
    }
    // 忽略 shell-quote 的特殊 token 类型（如 'glob', 'redirect' 等）
  }
  if (currentCmd) segments.push(currentCmd);

  return segments;
}

/**
 * 剥离 sudo 前缀，返回实际命令
 */
function stripSudo(cmd: string): string {
  return cmd.replace(/^(?:sudo(?:\s+-\w+(?:\s+\S+)?)?\s+)+/, '').trim();
}

export function checkCommandSafety(
  command: string,
  userRole: string
): {
  allowed: boolean;
  severity: 'blocked' | 'warning' | 'safe';
  reason?: string;
  policy?: string;
} {
  if (!command || !command.trim()) {
    return { allowed: true, severity: 'safe' };
  }

  const trimmed = command.trim();

  // ── 1. 检测子 shell 执行 $(...) 和反引号 ──
  if (/\$\(/.test(trimmed) || /`/.test(trimmed)) {
    // 子 shell 中可能包含任意命令，检查子 shell 内容
    const subShellContent = trimmed.match(/\$\(([^)]+)\)/g) || trimmed.match(/`([^`]+)`/g) || [];
    for (const sub of subShellContent) {
      const innerCmd = sub.replace(/^\$\(|\)$/g, '').replace(/^`|`$/g, '').trim();
      const innerResult = checkCommandSafety(innerCmd, userRole);
      if (innerResult.severity === 'blocked') {
        return {
          allowed: false,
          severity: 'blocked',
          reason: `子 shell 中包含禁止操作: ${innerResult.reason}`,
          policy: 'subshell_injection',
        };
      }
    }
    // 子 shell 内容本身不危险但仍允许执行
  }

  // ── 2. 检测 base64/hex 解码管道（常见绕过手段）──
  if (/base64\s+-d\s*\|/.test(trimmed) || /xxd\s+-r\s*-p\s*\|/.test(trimmed)) {
    return {
      allowed: false,
      severity: 'blocked',
      reason: '禁止使用 base64/hex 解码管道执行命令',
      policy: 'encoding_bypass',
    };
  }

  // ── 3. 检测管道到 shell 的操作（curl/wget | sh）──
  if (/(?:curl|wget)\s+.*\|\s*(?:ba)?sh/.test(trimmed)) {
    return {
      allowed: false,
      severity: 'blocked',
      reason: '禁止从网络下载脚本直接执行',
      policy: 'remote_script_execution',
    };
  }

  // ── 4. 按操作符分割，对每段独立检查命令名 ──
  const segments = extractCommandSegments(trimmed);

  for (const segment of segments) {
    // 剥离 sudo 前缀
    const cmdName = stripSudo(segment).split(/\s+/)[0];

    if (!cmdName) continue;

    // 检查危险命令名
    const policy = DANGEROUS_COMMAND_NAMES.get(cmdName);
    if (policy && policy.blockedRoles.includes(userRole)) {
      if (policy.action === 'block') {
        return {
          allowed: false,
          severity: 'blocked',
          reason: `禁止操作: ${policy.description} (${cmdName})`,
          policy: policy.name,
        };
      }
    }

    // 检查权限提升
    if (PRIVILEGE_ESCALATION.has(cmdName) && userRole === 'viewer') {
      return {
        allowed: true,
        severity: 'warning',
        reason: `警告: 权限提升尝试 (${cmdName})`,
        policy: 'privilege_escalation',
      };
    }
  }

  // ── 5. 检查凭据访问模式（对完整命令字符串）──
  for (const { pattern, policy } of CREDENTIAL_PATTERNS) {
    if (pattern.test(trimmed) && policy.blockedRoles.includes(userRole)) {
      return {
        allowed: true,
        severity: 'warning',
        reason: `警告: ${policy.description}`,
        policy: policy.name,
      };
    }
  }

  return { allowed: true, severity: 'safe' };
}
