/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import { logger } from '../../../../utils/logger';
import type { ExternalServerConfig } from './types';

// ============================================================
// SSE 传输实现
// ============================================================

export class SseTransport extends EventEmitter {
  private eventSource: any = null; // EventSource 或 fetch-based SSE
  private messageEndpoint = '';
  private baseUrl = '';
  private headers: Record<string, string> = {};
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private serverId: string) {
    super();
  }

  async connect(config: ExternalServerConfig): Promise<string> {
    if (!config.sse) throw new Error('SSE config required');

    this.baseUrl = config.sse.url;
    this.headers = config.sse.headers || {};
    this.connected = false;

    return new Promise((resolve, reject) => {
      // 使用 fetch + ReadableStream 模拟 SSE（Node.js 无原生 EventSource）
      this.connectSse(config, resolve, reject);
    });
  }

  private async connectSse(
    config: ExternalServerConfig,
    resolve: (url: string) => void,
    reject: (err: Error) => void
  ): Promise<void> {
    try {
      const sseUrl = config.sse!.url;
      logger.info(`[MCP Client:${this.serverId}] Connecting SSE to ${sseUrl}`);

      const response = await fetch(sseUrl, {
        headers: this.headers,
      });

      if (!response.ok || !response.body) {
        reject(new Error(`SSE connection failed: ${response.status}`));
        return;
      }

      this.connected = true;
      this.emit('sse:connected');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const readStream = async () => {
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('event: endpoint')) continue; // 下一行是 data
              if (line.startsWith('event: ')) {
                const _eventType = line.slice(7).trim();
                // 读取下一行的 data
                continue;
              }
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                // endpoint 事件：得到消息端点 URL
                if (data && !data.startsWith('{')) {
                  // 纯文本端点 URL
                  this.messageEndpoint = data.trim();
                  logger.info(
                    `[MCP Client:${this.serverId}] Message endpoint: ${this.messageEndpoint}`
                  );
                  resolve(this.messageEndpoint);
                } else if (data) {
                  // JSON 格式
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.method === 'endpoint') {
                      this.messageEndpoint = parsed.params?.uri || '';
                      resolve(this.messageEndpoint);
                    } else {
                      this.emit('sse:message', parsed);
                    }
                  } catch {
                    // 非 JSON，跳过
                  }
                }
              }
              // 心跳（以 : 开头）— 忽略
            }
          }

          // Stream ended
          this.connected = false;
          this.emit('sse:disconnected');
          logger.warn(`[MCP Client:${this.serverId}] SSE stream ended`);
        } catch (err) {
          this.connected = false;
          this.emit('sse:error', err);
          logger.error(`[MCP Client:${this.serverId}] SSE read error`, err as Error);
        }
      };

      readStream();
    } catch (err) {
      reject(err as Error);
    }
  }

  async send(message: object): Promise<object> {
    if (!this.messageEndpoint) {
      throw new Error('No message endpoint. Wait for SSE handshake.');
    }

    const url = this.messageEndpoint.startsWith('http')
      ? this.messageEndpoint
      : `${this.baseUrl.replace(/\/sse$/, '')}${this.messageEndpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Message send failed: ${response.status}`);
    }

    return response.json() as object;
  }

  disconnect(): void {
    this.connected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Node.js fetch ReadableStream 没有显式 close，靠 GC
    this.emit('sse:disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }
}