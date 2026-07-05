/**
 * imageRegistryRepository — image_registries 表数据访问层
 *
 * 覆盖表：image_registries (v045)
 */

import db from '../../models/database';

// ── 类型定义 ──

export interface ImageRegistryRecord {
  id: string;
  name: string;
  type: string;
  url: string;
  username: string | null;
  encrypted_password: string | null;
  encrypted_password_iv: string | null;
  status: string;
  error_message: string | null;
  project_count: number;
  repo_count: number;
  created_at: string;
  updated_at: string;
}

export interface ImageRegistryCreateInput {
  id: string;
  name: string;
  type: string;
  url: string;
  username?: string | null;
  encrypted_password?: string | null;
  encrypted_password_iv?: string | null;
  status?: string;
  project_count?: number;
  repo_count?: number;
}

// ── repository 实现 ──

export const imageRegistryRepository = {
  getById(id: string): ImageRegistryRecord | undefined {
    return db.prepare('SELECT * FROM image_registries WHERE id = ?').get(id) as ImageRegistryRecord | undefined;
  },

  list(): ImageRegistryRecord[] {
    return db.prepare('SELECT * FROM image_registries ORDER BY name').all() as ImageRegistryRecord[];
  },

  create(input: ImageRegistryCreateInput): void {
    db.prepare(`
      INSERT INTO image_registries (
        id, name, type, url, username, encrypted_password, encrypted_password_iv,
        status, error_message, project_count, repo_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.name,
      input.type,
      input.url,
      input.username ?? null,
      input.encrypted_password ?? null,
      input.encrypted_password_iv ?? null,
      input.status ?? 'unknown',
      null,
      input.project_count ?? 0,
      input.repo_count ?? 0,
    );
  },

  delete(id: string): void {
    db.prepare('DELETE FROM image_registries WHERE id = ?').run(id);
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
    db.prepare(`UPDATE image_registries SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  updateStatus(id: string, status: string, errorMessage?: string | null): void {
    db.prepare(`UPDATE image_registries SET status = ?, error_message = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(status, errorMessage ?? null, id);
  },
};