// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ToolDefinition, ToolSecurityAnnotations, RiskLevel } from '../types';

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
export interface ExternalToolRef {
  serverId: string;
  originalName: string;
  namespacedName: string;
  definition: ToolDefinition;
}