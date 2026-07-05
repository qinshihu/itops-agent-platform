import type { Server, SshKey, ServerGroup } from '../types/server';

// ── servers 表类型 ──

/** 服务器完整记录（与 types/server.ts 的 Server 一致，保留本地别名供兼容） */
export type ServerRecord = Server;

export interface ServerCreateInput {
  id: string;
  name: string;
  hostname: string;
  port?: number;
  username: string;
  password?: string | null;
  private_key?: string | null;
  use_ssh_key?: number;
  description?: string | null;
  tags?: string | null;
  os_type?: string;
  ssh_key_id?: string | null;
}

export interface ServerUpdateInput {
  name?: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string | null;
  private_key?: string | null;
  use_ssh_key?: number;
  description?: string | null;
  tags?: string | null;
  enabled?: number;
  os_type?: string;
  ssh_key_id?: string | null;
}

// ── server_groups / server_group_mapping 类型 ──

/** 服务器分组完整记录（与 types/server.ts 的 ServerGroup 一致） */
export type ServerGroupRecord = ServerGroup;

export interface ServerGroupCreateInput {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

// ── ssh_keys 类型 ──

/** SSH 密钥完整记录（与 types/server.ts 的 SshKey 一致） */
export type SshKeyRecord = SshKey;