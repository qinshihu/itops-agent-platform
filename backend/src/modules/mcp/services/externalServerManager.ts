/**
 * External Server Manager — 多外部 MCP Server 生命周期管理
 *
 * 管理所有外部 MCP Server 的连接、健康检查、工具聚合
 *
 * 使用方式：
 *
 *   import { externalServerManager } from './externalServerManager';
 *
 *   // 注册外部 MCP Server
 *   externalServerManager.register({
 *     id: 'filesystem',
 *     name: 'Filesystem MCP',
 *     transport: 'stdio',
 *     stdio: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
 *     namespace: 'fs',
 *     autoReconnect: true,
 *     maxReconnectAttempts: 5,
 *     reconnectIntervalMs: 3000,
 *   });
 *
 *   // 启动所有已注册的外部服务器
 *   await externalServerManager.startAll();
 *
 *   // 查看聚合状态
 *   const status = externalServerManager.getStatus();
 *   console.log(`Total external tools: ${status.totalTools}`);
 */

import { EventEmitter } from 'events';
import {
  ExternalMCPClient,
  type ExternalServerConfig,
  type ConnectionState,
} from './externalClient';
import { toolRegistry } from './toolRegistry';
import { logger } from '../../../utils/logger';

// ============================================================
// 类型
// ============================================================

interface ServerEntry {
  config: ExternalServerConfig;
  client: ExternalMCPClient;
  registered: boolean;
}

interface ManagerStatus {
  servers: Array<{
    id: string;
    name: string;
    namespace: string;
    transport: string;
    state: ConnectionState;
    tools: number;
  }>;
  totalTools: number;
  connectedServers: number;
  totalServers: number;
}

// ============================================================
// ExternalServerManager
// ============================================================

class ExternalServerManager extends EventEmitter {
  private servers: Map<string, ServerEntry> = new Map();

  // ============================================================
  // 注册
  // ============================================================

  /**
   * 注册外部 MCP Server 配置
   * 注册后需调用 start(id) 或 startAll() 启动连接
   */
  register(config: ExternalServerConfig): void {
    if (this.servers.has(config.id)) {
      logger.warn(`[MCP Manager] Server "${config.id}" already registered, replacing`);
      this.unregister(config.id);
    }

    const client = new ExternalMCPClient(config);
    this.setupClientListeners(client);
    this.servers.set(config.id, { config, client, registered: true });
    logger.info(
      `[MCP Manager] Registered external server: "${config.id}" (${config.transport})`
    );
  }

  /**
   * 批量注册
   */
  registerAll(configs: ExternalServerConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  /**
   * 注销外部 MCP Server
   */
  unregister(id: string): void {
    const entry = this.servers.get(id);
    if (entry) {
      entry.client.disconnect();
      this.servers.delete(id);
      logger.info(`[MCP Manager] Unregistered external server: "${id}"`);
    }
  }

  // ============================================================
  // 连接管理
  // ============================================================

  /**
   * 启动指定服务器
   */
  async start(id: string): Promise<void> {
    const entry = this.servers.get(id);
    if (!entry) throw new Error(`Server "${id}" not registered`);
    await entry.client.connect();
  }

  /**
   * 启动所有已注册的服务器
   */
  async startAll(): Promise<Array<{ id: string; success: boolean; error?: string }>> {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    const promises = Array.from(this.servers.entries()).map(async ([id, entry]) => {
      try {
        await entry.client.connect();
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: (err as Error).message });
      }
    });

    await Promise.allSettled(promises);
    logger.info(
      `[MCP Manager] Started ${results.filter((r) => r.success).length}/${results.length} external servers`
    );
    return results;
  }

  /**
   * 停止指定服务器
   */
  stop(id: string): void {
    const entry = this.servers.get(id);
    if (entry) {
      entry.client.disconnect();
    }
  }

  /**
   * 停止所有服务器
   */
  stopAll(): void {
    for (const [_id, entry] of this.servers) {
      entry.client.disconnect();
    }
    logger.info(`[MCP Manager] All external servers stopped`);
  }

  /**
   * 重连指定服务器
   */
  async reconnect(id: string): Promise<void> {
    const entry = this.servers.get(id);
    if (!entry) throw new Error(`Server "${id}" not registered`);
    entry.client.disconnect();
    await entry.client.connect();
  }

  // ============================================================
  // 查询
  // ============================================================

  /**
   * 获取管理状态
   */
  getStatus(): ManagerStatus {
    const servers: ManagerStatus['servers'] = [];
    let totalTools = 0;
    let connectedServers = 0;

    for (const [id, entry] of this.servers) {
      const state = entry.client.getState();
      const tools = entry.client.getToolCount();
      if (state === 'connected') connectedServers++;
      totalTools += tools;

      servers.push({
        id,
        name: entry.config.name,
        namespace: entry.config.namespace,
        transport: entry.config.transport,
        state,
        tools,
      });
    }

    return {
      servers,
      totalTools,
      connectedServers,
      totalServers: this.servers.size,
    };
  }

  /**
   * 获取某个外部服务器的工具列表
   */
  getServerTools(id: string): string[] {
    const entry = this.servers.get(id);
    return entry ? entry.client.getToolNames() : [];
  }

  /**
   * 获取所有外部工具的总数
   */
  get totalExternalTools(): number {
    let count = 0;
    for (const [, entry] of this.servers) {
      count += entry.client.getToolCount();
    }
    return count;
  }

  /**
   * 获取所有工具（内置 + 外部）的总数
   */
  get totalTools(): number {
    return toolRegistry.count + this.totalExternalTools;
  }

  /**
   * 检查服务器是否已连接
   */
  isConnected(id: string): boolean {
    const entry = this.servers.get(id);
    return entry ? entry.client.getState() === 'connected' : false;
  }

  // ============================================================
  // 事件监听
  // ============================================================

  private setupClientListeners(client: ExternalMCPClient): void {
    const id = client.serverId;

    client.on('connected', () => {
      logger.info(`[MCP Manager] External server connected: "${id}"`);
      this.emit('server:connected', id);
    });

    client.on('disconnected', () => {
      logger.warn(`[MCP Manager] External server disconnected: "${id}"`);
      this.emit('server:disconnected', id);
    });

    client.on('error', (err: Error) => {
      logger.error(`[MCP Manager] External server error: "${id}"`, err);
      this.emit('server:error', id, err);
    });

    client.on('stateChange', (state: ConnectionState) => {
      this.emit('server:stateChange', id, state);
    });
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 销毁管理器，断开所有连接
   */
  destroy(): void {
    this.stopAll();
    this.servers.clear();
    this.removeAllListeners();
  }
}

// ============================================================
// 单例
// ============================================================

export const externalServerManager = new ExternalServerManager();
export { ExternalServerManager };
