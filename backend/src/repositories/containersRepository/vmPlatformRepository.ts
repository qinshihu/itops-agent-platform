/**
 * vmPlatformRepository — vm_platforms 表数据访问层
 *
 * 覆盖表：vm_platforms (v055)
 */

import db from '../../models/database';

// ── 类型定义 ──

export interface VmPlatformRecord {
  id: string;
  name: string;
  hypervisor_type: string;
  host: string;
  port: number | null;
  username: string | null;
  encrypted_password: string | null;
  encrypted_password_iv: string | null;
  config: string | null;
  status: string;
  last_connected: string | null;
  error_message: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface VmPlatformCreateInput {
  id: string;
  name: string;
  hypervisor_type: string;
  host: string;
  port?: number | null;
  username?: string | null;
  encrypted_password?: string | null;
  encrypted_password_iv?: string | null;
  config?: string | null;
  status?: string;
  tags?: string | null;
}

// ── repository 实现 ──

export const vmPlatformRepository = {
  listByStatus(status: string): VmPlatformRecord[] {
    return db.prepare('SELECT * FROM vm_platforms WHERE status = ? ORDER BY name').all(status) as VmPlatformRecord[];
  },

  list(): VmPlatformRecord[] {
    return db.prepare('SELECT * FROM vm_platforms ORDER BY name').all() as VmPlatformRecord[];
  },

  getById(id: string): VmPlatformRecord | undefined {
    return db.prepare('SELECT * FROM vm_platforms WHERE id = ?').get(id) as VmPlatformRecord | undefined;
  },

  create(input: VmPlatformCreateInput): void {
    db.prepare(`
      INSERT INTO vm_platforms (
        id, name, hypervisor_type, host, port, username,
        encrypted_password, encrypted_password_iv, config, status, tags,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.name,
      input.hypervisor_type,
      input.host,
      input.port ?? null,
      input.username ?? null,
      input.encrypted_password ?? null,
      input.encrypted_password_iv ?? null,
      input.config ?? null,
      input.status ?? 'unknown',
      input.tags ?? null,
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
    db.prepare(`UPDATE vm_platforms SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  delete(id: string): void {
    db.prepare('DELETE FROM vm_platforms WHERE id = ?').run(id);
  },

  updateStatus(id: string, status: string, errorMessage?: string | null): void {
    db.prepare(`UPDATE vm_platforms SET status = ?, error_message = ?, last_connected = CASE WHEN ? = 'connected' THEN datetime('now','localtime') ELSE last_connected END, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(status, errorMessage ?? null, status, id);
  },
};