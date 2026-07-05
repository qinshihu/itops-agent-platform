/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import type { ChildProcess} from 'child_process';
import { spawn } from 'child_process';
import { logger } from '../../../../utils/logger';
import type { ExternalServerConfig } from './types';

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