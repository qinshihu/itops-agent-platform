/**
 * MCP 模块 API 服务层
 * 封装所有 /api/mcp/* 端点的调用
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

export interface McpHealth {
  status: string;
  protocol: string;
  server: { name: string; version: string };
  tools: {
    total: number;
    enabled: number;
    readOnly: number;
    domains: string[];
  };
  uptime: number;
}

export interface McpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations?: {
    domain?: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    riskLevel: string;
  };
}

export interface McpManifest {
  name: string;
  title: string;
  version: string;
  description: string;
  protocolVersion: string;
  auth: { type: string; header?: string };
  rateLimit: { perMinute: number };
  tools: McpTool[];
  diagnostics: {
    total: number;
    enabled: number;
    readOnly: number;
    domains: string[];
  };
}

export interface ToolCallResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  tool?: McpTool;
}

export interface McpServer {
  name: string;
  version: string;
  description: string;
  protocolVersion: string;
}

export interface ExternalServer {
  id: string;
  name: string;
  namespace: string;
  transport: string;
  state: 'connected' | 'connecting' | 'disconnected' | 'error' | 'reconnecting';
  tools: number;
}

export interface ExternalServerStatus {
  servers: ExternalServer[];
  totalTools: number;
  connectedServers: number;
  totalServers: number;
}

export interface ExternalServerConfig {
  id: string;
  name: string;
  transport: 'sse' | 'stdio';
  namespace: string;
  description?: string;
  sse?: { url: string; headers?: Record<string, string> };
  stdio?: { command: string; args?: string[]; env?: Record<string, string> };
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectIntervalMs: number;
}

export interface ApprovalTicket {
  ticketId: string;
  toolName: string;
  userId: string;
  reason: string;
  approved: boolean;
  approvedBy?: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuditEntry {
  timestamp: number;
  toolName: string;
  userId?: string;
  pass: boolean;
  reason?: string;
  argsSize: number;
}

export interface SecurityConfig {
  enforceReadOnly: boolean;
  destructiveRequiresApprovalToken: boolean;
  maxArgDepth: number;
  maxArgValueLength: number;
  promptInjectionDetection: 'off' | 'warn' | 'block';
  credentialLeakDetection: 'off' | 'warn' | 'block';
  auditEnabled: boolean;
}

// ============================================================
// API 函数
// ============================================================

/** 健康检查 */
export async function fetchHealth(): Promise<McpHealth> {
  const { data } = await api.get('/mcp/health');
  return data;
}

/** 获取工具清单 */
export async function fetchManifest(): Promise<McpManifest> {
  const { data } = await api.get('/mcp/manifest');
  return data;
}

/** 调用工具（REST 方式） */
export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  const { data } = await api.post('/mcp/call', { name, arguments: args });
  return data;
}

/** JSON-RPC 调用 */
export async function jsonRpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const { data } = await api.post('/mcp/rpc', {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params: params || {},
  });
  return data;
}

// ============================================================
// 外部服务器管理
// ============================================================

/** 获取外部服务器状态 */
export async function fetchExternalStatus(): Promise<ExternalServerStatus> {
  const { data } = await api.get('/mcp/external/status');
  return data;
}

/** 注册外部服务器 */
export async function registerExternalServer(config: ExternalServerConfig): Promise<{ registered: boolean; id: string }> {
  const { data } = await api.post('/mcp/external/register', config);
  return data;
}

/** 启动外部服务器 */
export async function startExternalServer(id: string): Promise<{ started: boolean; id: string }> {
  const { data } = await api.post(`/mcp/external/start/${id}`);
  return data;
}

/** 启动所有外部服务器 */
export async function startAllExternalServers(): Promise<{ results: Array<{ id: string; success: boolean; error?: string }> }> {
  const { data } = await api.post('/mcp/external/start');
  return data;
}

/** 停止外部服务器 */
export async function stopExternalServer(id: string): Promise<{ stopped: boolean; id: string }> {
  const { data } = await api.post(`/mcp/external/stop/${id}`);
  return data;
}

/** 注销外部服务器 */
export async function unregisterExternalServer(id: string): Promise<{ unregistered: boolean; id: string }> {
  const { data } = await api.delete(`/mcp/external/${id}`);
  return data;
}

// ============================================================
// 审批票据
// ============================================================

/** 创建审批票据 */
export async function createApprovalTicket(
  toolName: string, userId: string, reason: string, ttlMs?: number
): Promise<{ ticketId: string; expiresAt: string }> {
  const { data } = await api.post('/mcp/approval/create', { toolName, userId, reason, ttlMs });
  return data;
}

/** 审批通过 */
export async function approveTicket(ticketId: string, approverId: string): Promise<{ approved: boolean }> {
  const { data } = await api.post('/mcp/approval/approve', { ticketId, approverId });
  return data;
}

/** 查询票据状态 */
export async function fetchTicket(ticketId: string): Promise<ApprovalTicket> {
  const { data } = await api.get(`/mcp/approval/${ticketId}`);
  return data;
}

// ============================================================
// 审计与安全
// ============================================================

/** 获取审计日志 */
export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const { data } = await api.get('/mcp/audit');
  return data;
}

/** 获取安全门配置 */
export async function fetchSecurityConfig(): Promise<SecurityConfig> {
  const { data } = await api.get('/mcp/security/config');
  return data;
}