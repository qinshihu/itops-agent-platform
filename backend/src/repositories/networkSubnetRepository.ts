/**
 * networkSubnetRepository — network_subnets / network_ips 表的统一数据访问层
 *
 * 取代 networkSubnetRoutes.ts 中散落的 db.prepare 调用。
 *
 * network_subnets 表结构（v031）：
 *   id, name, cidr, gateway, vlan_id, network_type, location, description,
 *   status, total_ips, used_ips, created_at, updated_at
 *
 * network_ips 表结构（v031）：
 *   id, subnet_id, ip_address, status, device_id, device_name, mac_address,
 *   description, created_at, updated_at
 */

import { randomUUID } from 'crypto';
import db from '../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { NetworkSubnet, NetworkIp } from './types/network';

// ── network_subnets 类型 ──

export interface NetworkSubnetRecord {
  id: string;
  name: string;
  cidr: string;
  gateway?: string | null;
  vlan_id?: number | null;
  network_type?: string | null;
  location?: string | null;
  description?: string | null;
  status?: string | null;
  total_ips?: number | null;
  used_ips?: number | null;
  created_at: string;
  updated_at: string;
}

/** 子网列表行（含 used_ips 动态统计） */
export interface NetworkSubnetListRow extends NetworkSubnetRecord {
  used_ips: number;
}

export interface NetworkSubnetCreateInput {
  id: string;
  name: string;
  cidr: string;
  gateway?: string | null;
  vlan_id?: number | null;
  network_type?: string;
  location?: string | null;
  description?: string | null;
  status?: string;
  total_ips?: number;
}

export interface NetworkSubnetUpdateInput {
  name?: string;
  gateway?: string | null;
  vlan_id?: number | null;
  network_type?: string;
  location?: string | null;
  description?: string | null;
  status?: string;
}

// ── network_ips 类型 ──

export interface NetworkIpRecord {
  id: string;
  subnet_id: string;
  ip_address: string;
  status: string;
  device_id?: string | null;
  device_name?: string | null;
  mac_address?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetworkIpUpdateInput {
  status?: string;
  device_name?: string | null;
  mac_address?: string | null;
  description?: string | null;
}

export interface NetworkIpListFilters {
  subnetId: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface NetworkIpBatchUpdateInput {
  status: string;
  device_name?: string | null;
  description?: string | null;
}

// ── network_subnets 子 repository ──

export const networkSubnetsRepo = {
  /** 列出全部子网（含已用 IP 数，按创建时间倒序） */
  list(): NetworkSubnetListRow[] {
    return db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM network_ips WHERE subnet_id = s.id AND status != 'available') as used_ips
      FROM network_subnets s ORDER BY s.created_at DESC
    `).all() as NetworkSubnetListRow[];
  },

  /** 按 ID 查询子网 */
  getById(id: string): NetworkSubnetRecord | undefined {
    return db.prepare('SELECT * FROM network_subnets WHERE id = ?').get(id) as NetworkSubnetRecord | undefined;
  },

  /** 创建子网 */
  create(input: NetworkSubnetCreateInput): void {
    db.prepare(`
      INSERT INTO network_subnets (id, name, cidr, gateway, vlan_id, network_type, location, description, status, total_ips)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.cidr,
      input.gateway ?? null,
      input.vlan_id ?? null,
      input.network_type || 'lan',
      input.location ?? null,
      input.description ?? null,
      input.status || 'active',
      input.total_ips ?? 0,
    );
  },

  /** 更新子网（COALESCE 部分更新） */
  update(id: string, input: NetworkSubnetUpdateInput): void {
    db.prepare(`
      UPDATE network_subnets
      SET name = COALESCE(?, name), gateway = COALESCE(?, gateway), vlan_id = COALESCE(?, vlan_id),
          network_type = COALESCE(?, network_type), location = COALESCE(?, location),
          description = COALESCE(?, description), status = COALESCE(?, status),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.name ?? null,
      input.gateway !== undefined ? input.gateway : null,
      input.vlan_id !== undefined ? input.vlan_id : null,
      input.network_type ?? null,
      input.location !== undefined ? input.location : null,
      input.description !== undefined ? input.description : null,
      input.status ?? null,
      id,
    );
  },

  /** 按 ID 删除子网 */
  delete(id: string): void {
    db.prepare('DELETE FROM network_subnets WHERE id = ?').run(id);
  },
};

// ── network_ips 子 repository ──

export const networkIpsRepo = {
  /** 列出子网下的 IP（带过滤+分页） */
  list(filters: NetworkIpListFilters): NetworkIpRecord[] {
    let sql = 'SELECT * FROM network_ips WHERE subnet_id = ?';
    const params: (string | number)[] = [filters.subnetId];

    if (filters.status && filters.status !== 'all') {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      sql += ' AND (ip_address LIKE ? OR device_name LIKE ? OR mac_address LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY ip_address ASC LIMIT ? OFFSET ?';
    params.push(filters.limit ?? 100, filters.offset ?? 0);

    return db.prepare(sql).all(...params) as NetworkIpRecord[];
  },

  /** 统计 IP 数量（带过滤） */
  count(filters: Omit<NetworkIpListFilters, 'limit' | 'offset'>): number {
    let sql = 'SELECT COUNT(*) as total FROM network_ips WHERE subnet_id = ?';
    const params: (string | number)[] = [filters.subnetId];

    if (filters.status && filters.status !== 'all') {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      sql += ' AND (ip_address LIKE ? OR device_name LIKE ? OR mac_address LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    return (db.prepare(sql).get(...params) as { total: number }).total;
  },

  /** 按状态分组统计 IP 数量 */
  statsByStatus(subnetId: string): Array<{ status: string; count: number }> {
    return db.prepare(`
      SELECT status, COUNT(*) as count FROM network_ips WHERE subnet_id = ?
      GROUP BY status
    `).all(subnetId) as Array<{ status: string; count: number }>;
  },

  /**
   * 批量插入可用 IP（事务包裹，用于子网创建时自动生成地址池）
   * @param subnetId 子网 ID
   * @param ips IP 地址数组
   */
  bulkInsertAvailable(subnetId: string, ips: string[]): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO network_ips (id, subnet_id, ip_address, status)
      VALUES (?, ?, ?, 'available')
    `);
    const insertMany = db.transaction(() => {
      for (const ip of ips) {
        stmt.run(randomUUID(), subnetId, ip);
      }
    });
    insertMany();
  },

  /** 更新单个 IP（COALESCE 部分更新，需同时匹配 id 和 subnet_id） */
  update(ipId: string, subnetId: string, input: NetworkIpUpdateInput): void {
    db.prepare(`
      UPDATE network_ips
      SET status = COALESCE(?, status), device_name = COALESCE(?, device_name),
          mac_address = COALESCE(?, mac_address), description = COALESCE(?, description),
          updated_at = datetime('now','localtime')
      WHERE id = ? AND subnet_id = ?
    `).run(
      input.status ?? null,
      input.device_name !== undefined ? input.device_name : null,
      input.mac_address !== undefined ? input.mac_address : null,
      input.description !== undefined ? input.description : null,
      ipId,
      subnetId,
    );
  },

  /**
   * 批量更新 IP（事务包裹，统一设置 status/device_name/description）
   * @param ipIds IP ID 数组
   * @param subnetId 子网 ID
   * @param input 批量更新字段
   */
  batchUpdate(ipIds: string[], subnetId: string, input: NetworkIpBatchUpdateInput): void {
    const stmt = db.prepare(`
      UPDATE network_ips
      SET status = ?, device_name = ?, description = COALESCE(?, description),
          updated_at = datetime('now','localtime')
      WHERE id = ? AND subnet_id = ?
    `);
    const batchUpdate = db.transaction(() => {
      for (const ipId of ipIds) {
        stmt.run(input.status, input.device_name ?? null, input.description ?? null, ipId, subnetId);
      }
    });
    batchUpdate();
  },
};

// ── 聚合导出（兼容 networkSubnetRepository.* 调用风格）──

export const networkSubnetRepository = {
  subnets: networkSubnetsRepo,
  ips: networkIpsRepo,
};
