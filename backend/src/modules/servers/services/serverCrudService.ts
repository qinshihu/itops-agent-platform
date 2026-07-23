/**
 * Server 路由层 CRUD 抽象（v3 报告 P1-5 第二批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中处理：
 *   1. 密码/私钥加密（调用 auth.encryptionService）
 *   2. JSON 字段序列化（tags）
 *   3. 联表查询（servers + groups + ssh_keys + command_history + compliance_history）
 *   4. 导出数据组装
 */
import { randomUUID } from 'crypto';
import { serverRepository } from '../../../repositories';
import { encrypt } from '../../auth/services/encryptionService';

export interface Server {
  id: string;
  name: string;
  [key: string]: unknown;
}

export type ServerCreateInput = {
  name: string;
  hostname: string;
  port?: number;
  username: string;
  password?: string;
  private_key?: string;
  use_ssh_key?: boolean | number;
  description?: string;
  tags?: string[];
  os_type?: string;
  ssh_key_id?: string;
};

export type ServerUpdateInput = Partial<ServerCreateInput> & { enabled?: number };

function parseJsonFields(server: Record<string, unknown>): Record<string, unknown> {
  if (typeof server.tags === 'string') {
    try { server.tags = JSON.parse(server.tags as string); } catch { /* keep as string */ }
  }
  return server;
}

export const serverCrudService = {
  // ── 查询 ──

  /**
   * 列出所有服务器（含分组信息 + 解析 tags）
   */
  listServers() {
    const servers = serverRepository.servers.list();
    return servers.map((server) => {
      const groups = serverRepository.groups.listByServer(server.id).map((g) => ({ id: g.id, name: g.name }));
      return { ...parseJsonFields(server as unknown as Record<string, unknown>), groups };
    });
  },

  /**
   * 详情查询（脱敏：password/private_key 不返回）
   */
  getServerById(id: string): Server | undefined {
    const server = serverRepository.servers.getById(id);
    if (!server) return undefined;
    const { password: _password, private_key: _privateKey, ...safe } = server;
    return parseJsonFields(safe as Record<string, unknown>) as unknown as Server;
  },

  // ── 创建 ──

  createServer(input: ServerCreateInput): { success: true; data: { id: string } } {
    const id = randomUUID();
    const tagsJson = input.tags ? JSON.stringify(input.tags) : null;
    const encryptedPassword = input.password ? encrypt(input.password) : null;
    const encryptedPrivateKey = input.private_key ? encrypt(input.private_key) : null;
    serverRepository.servers.create({
      id,
      name: input.name,
      hostname: input.hostname,
      port: input.port || 22,
      username: input.username,
      password: encryptedPassword,
      private_key: encryptedPrivateKey,
      use_ssh_key: input.use_ssh_key ? 1 : 0,
      description: input.description ?? null,
      tags: tagsJson,
      os_type: input.os_type || 'linux',
      ssh_key_id: input.ssh_key_id || null,
    });
    return { success: true, data: { id } };
  },

  // ── 更新 ──

  updateServer(id: string, input: ServerUpdateInput): { success: true } | { success: false; error: 'not_found' } {
    const server = serverRepository.servers.getById(id);
    if (!server) return { success: false, error: 'not_found' };

    const tagsJson = input.tags ? JSON.stringify(input.tags) : undefined;
    let encryptedPassword: string | null | undefined;
    let encryptedPrivateKey: string | null | undefined;

    if (input.password !== undefined && typeof input.password === 'string') {
      encryptedPassword = input.password ? encrypt(input.password) : null;
    }
    if (input.private_key !== undefined && typeof input.private_key === 'string') {
      encryptedPrivateKey = input.private_key ? encrypt(input.private_key) : null;
    }

    // description 三态语义（与 password/private_key 一致）：
    //   undefined → 不更新（保留旧值）
    //   null/''   → 清空（写 NULL）
    //   string    → 原样写入
    let description: string | null | undefined;
    if (input.description !== undefined) {
      description = input.description === '' ? null : input.description;
    }

    serverRepository.servers.update(id, {
      name: input.name,
      hostname: input.hostname,
      port: input.port,
      username: input.username,
      password: encryptedPassword,
      private_key: encryptedPrivateKey,
      use_ssh_key: input.use_ssh_key !== undefined ? (input.use_ssh_key ? 1 : 0) : undefined,
      description,
      tags: tagsJson,
      enabled: input.enabled,
      os_type: input.os_type,
      ssh_key_id: input.ssh_key_id !== undefined ? input.ssh_key_id : undefined,
    });
    return { success: true };
  },

  // ── 删除 ──

  deleteServer(id: string) {
    serverRepository.servers.delete(id);
  },

  // ── 历史查询 ──

  listCommandHistory(id: string, limit?: number) {
    return serverRepository.servers.listCommandHistory(id, limit);
  },

  listComplianceChecks(id: string, limit?: number) {
    return serverRepository.servers.listComplianceChecks(id, limit);
  },

  /**
   * 导出命令历史（组装 server 元信息 + 历史）
   */
  exportCommandHistory(id: string): { success: true; data: unknown } | { success: false; error: 'not_found' } {
    const server = serverRepository.servers.getById(id);
    if (!server) return { success: false, error: 'not_found' };
    const history = serverRepository.servers.listCommandHistory(id, 0);
    return {
      success: true,
      data: {
        server: { id: server.id, name: server.name, hostname: server.hostname, exportTime: new Date().toISOString() },
        commandHistory: history,
      },
    };
  },

  /**
   * 导出合规历史
   */
  exportComplianceHistory(id: string): { success: true; data: unknown } | { success: false; error: 'not_found' } {
    const server = serverRepository.servers.getById(id);
    if (!server) return { success: false, error: 'not_found' };
    const checks = serverRepository.servers.listComplianceChecks(id, 0);
    return {
      success: true,
      data: {
        server: { id: server.id, name: server.name, hostname: server.hostname, exportTime: new Date().toISOString() },
        complianceHistory: checks,
      },
    };
  },

  // ── VNC 配置（供 vncRoutes 使用）──

  /**
   * 获取 VNC 配置（含加密密码）
   */
  getVncConfig(serverId: string) {
    return serverRepository.servers.getVncConfig(serverId);
  },

  /**
   * 更新 VNC 配置（password 已在 routes 加密后传入）
   * 返回 { success: true } | { success: false, error: 'not_found' | 'no_changes' }
   */
  updateVncConfig(serverId: string, input: { vnc_port?: number; vnc_password?: string | null }): { success: true } | { success: false; error: 'not_found' | 'no_changes' } {
    if (!serverRepository.servers.existsById(serverId)) {
      return { success: false, error: 'not_found' };
    }
    if (input.vnc_port === undefined && input.vnc_password === undefined) {
      return { success: false, error: 'no_changes' };
    }
    const fields: { vnc_port?: number; vnc_password?: string | null } = {};
    if (input.vnc_port !== undefined) fields.vnc_port = input.vnc_port;
    if (input.vnc_password !== undefined) fields.vnc_password = input.vnc_password;
    serverRepository.servers.updateVncConfig(serverId, fields);
    return { success: true };
  },
};
