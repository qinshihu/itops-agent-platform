/**
 * virtualMachineRepository — virtual_machines 表的统一数据访问层
 *
 * 取代 virtualMachineRoutes.ts 中散落的 db.prepare 调用。
 * virtual_machines 表结构见 migration v023。
 */

import db from '../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { VirtualMachine } from './types/containers';

export interface VirtualMachineRecord {
  id: string;
  name: string;
  host?: string | null;
  status?: string | null;
  os?: string | null;
  cpu_cores?: number | null;
  memory_mb?: number | null;
  disk_gb?: number | null;
  ip_address?: string | null;
  hypervisor?: string | null;
  agent_id?: string | null;
  server_id?: string | null;
  tags?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface VirtualMachineListFilters {
  status?: string;
  hostId?: string;
  hypervisor?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface VirtualMachineInsertInput {
  id: string;
  name: string;
  host?: string | null;
  status?: string | null;
  os?: string | null;
  cpu_cores?: number | null;
  memory_mb?: number | null;
  disk_gb?: number | null;
  ip_address?: string | null;
  hypervisor?: string | null;
  agent_id?: string | null;
  server_id?: string | null;
  tags?: string | null;
  notes?: string | null;
}

export interface VirtualMachineUpdateInput {
  name?: string;
  host?: string;
  status?: string;
  os?: string;
  cpu_cores?: number;
  memory_mb?: number;
  disk_gb?: number;
  ip_address?: string;
  hypervisor?: string;
  tags?: string;
  notes?: string;
}

export interface VirtualMachineUpsertInput {
  id: string;
  name: string;
  host?: string | null;
  status?: string | null;
  os?: string | null;
  cpu_cores?: number | null;
  memory_mb?: number | null;
  disk_gb?: number | null;
  ip_address?: string | null;
  hypervisor?: string | null;
}

function buildWhereClause(filters: VirtualMachineListFilters): { where: string; params: unknown[] } {
  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (filters.status) {
    where += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.hostId) {
    where += ' AND host_id = ?';
    params.push(filters.hostId);
  }
  if (filters.hypervisor) {
    where += ' AND hypervisor = ?';
    params.push(filters.hypervisor);
  }
  if (filters.search) {
    where += ' AND (name LIKE ? OR host LIKE ? OR ip_address LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }
  return { where, params };
}

export const virtualMachineRepository = {
  /** 全表计数（SQLite 后备统计用） */
  countAll(): number {
    return (db.prepare('SELECT COUNT(*) as count FROM virtual_machines').get() as { count: number }).count;
  },

  /** 按状态分组计数 */
  countByStatus(): Array<{ status: string; count: number }> {
    return db.prepare('SELECT status, COUNT(*) as count FROM virtual_machines GROUP BY status').all() as Array<{ status: string; count: number }>;
  },

  /** 按过滤条件计数 */
  count(filters: VirtualMachineListFilters = {}): number {
    const { where, params } = buildWhereClause(filters);
    return (db.prepare(`SELECT COUNT(*) as count FROM virtual_machines ${where}`).get(...params) as { count: number }).count;
  },

  /** 列表查询（支持过滤+分页） */
  list(filters: VirtualMachineListFilters = {}): VirtualMachineRecord[] {
    const { where, params } = buildWhereClause(filters);
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    return db.prepare(`SELECT * FROM virtual_machines ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as VirtualMachineRecord[];
  },

  /** 按 ID 查询 */
  getById(id: string): VirtualMachineRecord | undefined {
    return db.prepare('SELECT * FROM virtual_machines WHERE id = ?').get(id) as VirtualMachineRecord | undefined;
  },

  /** 插入新 VM */
  insert(input: VirtualMachineInsertInput): void {
    db.prepare(`
      INSERT INTO virtual_machines (id, name, host, status, os, cpu_cores, memory_mb, disk_gb, ip_address, hypervisor, agent_id, server_id, tags, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.host ?? '',
      input.status ?? 'stopped',
      input.os ?? '',
      input.cpu_cores ?? 0,
      input.memory_mb ?? 0,
      input.disk_gb ?? 0,
      input.ip_address ?? '',
      input.hypervisor ?? '',
      input.agent_id ?? '',
      input.server_id ?? '',
      input.tags ?? JSON.stringify([]),
      input.notes ?? ''
    );
  },

  /** 更新 VM（动态 SET） */
  update(id: string, fields: VirtualMachineUpdateInput): number {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (fields.name !== undefined) { sets.push('name = ?'); params.push(fields.name); }
    if (fields.host !== undefined) { sets.push('host = ?'); params.push(fields.host); }
    if (fields.status !== undefined) { sets.push('status = ?'); params.push(fields.status); }
    if (fields.os !== undefined) { sets.push('os = ?'); params.push(fields.os); }
    if (fields.cpu_cores !== undefined) { sets.push('cpu_cores = ?'); params.push(fields.cpu_cores); }
    if (fields.memory_mb !== undefined) { sets.push('memory_mb = ?'); params.push(fields.memory_mb); }
    if (fields.disk_gb !== undefined) { sets.push('disk_gb = ?'); params.push(fields.disk_gb); }
    if (fields.ip_address !== undefined) { sets.push('ip_address = ?'); params.push(fields.ip_address); }
    if (fields.hypervisor !== undefined) { sets.push('hypervisor = ?'); params.push(fields.hypervisor); }
    if (fields.tags !== undefined) { sets.push('tags = ?'); params.push(fields.tags); }
    if (fields.notes !== undefined) { sets.push('notes = ?'); params.push(fields.notes); }

    if (sets.length === 0) return 0;

    sets.push("updated_at = datetime('now','localtime')");
    params.push(id);

    return db.prepare(`UPDATE virtual_machines SET ${sets.join(', ')} WHERE id = ?`).run(...params).changes;
  },

  /** 删除 VM */
  deleteById(id: string): number {
    return db.prepare('DELETE FROM virtual_machines WHERE id = ?').run(id).changes;
  },

  /** 更新状态（电源操作后同步 SQLite） */
  updateStatus(id: string, status: string): number {
    return db.prepare("UPDATE virtual_machines SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(status, id).changes;
  },

  /** 同步 Hypervisor 数据（upsert） */
  upsertFromHypervisor(input: VirtualMachineUpsertInput): void {
    db.prepare(`
      INSERT INTO virtual_machines (id, name, host, status, os, cpu_cores, memory_mb, disk_gb, ip_address, hypervisor, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, host = excluded.host, status = excluded.status,
        os = excluded.os, cpu_cores = excluded.cpu_cores, memory_mb = excluded.memory_mb,
        disk_gb = excluded.disk_gb, ip_address = excluded.ip_address,
        hypervisor = excluded.hypervisor, updated_at = datetime('now','localtime')
    `).run(
      input.id,
      input.name,
      input.host ?? '',
      input.status ?? '',
      input.os ?? '',
      input.cpu_cores ?? 0,
      input.memory_mb ?? 0,
      input.disk_gb ?? 0,
      input.ip_address ?? '',
      input.hypervisor ?? ''
    );
  },

  /** 插入或替换（克隆 VM 后同步） */
  insertOrReplace(input: VirtualMachineUpsertInput): void {
    db.prepare(`
      INSERT OR REPLACE INTO virtual_machines (id, name, host, status, os, cpu_cores, memory_mb, disk_gb, ip_address, hypervisor, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      input.id,
      input.name,
      input.host ?? '',
      input.status ?? '',
      input.os ?? '',
      input.cpu_cores ?? 0,
      input.memory_mb ?? 0,
      input.disk_gb ?? 0,
      input.ip_address ?? '',
      input.hypervisor ?? ''
    );
  },
};
