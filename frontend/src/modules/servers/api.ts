/**
 * Servers 模块 API 服务层
 * 封装服务器、服务器分组、SSH 凭证、命令执行、合规检查相关端点
 */

import api from '@/lib/api';
import type { Server as _ServerEntity, SshKey as _SshKeyEntity, ServerGroup as _ServerGroupEntity, ImportResult as _ImportResult } from '@/types/server';

// ============================================================
// 类型定义
// ============================================================

// ── 服务器 ──

export interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  use_ssh_key: number;
  description?: string;
  tags?: string[];
  enabled: number;
  last_connected?: string;
  created_at: string;
  os?: string;
  os_type?: 'linux' | 'windows' | 'unknown';
  cpu_cores?: number;
  memory_gb?: number;
  disk_gb?: number;
  ip_address?: string;
  private_ip?: string;
  groups?: Array<{ id: string; name: string }>;
  ssh_key_id?: string;
}

export interface ServerInput {
  name: string;
  hostname: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  use_ssh_key: boolean;
  description?: string;
  tags?: string[];
  os_type?: 'linux' | 'windows';
  vnc_port?: number;
  vnc_password?: string;
  ssh_key_id?: string;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
  aiAnalysis?: string;
}

export interface CommandHistoryItem {
  id: string;
  server_id: string;
  command: string;
  stdout: string;
  stderr: string;
  success: number;
  execution_time_ms: number;
  executed_by: string;
  executed_at: string;
}

export interface ComplianceCheck {
  id: string;
  server_id: string;
  check_name: string;
  check_results: string;
  status: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

export interface ComplianceOptions {
  useAI?: boolean;
  concurrency?: number;
}

export interface CollectResult {
  success: number;
  failed: number;
  [key: string]: unknown;
}

// ── 服务器分组 ──

export interface ServerGroup {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  server_count?: number;
  children_count?: number;
  children?: ServerGroup[];
}

export interface ServerGroupInput {
  name: string;
  description?: string;
  parent_id?: string;
}

// ── SSH 凭证 ──

export interface SshKey {
  id: string;
  name: string;
  auth_type: 'key' | 'password';
  key_type: string;
  fingerprint: string | null;
  username: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  usage_count: number;
}

export interface SshKeyInput {
  name: string;
  auth_type: 'key' | 'password';
  username?: string;
  password?: string;
  private_key?: string;
  description?: string;
}

export interface SshKeyUsageServer {
  id: string;
  name: string;
  hostname: string;
}

// ── 导入 ──

export interface ImportServerItem {
  name: string;
  hostname: string;
  port?: number;
  username: string;
  password?: string;
  private_key?: string;
  use_ssh_key?: number;
  description?: string;
  tags?: string[];
  group_id?: string;
}

export interface ImportInput {
  servers: ImportServerItem[];
  test_connection: boolean;
}

// ── AI Agent ──

export interface Agent {
  id: string;
  name: string;
  enabled: number;
  category?: string;
}

export interface AgentTestInput {
  input: string;
  serverIds?: string[];
}

export interface AgentTestResult {
  output: string;
  [key: string]: unknown;
}

// ============================================================
// serversApi 对象
// ============================================================

export const serversApi = {
  // ── 服务器 ──

  /** 获取服务器列表 */
  async listServers(): Promise<Server[]> {
    const { data } = await api.get('/servers');
    return data.data;
  },

  /** 创建服务器 */
  async createServer(input: ServerInput): Promise<Server> {
    const { data } = await api.post('/servers', input);
    return data.data;
  },

  /** 更新服务器 */
  async updateServer(id: string, input: Partial<ServerInput>): Promise<Server> {
    const { data } = await api.put(`/servers/${id}`, input);
    return data.data;
  },

  /** 删除服务器 */
  async deleteServer(id: string): Promise<void> {
    await api.delete(`/servers/${id}`);
  },

  /** 获取命令历史 */
  async getCommandHistory(serverId: string): Promise<CommandHistoryItem[]> {
    const { data } = await api.get(`/servers/${serverId}/command-history`);
    return data.data;
  },

  /** 导出命令历史（返回 Blob） */
  async exportCommandHistory(serverId: string): Promise<Blob> {
    const { data } = await api.get(`/servers/${serverId}/command-history/export`, {
      responseType: 'blob',
    });
    return data;
  },

  /** 获取合规检查历史 */
  async getComplianceHistory(serverId: string): Promise<ComplianceCheck[]> {
    const { data } = await api.get(`/servers/${serverId}/compliance-history`);
    return data.data;
  },

  /** 导出合规检查历史（返回 Blob） */
  async exportComplianceHistory(serverId: string): Promise<Blob> {
    const { data } = await api.get(`/servers/${serverId}/compliance-history/export`, {
      responseType: 'blob',
    });
    return data;
  },

  // ── 服务器命令 ──

  /** 测试服务器连接 */
  async testConnection(id: string): Promise<{ message: string }> {
    const { data } = await api.post(`/server-commands/${id}/test`);
    return data.data;
  },

  /** 执行命令 */
  async executeCommand(id: string, command: string): Promise<CommandResult> {
    const { data } = await api.post(`/server-commands/${id}/exec`, { command });
    return data.data;
  },

  /** 运行合规检查 */
  async runCompliance(id: string, options?: ComplianceOptions): Promise<Record<string, CommandResult>> {
    const { data } = await api.post(`/server-commands/${id}/compliance`, options || {});
    return data.data;
  },

  // ── 服务器管理 ──

  /** 采集主机信息 */
  async collectInfo(id: string): Promise<unknown> {
    const { data } = await api.post(`/server-management/${id}/collect-info`);
    return data.data;
  },

  /** 批量采集主机信息 */
  async collectAll(): Promise<CollectResult> {
    const { data } = await api.post('/server-management/collect-all');
    return data.data;
  },

  /** 采集性能指标 */
  async collectMetrics(id: string): Promise<unknown> {
    const { data } = await api.post(`/server-management/${id}/collect-metrics`);
    return data.data;
  },

  /** 批量采集性能指标 */
  async collectAllMetrics(): Promise<CollectResult> {
    const { data } = await api.post('/server-management/collect-all-metrics');
    return data.data;
  },

  /** 导入服务器 */
  async importServers(input: ImportInput): Promise<CollectResult> {
    const { data } = await api.post('/server-management/import', input);
    return data.data;
  },

  // ── 服务器分组 ──

  /** 获取分组树 */
  async getGroupTree(): Promise<ServerGroup[]> {
    const { data } = await api.get('/server-groups/tree');
    return data.data;
  },

  /** 创建分组 */
  async createGroup(input: ServerGroupInput): Promise<ServerGroup> {
    const { data } = await api.post('/server-groups', input);
    return data.data;
  },

  /** 更新分组 */
  async updateGroup(id: string, input: ServerGroupInput): Promise<ServerGroup> {
    const { data } = await api.put(`/server-groups/${id}`, input);
    return data.data;
  },

  // ── SSH 凭证 ──

  /** 获取 SSH 凭证列表 */
  async listSshKeys(): Promise<SshKey[]> {
    const { data } = await api.get('/ssh-keys');
    return data.data;
  },

  /** 获取 SSH 凭证详情（含私钥） */
  async getSshKey(id: string): Promise<SshKey & { private_key: string }> {
    const { data } = await api.get(`/ssh-keys/${id}`);
    return data.data;
  },

  /** 创建 SSH 凭证 */
  async createSshKey(input: SshKeyInput): Promise<SshKey> {
    const { data } = await api.post('/ssh-keys', input);
    return data.data;
  },

  /** 更新 SSH 凭证 */
  async updateSshKey(id: string, input: Partial<SshKeyInput>): Promise<SshKey> {
    const { data } = await api.put(`/ssh-keys/${id}`, input);
    return data.data;
  },

  /** 删除 SSH 凭证 */
  async deleteSshKey(id: string): Promise<void> {
    await api.delete(`/ssh-keys/${id}`);
  },

  /** 获取凭证使用情况 */
  async getSshKeyUsage(id: string): Promise<{ servers: SshKeyUsageServer[] }> {
    const { data } = await api.get(`/ssh-keys/${id}/usage`);
    return data.data;
  },

  // ── AI Agent ──

  /** 获取 Agent 列表 */
  async listAgents(): Promise<Agent[]> {
    const { data } = await api.get('/agents');
    return data.data;
  },

  /** 测试 Agent（生成命令等） */
  async testAgent(id: string, input: AgentTestInput): Promise<AgentTestResult> {
    const { data } = await api.post(`/agents/${id}/test`, input);
    return data.data;
  },
};

export default serversApi;
