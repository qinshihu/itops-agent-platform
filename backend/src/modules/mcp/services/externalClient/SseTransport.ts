/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import { logger } from '../../../../utils/logger';
import type { ExternalServerConfig } from './types';

// ============================================================
// 2026-07-21 P0-3 安全加固：SSE URL SSRF 防护（ADR-024）
// ============================================================

import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * 检查 URL 是否指向内网（拒绝向内网/loopback/link-local 发起请求）
 *
 * 拒绝列表：
 *   - loopback：127.0.0.0/8、localhost
 *   - RFC1918 私网：10.0.0.0/8、172.16.0.0/12、192.168.0.0/16
 *   - link-local：169.254.0.0/16
 *   - IPv6 loopback：::1
 *   - IPv6 私网：fc00::/7
 *   - 各种保留地址：0.0.0.0/8、224.0.0.0/4（多播）、240.0.0.0/4（保留）
 */
async function assertSseUrlSafe(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[MCP SSRF 防护] URL 格式不合法：${url}`);
  }

  // 协议限制（只允许 http/https）
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `[MCP SSRF 防护] 仅允许 http/https 协议，收到 "${parsed.protocol}"`
    );
  }

  const hostname = parsed.hostname;

  // 1. 直接 IP 字面量检查（拒绝内网字面量）
  // IPv4
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4Match) {
    const [, a, b, _c, _d] = ipv4Match.map(Number);
    if (
      a === 127 ||                                  // 127.0.0.0/8 loopback
      a === 10 ||                                   // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||          // 172.16.0.0/12
      (a === 192 && b === 168) ||                   // 192.168.0.0/16
      (a === 169 && b === 254) ||                   // 169.254.0.0/16 link-local
      a === 0 ||                                    // 0.0.0.0/8
      (a >= 224 && a <= 239) ||                     // 224.0.0.0/4 multicast
      (a >= 240 && a <= 255)                        // 240.0.0.0/4 reserved
    ) {
      throw new Error(`[MCP SSRF 防护] 拒绝内网 IP：${hostname}`);
    }
  } else if (hostname === 'localhost') {
    throw new Error(`[MCP SSRF 防护] 拒绝 localhost 域名`);
  } else if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd')) {
    // IPv6 loopback / 私有
    throw new Error(`[MCP SSRF 防护] 拒绝 IPv6 loopback/私网：${hostname}`);
  } else if (hostname.includes('.')) {
    // 2. 域名解析后查 IP（防止 DNS rebinding）
    try {
      const { address } = await dnsLookup(hostname);
      // 递归：再次走 IPv4 字面量检查
      const recurMatch = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
      if (recurMatch) {
        const [, a, b] = recurMatch.map(Number);
        if (
          a === 127 ||
          a === 10 ||
          (a === 172 && Number(b) >= 16 && Number(b) <= 31) ||
          (a === 192 && Number(b) === 168) ||
          (a === 169 && Number(b) === 254) ||
          a === 0
        ) {
          throw new Error(`[MCP SSRF 防护] 域名 "${hostname}" 解析到内网 IP ${address}`);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('[MCP SSRF 防护]')) throw err;
      // DNS 失败不算 SSRF 风险，但阻断后续连接
      throw new Error(`[MCP SSRF 防护] DNS 解析失败：${hostname}`);
    }
  }
}

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
      // 2026-07-21 P0-3：SSRF 防护——拒绝内网/loopback/link-local
      await assertSseUrlSafe(sseUrl);
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