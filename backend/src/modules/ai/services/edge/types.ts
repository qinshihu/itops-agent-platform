/**
 * 边缘代理（Edge Agent）类型定义
 */

// ── 语义化类型别名 ──

/** 通用元数据（用户/系统自定义扩展字段） */
export type AgentMetadata = Record<string, unknown>;
/** Agent 命令参数 */
export type AgentCommandParams = Record<string, unknown>;
/** Skill 执行参数 */
export type SkillParams = Record<string, unknown>;

// AgentType
export enum EdgeAgentType {
  HOST = 'host',
  CONTAINER = 'container',
  KUBERNETES = 'kubernetes',
  NETWORK = 'network',
  DATABASE = 'database'
}

// AgentStatus
export enum EdgeAgentStatus {
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
  ONLINE = 'online',
  ERROR = 'error'
}

// 心跳配置
export interface EdgeAgentConfig {
  agentId: string;
  agentName: string;
  agentType: EdgeAgentType;
  serverUrl: string;
  accessKey: string;
  secretKey: string;
  heartbeatInterval?: number; // 心跳间隔（毫秒），默认 30000
  metricsInterval?: number; // 指标采集间隔（毫秒），默认 10000
  reconnectInterval?: number; // 重连间隔（毫秒），默认 5000
  maxReconnectAttempts?: number; // 最大重连次数，默认 10
  agentVersion?: string;
  metadata?: AgentMetadata;
}

// 主机信息
export interface HostInfo {
  hostname: string;
  os: string;
  osVersion: string;
  arch: string;
  cpuCount: number;
  totalMemory: number;
  totalDisk: number;
  ipAddresses: string[];
  uptime: number;
  bootTime: number;
}

// 主机负载信息
export interface HostLoad {
  timestamp: number;
  cpuUsage: number;
  cpuCores: number;
  memoryUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  swapUsage: number;
  diskUsage: number;
  diskTotal: number;
  diskUsed: number;
  networkIn: number;
  networkOut: number;
  load1: number;
  load5: number;
  load15: number;
  processCount: number;
}

// 进程列表
export interface ProcessInfo {
  pid: number;
  name: string;
  cmd: string;
  cpuPercent: number;
  memPercent: number;
  memRss: number;
  memVms: number;
  startTime: number;
  status: string;
  username: string;
  createTime: number;
}

export interface ProcessListResponse {
  sampledAt: number;
  processes: ProcessInfo[];
  totalProcesses: number;
}

// 指标样本
export interface PromSample {
  name: string;
  labels: Record<string, string>;
  value: number;
  timestamp: number;
}

// 注册请求
export interface RegisterAgentRequest {
  accessKey: string;
  secretKey: string;
  hostInfo?: HostInfo;
  agentVersion?: string;
  metadata?: AgentMetadata;
}

export interface RegisterAgentResponse {
  agentId: string;
  serverTime: number;
  assignedTasks?: string[];
}

// 心跳请求
export interface HeartbeatRequest {
  agentId: string;
  timestamp: number;
  status: EdgeAgentStatus;
  plugins?: PluginHealth[];
}

export interface HeartbeatResponse {
  serverTime: number;
  commands?: AgentCommand[];
}

// Agent 命令类型
export enum AgentCommandType {
  EXECUTE_SKILL = 'execute_skill',
  FETCH_PACKAGE = 'fetch_package',
  APPLY_PACKAGE = 'apply_package',
  UPGRADE_AGENT = 'upgrade_agent',
  RESTART_AGENT = 'restart_agent',
  UPDATE_CONFIG = 'update_config'
}

export interface AgentCommand {
  id: string;
  type: AgentCommandType;
  timestamp: number;
  params: AgentCommandParams;
}

// Plugin Health
export interface PluginHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  lastUpdate: number;
}

// Collector 输出
export interface CollectorOutput {
  source: string;
  hostPoint?: HostMetricPoint;
  samples?: PromSample[];
}

// Host Metric Point
export interface HostMetricPoint {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  load1: number;
  load5: number;
  load15: number;
}

// Skill 执行
export interface SkillExecutionRequest {
  skillName: string;
  params: SkillParams;
  timeout?: number;
}

export interface SkillExecutionResponse {
  success: boolean;
  output: string;
  error?: string;
  metadata?: AgentMetadata;
}

// 隧道事件类型
export type TunnelEventHandler = (event: TunnelEvent) => void;

export interface TunnelEvent {
  type: 'connected' | 'disconnected' | 'error' | 'command';
  timestamp: number;
  data?: unknown;
  error?: string;
}
