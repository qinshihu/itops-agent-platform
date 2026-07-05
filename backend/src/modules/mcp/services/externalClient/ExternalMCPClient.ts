/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import { logger } from '../../../../utils/logger';
import { toolRegistry } from '../toolRegistry';
import {
  type RegisteredTool,
  type ToolCallResult,
  type ToolCallContext,
  type ToolDefinition,
  type ToolSecurityAnnotations,
  type ToolInput,
  type JsonSchemaNode,
  RiskLevel,
  MCP_PROTOCOL_VERSION,
} from '../types';
import { SseTransport } from './SseTransport';
import { StdioTransport } from './StdioTransport';
import type {
  ExternalServerConfig,
  ExternalToolRef,
  ConnectionState,
} from './types';

// ============================================================
// ExternalMCPClient — 单个外部 MCP Server 的客户端
// ============================================================

export class ExternalMCPClient extends EventEmitter {
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
    args: ToolInput,
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
  private convertJsonSchemaToZod(jsonSchema: JsonSchemaNode): any {
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