import db from '../../models/database';
import type { SshKeyRecord } from './types';

// ── sshKeys 子 repository ──

export const sshKeysRepo = {
  /**
   * 列出全部 SSH key（含 usage_count 聚合）
   */
  list(): Array<SshKeyRecord & { usage_count: number }> {
    return db.prepare(`
      SELECT sk.id, sk.name, sk.auth_type, sk.key_type, sk.fingerprint, sk.username, sk.description, sk.created_at, sk.updated_at,
             COUNT(DISTINCT s.id) as usage_count
      FROM ssh_keys sk
      LEFT JOIN servers s ON s.ssh_key_id = sk.id
      GROUP BY sk.id
      ORDER BY sk.created_at DESC
    `).all() as Array<SshKeyRecord & { usage_count: number }>;
  },

  /** 按 ID 查询（含敏感字段） */
  getById(id: string): SshKeyRecord | undefined {
    return db.prepare(
      'SELECT id, name, auth_type, key_type, fingerprint, username, password, private_key, description, created_at, updated_at FROM ssh_keys WHERE id = ?'
    ).get(id) as SshKeyRecord | undefined;
  },

  /** 按名称查询（用于重名检查） */
  findByName(name: string): { id: string } | undefined {
    return db.prepare('SELECT id FROM ssh_keys WHERE name = ?').get(name) as { id: string } | undefined;
  },

  /** 按名称查询（排除自身，用于更新时重名检查） */
  findByNameExcludeId(name: string, excludeId: string): { id: string } | undefined {
    return db.prepare('SELECT id FROM ssh_keys WHERE name = ? AND id != ?').get(name, excludeId) as { id: string } | undefined;
  },

  /** 按 ID 检查存在性 */
  existsById(id: string): boolean {
    const row = db.prepare('SELECT id FROM ssh_keys WHERE id = ?').get(id);
    return !!row;
  },

  /** 统计使用该 key 的服务器数 */
  countUsage(keyId: string): number {
    return (db.prepare('SELECT COUNT(*) as c FROM servers WHERE ssh_key_id = ?').get(keyId) as { c: number }).c;
  },

  /** 列出使用该 key 的服务器 */
  listServersByKey(keyId: string): Array<{ id: string; name: string; hostname: string }> {
    return db.prepare('SELECT id, name, hostname FROM servers WHERE ssh_key_id = ?').all(keyId) as Array<{ id: string; name: string; hostname: string }>;
  },

  /** 创建 SSH key（key 类型） */
  createKey(input: {
    id: string;
    name: string;
    key_type: string;
    fingerprint: string;
    private_key: string;
    description?: string | null;
  }): void {
    db.prepare(
      `INSERT INTO ssh_keys (id, name, auth_type, key_type, fingerprint, private_key, description)
       VALUES (?, ?, 'key', ?, ?, ?, ?)`
    ).run(input.id, input.name, input.key_type, input.fingerprint, input.private_key, input.description ?? null);
  },

  /** 创建 SSH key（password 类型） */
  createPassword(input: {
    id: string;
    name: string;
    username: string;
    password: string;
    description?: string | null;
  }): void {
    db.prepare(
      `INSERT INTO ssh_keys (id, name, auth_type, key_type, username, password, description)
       VALUES (?, ?, 'password', 'password', ?, ?, ?)`
    ).run(input.id, input.name, input.username, input.password, input.description ?? null);
  },

  /**
   * 更新 SSH key（COALESCE + CASE 模式，与 sshKeyRoutes.ts 原有语义一致）
   */
  update(id: string, input: {
    name?: string;
    auth_type?: string;
    key_type?: string;
    fingerprint?: string;
    username?: string | null;
    password?: string | null;
    private_key?: string | null;
    description?: string | null;
  }): void {
    db.prepare(
      `UPDATE ssh_keys
       SET name = COALESCE(?, name),
           auth_type = COALESCE(?, auth_type),
           key_type = COALESCE(?, key_type),
           fingerprint = COALESCE(?, fingerprint),
           username = COALESCE(?, username),
           password = CASE WHEN ? IS NOT NULL THEN ? ELSE password END,
           private_key = CASE WHEN ? IS NOT NULL THEN ? ELSE private_key END,
           description = COALESCE(?, description),
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      input.name ?? null,
      input.auth_type ?? null,
      input.key_type ?? null,
      input.fingerprint ?? null,
      input.username ?? null,
      input.password ?? null,
      input.password ?? null,
      input.private_key ?? null,
      input.private_key ?? null,
      input.description ?? null,
      id
    );
  },

  /** 删除 SSH key */
  delete(id: string): void {
    db.prepare('DELETE FROM ssh_keys WHERE id = ?').run(id);
  },
};