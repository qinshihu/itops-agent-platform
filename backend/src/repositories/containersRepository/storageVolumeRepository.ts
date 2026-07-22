/**
 * storageVolumeRepository — storage_volumes 表数据访问层
 *
 * 覆盖表：storage_volumes (v026)
 *
 * 注：与 Docker Volume（dockerService.listVolumes）是不同概念。
 *   - storage_volumes：服务器/存储层面的卷（LVM/NFS/Ceph/本地等）
 *   - Docker Volume：   Docker daemon 管理的容器卷（通过 volumeRoutes/docker-volumes 暴露）
 */

import db from '../../models/database';
// 2026-07-21 P0-8：保留 import 备用
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { StorageVolume } from '../types/containers';

// ── 类型定义 ──

export interface StorageVolumeRecord {
  id: string;
  name: string;
  driver: string;
  mount_point: string;
  size_gb: number;
  used_gb: number;
  status: string;
  host: string;
  type: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export type StorageVolumeInput = Omit<StorageVolumeRecord, 'created_at' | 'updated_at'>;

export interface StorageVolumeListFilters {
  search?: string;
  host?: string;
  type?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

// ── repository 实现 ──

export const storageVolumeRepository = {
  list(filters: StorageVolumeListFilters = {}): { rows: StorageVolumeRecord[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (filters.search) {
      where += ' AND (LOWER(name) LIKE ? OR LOWER(driver) LIKE ? OR LOWER(mount_point) LIKE ?)';
      const kw = `%${filters.search.toLowerCase()}%`;
      params.push(kw, kw, kw);
    }
    if (filters.host) { where += ' AND host = ?'; params.push(filters.host); }
    if (filters.type) { where += ' AND type = ?'; params.push(filters.type); }
    if (filters.status) { where += ' AND status = ?'; params.push(filters.status); }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM storage_volumes ${where}`).get(...params) as { count: number })?.count || 0;

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const rows = db.prepare(
      `SELECT * FROM storage_volumes ${where} ORDER BY name LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as StorageVolumeRecord[];

    return { rows, total };
  },

  getById(id: string): StorageVolumeRecord | undefined {
    return db.prepare('SELECT * FROM storage_volumes WHERE id = ?').get(id) as StorageVolumeRecord | undefined;
  },

  create(input: StorageVolumeInput): void {
    db.prepare(`
      INSERT INTO storage_volumes (
        id, name, driver, mount_point, size_gb, used_gb,
        status, host, type, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.name,
      input.driver ?? 'local',
      input.mount_point ?? '',
      input.size_gb ?? 0,
      input.used_gb ?? 0,
      input.status ?? 'available',
      input.host ?? '',
      input.type ?? 'docker',
      input.tags ?? '[]',
    );
  },

  update(id: string, fields: Record<string, unknown>): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && key !== 'id') {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (setClauses.length === 0) return;
    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);
    db.prepare(`UPDATE storage_volumes SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  delete(id: string): void {
    db.prepare('DELETE FROM storage_volumes WHERE id = ?').run(id);
  },
};
