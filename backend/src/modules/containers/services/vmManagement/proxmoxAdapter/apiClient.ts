/* eslint-disable @typescript-eslint/no-explicit-any */
import https from 'https';
import { logger } from '../../../../../utils/logger';

export interface ProxmoxConfig {
  host: string;
  port?: number;
  node: string;
  authType: 'password' | 'token';
  username?: string;
  password?: string;
  tokenId?: string;
  tokenSecret?: string;
  realm?: string;
}

/**
 * Proxmox VE REST API 客户端：封装 HTTPS 通信、认证和任务等待。
 */
export class ProxmoxApiClient {
  readonly host: string;
  readonly port: number;
  readonly node: string;
  readonly platformId: string;
  private authType: 'password' | 'token';
  private username?: string;
  private password?: string;
  private tokenId?: string;
  private tokenSecret?: string;
  private ticket?: string;
  private csrfToken?: string;
  private baseUrl: string;
  private httpsAgent: https.Agent;
  private _connected = false;

  constructor(platformId: string, config: ProxmoxConfig) {
    this.platformId = platformId;
    this.host = config.host;
    this.port = config.port || 8006;
    this.node = config.node || 'pve';
    this.authType = config.authType || 'password';
    this.username = config.username;
    this.password = config.password;
    this.tokenId = config.tokenId;
    this.tokenSecret = config.tokenSecret;
    this.baseUrl = `https://${this.host}:${this.port}/api2/json`;

    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
    });
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    try {
      logger.info(`🔌 正在连接 Proxmox VE: ${this.host}:${this.port}`);

      if (this.authType === 'token') {
        await this.testTokenAuth();
      } else {
        await this.acquireTicket();
      }

      this._connected = true;
      logger.info(`✅ Proxmox VE 连接成功 (${this.host}, 节点: ${this.node})`);
    } catch (error) {
      logger.error('❌ Proxmox VE 连接失败:', error);
      this._connected = false;
      throw error;
    }
  }

  disconnect(): void {
    this._connected = false;
    this.ticket = undefined;
    this.csrfToken = undefined;
    logger.info('🔌 Proxmox VE 已断开连接');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.apiRequest('GET', `/nodes/${this.node}/version`);
      return true;
    } catch {
      return false;
    } finally {
      this.disconnect();
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this._connected) await this.connect();
  }

  apiRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const postData = body ? JSON.stringify(body) : undefined;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.authType === 'token' && this.tokenId && this.tokenSecret) {
        headers['Authorization'] = `PVEAPIToken=${this.tokenId}=${this.tokenSecret}`;
      } else if (this.ticket) {
        headers['Cookie'] = `PVEAuthCookie=${this.ticket}`;
        if (this.csrfToken) {
          headers['CSRFPreventionToken'] = this.csrfToken;
        }
      }

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers,
        agent: this.httpsAgent,
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed.data !== undefined ? parsed.data : parsed);
            } else {
              const errMsg = parsed.errors
                ? parsed.errors.map((e: any) => e.message).join('; ')
                : parsed.message || `HTTP ${res.statusCode}`;
              reject(new Error(errMsg));
            }
          } catch {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
            }
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Proxmox API 请求失败: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Proxmox API 请求超时 (30s)'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  private async acquireTicket(): Promise<void> {
    if (!this.username || !this.password) {
      throw new Error('Proxmox 用户名/密码未配置');
    }

    const result = await this.rawRequest(
      'POST',
      '/access/ticket',
      { username: this.username, password: this.password }
    );

    this.ticket = result.ticket;
    this.csrfToken = result.CSRFPreventionToken;
    logger.info('🔑 Proxmox 登录票据获取成功');
  }

  private async testTokenAuth(): Promise<void> {
    if (!this.tokenId || !this.tokenSecret) {
      throw new Error('Proxmox API Token 未配置');
    }
    await this.apiRequest('GET', `/nodes/${this.node}/version`);
    logger.info('🔑 Proxmox API Token 验证成功');
  }

  private rawRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const postData = body ? JSON.stringify(body) : undefined;

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: postData
          ? { 'Content-Type': 'application/json' }
          : {},
        agent: this.httpsAgent,
        timeout: 15000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.data !== undefined) {
              resolve(parsed.data);
            } else if (parsed.errors) {
              reject(new Error(parsed.errors.map((e: any) => e.message).join('; ')));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error(`Proxmox 响应解析失败: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Proxmox 请求失败: ${err.message}`));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  async waitForTask(upid: string, timeout = 30000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeout) {
      try {
        const encodedUpid = encodeURIComponent(upid);
        const taskResult = await this.apiRequest(
          'GET',
          `/nodes/${this.node}/tasks/${encodedUpid}/status`
        );

        if (taskResult.status === 'stopped') {
          if (taskResult.exitstatus === 'OK') {
            return;
          }
          throw new Error(`Proxmox 任务失败: ${taskResult.exitstatus}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Proxmox 任务失败')) {
          throw error;
        }
      }

      await this.sleep(pollInterval);
    }

    logger.warn(`⚠️ Proxmox 任务 ${upid} 等待超时 (${timeout}ms)`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
