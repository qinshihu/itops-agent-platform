/**
 * settingsRepository — settings 表的统一数据访问层
 *
 * 取代 settingsRoutes.ts / aiModelService.ts / credentialService.ts 等散落的 db.prepare 调用。
 * settings 表结构（v001）：id INTEGER PK, key TEXT UNIQUE, value TEXT, updated_at DATETIME
 */

import db from '../models/database';

export interface SettingRecord {
  id: number;
  key: string;
  value: string | null;
  updated_at: string;
}

export const settingsRepository = {
  /**
   * 按 key 获取值（最常用）
   * 返回 value 字符串，不存在则返回 undefined
   */
  getValue(key: string): string | undefined {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  },

  /**
   * 获取全部设置（按 key 排序）
   */
  getAll(): SettingRecord[] {
    return db.prepare('SELECT * FROM settings ORDER BY key').all() as SettingRecord[];
  },

  /**
   * 按前缀过滤设置（如 'DOUBAO_'）
   */
  getByKeyPrefix(prefix: string): SettingRecord[] {
    return db.prepare('SELECT * FROM settings WHERE key LIKE ? ORDER BY key').all(`${prefix}%`) as SettingRecord[];
  },

  /**
   * 批量获取多个 key 的值
   */
  getMany(keys: string[]): Record<string, string | undefined> {
    if (keys.length === 0) return {};
    const placeholders = keys.map(() => '?').join(',');
    const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).all(...keys) as Array<{ key: string; value: string }>;
    const result: Record<string, string | undefined> = {};
    for (const k of keys) result[k] = undefined;
    for (const r of rows) result[r.key] = r.value;
    return result;
  },

  /**
   * 插入或更新设置（upsert）
   * 与 settingsRoutes.ts 原有 ON CONFLICT 语义一致
   */
  upsert(key: string, value: string): void {
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now','localtime'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now','localtime')
    `).run(key, value, value);
  },

  /**
   * 批量 upsert
   */
  upsertMany(entries: Record<string, string>): void {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now','localtime'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now','localtime')
    `);
    for (const [key, value] of Object.entries(entries)) {
      stmt.run(key, value, value);
    }
  },

  /**
   * 删除指定 key
   */
  delete(key: string): void {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  },

  /**
   * 批量删除指定前缀的 key
   */
  deleteByPrefix(prefix: string): number {
    const result = db.prepare('DELETE FROM settings WHERE key LIKE ?').run(`${prefix}%`);
    return (result as { changes: number }).changes;
  },

  /**
   * 检查 key 是否存在
   */
  exists(key: string): boolean {
    const row = db.prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
    return !!row;
  },
};
