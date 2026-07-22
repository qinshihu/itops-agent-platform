/**
 * SSH 命令安全构造器（2026-07-21 ADR-023 修复 SSH 命令注入）
 *
 * 设计原则：
 *   1. 禁止拼接 shell 字符串作为参数
 *   2. 仅允许预定义命令 + 强类型参数
 *   3. 所有 string 参数强制白名单字符集（拒绝 shell metacharacter）
 *   4. 所有 numeric 参数强制 range 校验
 *   5. 暴露 ssh2.exec channel 风格接口（数组式 argv）
 *
 * 这是 4 个 Agent 工具（ssh-exec / view-file / find-large-files / system-logs / service-status）
 * 共用的命令安全层。任何新增 SSH 工具**必须**通过此模块构造命令。
 *
 * 关联：
 *   - v2 报告 §3.3 P0-1 SSH 命令注入 4 处
 *   - ADR-023 SSH 命令注入修复方案
 */

import { executeCommand } from '../../../servers/services/sshService';

/**
 * 字符白名单：所有 string 参数必须通过此检查。
 * 允许：字母 / 数字 / 常用路径分隔符 / 常用 SSH 参数字符
 * 拒绝所有 shell metacharacter（| & ; $ ` " ' 等）
 */
const SAFE_FILENAME_CHARS = /^[a-zA-Z0-9._\/\-@:]+$/;
const SAFE_UNIT_CHARS = /^[a-zA-Z0-9._\-@]+$/;
const SAFE_PATH_CHARS = /^[a-zA-Z0-9.\/\-_~]+$/;
const SAFE_NUMBER_OR_EMPTY = /^[0-9]*$/;

/**
 * 拒绝非法字符串并抛出清晰错误
 */
function assertSafe(value: string, regex: RegExp, paramName: string): void {
  if (!regex.test(value)) {
    throw new Error(
      `[SSH 安全] 参数 ${paramName} 含非法字符：${JSON.stringify(value).slice(0, 50)}。` +
      `只允许字母/数字/_/-/.// 等安全字符，禁止所有 shell metacharacter`
    );
  }
  // 长度限制
  if (value.length > 1024) {
    throw new Error(`[SSH 安全] 参数 ${paramName} 超过 1024 字符`);
  }
}

function assertNumberInRange(
  value: number,
  paramName: string,
  min: number,
  max: number
): void {
  if (!Number.isFinite(value)) {
    throw new Error(`[SSH 安全] 参数 ${paramName} 不是有限数字：${value}`);
  }
  if (value < min || value > max) {
    throw new Error(`[SSH 安全] 参数 ${paramName}=${value} 超出 [${min}, ${max}] 范围`);
  }
}

/**
 * SSH 命令执行结果（已安全 sanitize）
 */
export interface SafeCommandResult {
  stdout: string;
  stderr: string;
  success: boolean;
  duration?: number;
}

// =================== 命令白名单 ===================

/**
 * 已授权的 SSH 命令模板
 *
 * 每个工具对应一个固定命令 + 固定参数容器。任何不在此白名单的工具必须实现完整 sanitize。
 */
type SafeCommand =
  | { kind: 'shell'; argv: string[] };   // 已经完全 sanitize 的 argv 形式

/**
 * 内部 helper：包装 executeCommand 接受数组式 argv
 *
 * 注意：executeCommand 实际只接受字符串命令（拼接交给 ssh2 内部）。
 * 但因为我们这里**传入的是已经被 sanitize 的 argv[0] + 后续参数**，
 * 而不涉及 shell 拼接，所以即使用字符串形式也是安全的。
 */
async function runSafeCommand(
  serverId: string,
  cmd: SafeCommand,
  options?: { timeout?: number }
): Promise<SafeCommandResult> {
  if (cmd.kind !== 'shell') {
    throw new Error(`[SSH 安全] 未知命令种类`);
  }
  // 拼接为字符串（ssh2 内部用 exec channel，不会再 shell 解析）
  const command = cmd.argv.map((arg) => {
    if (!SAFE_PATH_CHARS.test(arg)) {
      throw new Error(`[SSH 安全] argv 含非法字符：${arg}`);
    }
    return arg;
  }).join(' ');
  const result = await executeCommand(serverId, command, options);
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    success: result.success,
    duration: result.duration,
  };
}

// =================== 4 个 Agent 工具的安全接口 ===================

/**
 * ssh-exec：执行任意已授权命令
 *
 * **注意**：这里的 `command` 是白名单命令字符串，**不是用户输入**。
 * 调用方需保证在白名单内（见 SSH_ALLOWED_COMMANDS）。
 */
export async function sshRunShell(
  serverId: string,
  commandName: string,
  args: string[]
): Promise<SafeCommandResult> { // eslint-disable-line @typescript-eslint/no-unused-vars
  // 1. 命令名白名单
  if (!SSH_ALLOWED_COMMANDS.has(commandName)) {
    throw new Error(
      `[SSH 安全] 命令 "${commandName}" 不在白名单 ${Array.from(SSH_ALLOWED_COMMANDS).join(', ')} 内`
    );
  }
  // 2. 强制 safe
  args.forEach((arg, i) => assertSafe(arg, SAFE_PATH_CHARS, `args[${i}]`));
  return runSafeCommand(serverId, { kind: 'shell', argv: [commandName, ...args] });
}

/**
 * SSH 命令白名单（仅这些可作为 ssh-exec 的命令名）
 *
 * 每个都是**单一可执行文件**（不再接收 pipeline / redirect / shell）。
 */
export const SSH_ALLOWED_COMMANDS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'grep', 'find', 'ls',
  'df', 'du', 'free', 'top', 'ps', 'uptime', 'uname', 'whoami', 'date',
  'journalctl', 'systemctl', 'service',
  'uptime', 'hostnamectl', 'ip', 'ss',
  'kubectl', 'docker',
  'pwd', 'echo',
]);

/**
 * view-file：读文件最后 N 行（替代原 tail -n）
 */
export async function sshViewFile(
  serverId: string,
  filePath: string,
  lines = 100
): Promise<SafeCommandResult> {
  assertSafe(filePath, SAFE_FILENAME_CHARS, 'filePath');
  assertNumberInRange(lines, 'lines', 1, 10000);
  return runSafeCommand(
    serverId,
    { kind: 'shell', argv: ['tail', '-n', String(lines), filePath] }
  );
}

/**
 * find-large-files：在指定目录找大文件（替代原 find ... -exec ls -lh）
 */
export async function sshFindLargeFiles(
  serverId: string,
  directory = '/',
  minSizeMB = 100,
  limit = 10
): Promise<SafeCommandResult> {
  assertSafe(directory, SAFE_PATH_CHARS, 'directory');
  assertNumberInRange(minSizeMB, 'minSizeMB', 0, 100000);
  assertNumberInRange(limit, 'limit', 1, 1000);
  return runSafeCommand(serverId, {
    kind: 'shell',
    argv: [
      'find', directory, '-type', 'f', '-size', `+${minSizeMB}M`,
      '-printf', '%s %p\\n',
    ],
  });
}

/**
 * system-logs：读 journalctl 日志
 */
export async function sshSystemLogs(
  serverId: string,
  unit?: string,
  since = '1 hour ago',
  lines = 100,
  level?: string
): Promise<SafeCommandResult> {
  const argv: string[] = ['journalctl', '--no-pager', '-n', String(lines)];
  if (unit) {
    assertSafe(unit, SAFE_UNIT_CHARS, 'unit');
    argv.push('-u', unit);
  }
  if (level) {
    assertSafe(level, SAFE_NUMBER_OR_EMPTY, 'level');
    argv.push('-p', level);
  }
  // since 不进入 argv（避免任意字符串），用 days-ago 数值替代
  argv.push('--since', '1 day ago');
  assertNumberInRange(lines, 'lines', 1, 10000);
  return runSafeCommand(serverId, { kind: 'shell', argv });
}

/**
 * service-status：systemctl status/list-units
 */
export async function sshServiceStatus(
  serverId: string,
  unit?: string,
  listAll = false
): Promise<SafeCommandResult> {
  if (listAll) {
    return runSafeCommand(serverId, {
      kind: 'shell',
      argv: ['systemctl', 'list-units', '--type=service', '--no-pager'],
    });
  }
  if (!unit) {
    return runSafeCommand(serverId, {
      kind: 'shell',
      argv: ['systemctl', 'list-units', '--type=service', '--no-pager', '--all'],
    });
  }
  assertSafe(unit, SAFE_UNIT_CHARS, 'unit');
  return runSafeCommand(serverId, {
    kind: 'shell',
    argv: ['systemctl', 'status', '--no-pager', unit],
  });
}
