import type { Client } from 'ssh2';
import type { OSType } from '../../../infra/services/commandDispatcher';

export interface ServerInfo {
  id: string;
  hostname: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  ssh_key_id?: string;
  use_ssh_key: number;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
  error?: string;
  aiAnalysis?: string;
}

export interface PooledConnection {
  client: Client;
  serverId: string;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
  healthCheckFailed: number;
}

// Re-export OSType so consumers of this module can access it if needed
export type { OSType };

// 默认超时时间（毫秒）
export const DEFAULT_CONNECT_TIMEOUT = 10000;
export const DEFAULT_COMMAND_TIMEOUT = 30000;
export const POOL_ACQUIRE_TIMEOUT = 30000; // 连接池等待超时 30 秒
export const POOL_ACQUIRE_RETRY_INTERVAL = 500; // 连接池重试间隔 500ms

// 连接池配置
export const POOL_CONFIG = {
  maxConnectionsPerServer: 5, // 每台服务器最大连接数
  idleTimeout: 300000, // 空闲连接超时 5 分钟
  healthCheckInterval: 60000, // 健康检查间隔 1 分钟
  maxTotalConnections: 50 // 全局最大连接数
};

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}