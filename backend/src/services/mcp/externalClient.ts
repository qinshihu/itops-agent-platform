/**
 * MCP External Client — 让 daima 作为 MCP 客户端连接外部 MCP Server
 *
 * 支持两种传输方式：
 * 1. SSE  (HTTP)  — 连接远程 HTTP MCP Server（如 Keep、holmesgpt 等）
 * 2. stdio (进程) — 连接本地进程 MCP Server（如 npx 启动的工具服务器）
 *
 * 架构：
 *
 *   daima Agent
 *       │
 *       ▼
 *   toolRegistry
 *       │
 *   ┌───┴───┬──────────┬──────────┐
 *   │ 内置   │ Ext: A   │ Ext: B   │ Ext: C
 *   │ 25 个  │ fs.read  │ db.query │ k8s.pod  ← 命名空间隔离
 *   └───────┴────┬──────┴────┬──────┴────┬─────┘
 *                │           │           │
 *           ┌────▼────┐ ┌───▼────┐ ┌───▼────┐
 *           │ MCP Srv │ │ MCP Srv│ │ MCP Srv│
 *           │ (SSE)   │ │ (SSE)  │ │(stdio) │
 *           └─────────┘ └────────┘ └────────┘
 */

import { EventEmitter } from 'events';
import type { ChildProcess} from 'child_process';
import { spawn } from 'child_process';
import { logger } from '../../utils/logger';
import { toolRegistry } from './toolRegistry';
import {
  type RegisteredTool,
  type ToolCallResult,
  type ToolCallContext,
  type ToolDefinition,
  type ToolSecurityAnnotations,
  RiskLevel,
  MCP_PROTOCOL_VERSION,
} from './types';

// ============================================================
// 类型定义
// ============================================================

/** 传输类型 */
export type TransportType = 'sse' | 'stdio';

/** 连接状态 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

/** 外部 MCP Server 配置 */
export interface ExternalServerConfig {
  /** 唯一标识（工具命名空间前缀） */
  id: string;

  /** 人类可读名称 */
  name: string;

  /** 传输类型 */
  transport: TransportType;

  /** SSE 配置 */
  sse?: {
    /** SSE 端点 URL */
    url: string;
    /** 请求头 */
    headers?: Record<string, string>;
  };

  /** stdio 配置 */
  stdio?: {
    /** 命令 */
    command: string;
    /** 参数 */
    args?: string[];
    /** 环境变量 */
    env?: Record<string, string>;
    /** 工作目录 */
    cwd?: string;
  };

  /** 自动重连 */
  autoReconnect: boolean;
  /** 重连最大次数（0 = 无限） */
  maxReconnectAttempts: number;
  /** 重连间隔（ms） */
  reconnectIntervalMs: number;

  /** 工具命名空间（e.g., "fs" → 工具注册为 "fs.read_file"） */
  namespace: string;

  /** 描述 */
  description?: string;
}

/** 外部工具引用 */
interface ExternalToolRef {
  serverId: string;
  originalName: string;
  namespacedName: string;
  definition: ToolDefinition;
}

// ============================================================
// SSE 传输实现
// ============================================================

class SseTransport extends EventEmitter {
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

// ============================================================
// stdio 传输实现
// ============================================================

class StdioTransport extends EventEmitter {
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

// ============================================================
// ExternalMCPClient — 单个外部 MCP Server 的客户端
// ============================================================

class ExternalMCPClient extends EventEmitter {
  readonly serverId: string;
  readonly config: ExternalServerConfig;
  private transport: SseTransport | StdioTransport;
  private state: ConnectionState = 'disconnected';
  private tools: Map<string, ExternalToolRef> = new Map();
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(config: ExternalServerConfig) {
    super();
    this.serverId = config.id;
    this.config = config;
    this.transport =
      config.transport === 'stdio'
        ? new StdioTransport(config.id)
        : new SseTransport(config.id);
    this.setupTransportListeners();
  }

  private setupTransportListeners(): void {
    this.transport.on('sse:connected', () => this.onConnected());
    this.transport.on('stdio:connected', () => this.onConnected());
    this.transport.on('sse:disconnected', () => this.onDisconnected());
    this.transport.on('stdio:disconnected', () => this.onDisconnected());
    this.transport.on('sse:error', (err: Error) => this.onError(err));
    this.transport.on('stdio:error', (err: Error) => this.onError(err));
  }

  // ============================================================
  // 连接管理
  // ============================================================

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      logger.warn(`[MCP Client:${this.serverId}] Already connected/connecting`);
      return;
    }

    this.setState('connecting');
    logger.info(`[MCP Client:${this.serverId}] Connecting...`);

    try {
      await this.transport.connect(this.config);
      await this.initialize();
      await this.fetchAndRegisterTools();
      this.reconnectCount = 0;
      logger.info(
        `[MCP Client:${this.serverId}] Connected — ${this.tools.size} tools`
      );
    } catch (err) {
      this.setState('error');
      logger.error(
        `[MCP Client:${this.serverId}] Connection failed`,
        err as Error
      );
      this.scheduleReconnect();
      throw err;
    }
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRpc('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      clientInfo: { name: 'daima-aiops', version: '1.0.0' },
      capabilities: { tools: {} },
    });

    logger.debug(
      `[MCP Client:${this.serverId}] Initialized: ${JSON.stringify(result).substring(0, 100)}`
    );
    this.initialized = true;
  }

  private async fetchAndRegisterTools(): Promise<void> {
    const result = await this.sendRpc('tools/list', {});
    const tools: ToolDefinition[] = (result as any).tools || [];
    logger.info(
      `[MCP Client:${this.serverId}] Fetched ${tools.length} tools`
    );

    // 取消注册旧工具
    this.unregisterAllTools();

    // 注册新工具（带命名空间前缀）
    for (const toolDef of tools) {
      const namespacedName = `${this.config.namespace}.${toolDef.name}`;
      const externalRef: ExternalToolRef = {
        serverId: this.serverId,
        originalName: toolDef.name,
        namespacedName,
        definition: toolDef,
      };

      this.tools.set(toolDef.name, externalRef);

      // 注册到全局 toolRegistry
      const registeredTool: RegisteredTool = {
        name: namespacedName,
        title: `[${this.config.name}] ${toolDef.title || toolDef.name}`,
        description: `${toolDef.description}\n(来自外部 MCP Server: ${this.config.name})`,
        inputSchema: this.convertJsonSchemaToZod(toolDef.inputSchema),
        domain: this.config.namespace,
        annotations: this.parseAnnotations(toolDef.annotations),
        handler: async (args, ctx) => {
          return this.proxyToolCall(toolDef.name, args, ctx);
        },
        enabled: true,
      };

      toolRegistry.register(registeredTool);
      logger.debug(
        `[MCP Client:${this.serverId}] Registered tool: ${namespacedName}`
      );
    }
  }

  /**
   * 代理工具调用到外部 MCP Server
   */
  async proxyToolCall(
    originalName: string,
    args: Record<string, unknown>,
    _context: ToolCallContext
  ): Promise<ToolCallResult> {
    try {
      const result = await this.sendRpc('tools/call', {
        name: originalName,
        arguments: args,
      });

      // 将外部响应转为 ToolCallResult 格式
      const mcpResult = result as any;
      return {
        content: mcpResult.content || [
          {
            type: 'text',
            text: typeof mcpResult === 'string' ? mcpResult : JSON.stringify(mcpResult),
          },
        ],
        structuredContent: mcpResult.structuredContent,
        isError: mcpResult.isError || false,
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `External MCP tool call failed [${this.config.name}/${originalName}]: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // ============================================================
  // 低层 RPC 调用
  // ============================================================

  private async sendRpc(method: string, params?: object): Promise<object> {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: params || {},
    };

    const response = await this.transport.send(request);
    return response;
  }

  // ============================================================
  // 状态管理
  // ============================================================

  private onConnected(): void {
    this.setState('connected');
    this.emit('connected');
  }

  private onDisconnected(): void {
    this.setState('disconnected');
    this.emit('disconnected');
    if (this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private onError(err: Error): void {
    this.setState('error');
    this.emit('error', err);
    if (this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const max = this.config.maxReconnectAttempts || Infinity;
    if (this.reconnectCount >= max) {
      logger.error(
        `[MCP Client:${this.serverId}] Max reconnect attempts reached (${max})`
      );
      return;
    }

    this.setState('reconnecting');
    this.reconnectCount++;
    const delay = this.config.reconnectIntervalMs || 5000;

    logger.info(
      `[MCP Client:${this.serverId}] Reconnecting in ${delay}ms (attempt ${this.reconnectCount}/${max === Infinity ? '∞' : max})`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // scheduleReconnect() will be called by onError
      }
    }, delay * Math.min(this.reconnectCount, 6)); // 指数退避，最多 6× 间隔
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit('stateChange', state);
  }

  // ============================================================
  // 工具注册 / 注销
  // ============================================================

  private unregisterAllTools(): void {
    for (const [_originalName, ref] of this.tools) {
      toolRegistry.unregister(ref.namespacedName);
    }
    this.tools.clear();
  }

  // ============================================================
  // Schema 转换
  // ============================================================

  /**
   * JSON Schema → Zod（简化版，覆盖常见类型）
   */
  private convertJsonSchemaToZod(jsonSchema: Record<string, unknown>): any {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { z } = require('zod');
    const properties = (jsonSchema.properties || {}) as Record<string, any>;
    const required = (jsonSchema.required || []) as string[];

    const shape: Record<string, any> = {};
    for (const [key, prop] of Object.entries(properties)) {
      let zodType: any;

      switch (prop.type) {
        case 'string':
          zodType = z.string();
          if (prop.enum) zodType = z.enum(prop.enum as [string, ...string[]]);
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.unknown());
          break;
        case 'object':
          zodType = z.record(z.unknown());
          break;
        default:
          zodType = z.unknown();
      }

      // 添加描述
      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }

      // 可选参数
      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      // 默认值
      if (prop.default !== undefined) {
        zodType = zodType.default(prop.default);
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  /**
   * 注解转换（MCP 规范 → daima 内部格式）
   */
  private parseAnnotations(
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; riskLevel?: string }
  ): ToolSecurityAnnotations {
    const riskLevel = (annotations?.riskLevel as RiskLevel) || RiskLevel.READONLY;
    return {
      readOnlyHint: annotations?.readOnlyHint ?? true,
      destructiveHint: annotations?.destructiveHint ?? false,
      idempotentHint: annotations?.idempotentHint ?? true,
      riskLevel,
      requiresApproval:
        riskLevel === RiskLevel.MEDIUM ||
        riskLevel === RiskLevel.HIGH ||
        riskLevel === RiskLevel.DESTRUCTIVE,
    };
  }

  // ============================================================
  // 查询
  // ============================================================

  getState(): ConnectionState {
    return this.state;
  }

  getToolCount(): number {
    return this.tools.size;
  }

  getToolNames(): string[] {
    return Array.from(this.tools.values()).map((t) => t.namespacedName);
  }

  // ============================================================
  // 断开
  // ============================================================

  disconnect(): void {
    this.unregisterAllTools();
    this.transport.disconnect();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setState('disconnected');
  }
}

// ============================================================
// 导出
// ============================================================

export { ExternalMCPClient };
export type { ExternalToolRef };
