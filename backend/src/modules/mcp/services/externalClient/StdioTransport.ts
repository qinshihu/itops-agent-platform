/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import type { ChildProcess} from 'child_process';
import { spawn } from 'child_process';
import { logger } from '../../../../utils/logger';
import type { ExternalServerConfig } from './types';

// ============================================================
// 2026-07-21 P0-2 安全加固：stdio 命令白名单 + 参数长度限制（P0-2 ADR-024）
// ============================================================

/**
 * stdio 命令白名单：只允许这些程序被 spawn
 *
 * 黑名单思路太脆弱（要枚举所有危险命令），白名单思路更安全。
 * 新增 MCP server 时需要在此处显式登记。
 */
const STDIO_ALLOWED_COMMANDS = new Set([
  'npx',
  'node',
  'npm',
  'python3',
  'python',
  'uvx',
  'pipx',
  'deno',
  'bun',
]);

/** 单个参数最大长度（防御 argv 溢出攻击） */
const MAX_STDIO_ARG_LENGTH = 1024;

/** 最大参数个数（防御 argv 数量爆炸） */
const MAX_STDIO_ARG_COUNT = 32;

/** 黑名单参数：禁止传 file:// URL 或 shell 注入字符 */
const FORBIDDEN_ARG_PATTERNS = [
  /file:\/\//i,           // file:// URL (在字符类外 / 才不需要 escape)
  /--?\w*[;&|`$()<>]/,    // shell metacharacter in flag value
  /[\r\n\0]/,             // newline/null injection
];

function validateStdioCommand(command: string, args: string[]): void {
  // 1. 命令名白名单
  if (!STDIO_ALLOWED_COMMANDS.has(command)) {
    throw new Error(
      `[MCP Stdio 安全] 命令 "${command}" 不在白名单内（仅允许：${Array.from(STDIO_ALLOWED_COMMANDS).join(', ')}）`
    );
  }

  // 2. 路径白名单字符校验（拒绝包含 shell metacharacter）
  // 注：在字符类 [...] 中，`-` 放最末不需要 escape，`/` 不需要 escape
    if (!/^[a-zA-Z0-9._/-]+$/.test(command)) {
    throw new Error(
      `[MCP Stdio 安全] 命令名 "${command}" 含非法字符（只允许字母/数字/_/-/.//）`
    );
  }

  // 3. 参数个数限制
  if (args.length > MAX_STDIO_ARG_COUNT) {
    throw new Error(
      `[MCP Stdio 安全] 参数个数 ${args.length} 超过上限 ${MAX_STDIO_ARG_COUNT}`
    );
  }

  // 4. 每个参数做长度 + 危险内容检查
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg !== 'string') {
      throw new Error(`[MCP Stdio 安全] args[${i}] 不是 string 类型`);
    }
    if (arg.length > MAX_STDIO_ARG_LENGTH) {
      throw new Error(
        `[MCP Stdio 安全] args[${i}] 长度 ${arg.length} 超过上限 ${MAX_STDIO_ARG_LENGTH}`
      );
    }
    for (const pattern of FORBIDDEN_ARG_PATTERNS) {
      if (pattern.test(arg)) {
        throw new Error(
          `[MCP Stdio 安全] args[${i}] 命中危险模式：${pattern.source} → ${arg.slice(0, 80)}`
        );
      }
    }
  }
}

// ============================================================
// stdio 传输实现
// ============================================================

export class StdioTransport extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = '';
  private pendingRequests: Map<
    number | string,
    { resolve: (value: object) => void; reject: (err: Error) => void }
  > = new Map();
  private requestId = 0;
  private connected = false;

  constructor(private serverId: string) {
    super();
  }

  connect(config: ExternalServerConfig): Promise<void> {
    if (!config.stdio) throw new Error('stdio config required');

    return new Promise((resolve, reject) => {
      const { command, args = [], env = {}, cwd } = config.stdio!;
      // 2026-07-21 P0-2：spawn 前调白名单 + 参数校验，捕获即拒绝
      validateStdioCommand(command, args);

      logger.info(
        `[MCP Client:${this.serverId}] Spawning: ${command} ${args.join(' ')}`
      );

      this.process = spawn(command, args, {
        env: { ...process.env, ...env },
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
      });

      this.process.stderr?.on('data', (chunk: Buffer) => {
        logger.debug(
          `[MCP Client:${this.serverId}] stderr: ${chunk.toString().trim()}`
        );
      });

      this.process.on('error', (err) => {
        this.connected = false;
        logger.error(`[MCP Client:${this.serverId}] Process error`, err);
        this.emit('stdio:error', err);
        reject(err);
      });

      this.process.on('exit', (code) => {
        this.connected = false;
        logger.warn(
          `[MCP Client:${this.serverId}] Process exited with code ${code}`
        );
        this.emit('stdio:disconnected');
      });

      this.connected = true;
      this.emit('stdio:connected');
      resolve();
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        const id = message.id;
        if (id !== undefined && this.pendingRequests.has(id)) {
          const pending = this.pendingRequests.get(id)!;
          this.pendingRequests.delete(id);
          if (message.error) {
            pending.reject(new Error(message.error.message || 'JSON-RPC error'));
          } else {
            pending.resolve(message.result);
          }
        } else {
          this.emit('stdio:message', message);
        }
      } catch {
        logger.debug(
          `[MCP Client:${this.serverId}] Non-JSON stdout: ${line.substring(0, 100)}`
        );
      }
    }
  }

  async send(message: object): Promise<object> {
    if (!this.process || !this.connected) {
      throw new Error('Not connected');
    }

    const id = ++this.requestId;
    const request = { ...message, id: id as any };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out: ${id}`));
      }, 30_000);

      const originalResolve = resolve;
      const originalReject = reject;
      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timeout);
          originalResolve(val);
        },
        reject: (err) => {
          clearTimeout(timeout);
          originalReject(err);
        },
      });

      this.process!.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  disconnect(): void {
    this.connected = false;
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected && this.process !== null;
  }
}