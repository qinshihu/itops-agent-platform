/**
 * dbConnectionRepository — databases 表的统一数据访问层
 *
 * 取代 dbConnectionsRoutes.ts 中散落的 db.prepare 调用。
 * databases 表结构见 migration v016，存储外部数据库连接信息。
 * 注意：password 字段为加密存储，路由层负责在响应时抹掉密码。
 */

import db from '../models/database';

export interface DbConnectionRecord {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  description?: string | null;
  tags?: string | null;
  enabled: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DbConnectionInsertInput {
  id: string;
  name: string;
  db_type?: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  database: string;
  description?: string | null;
  tags?: string | null;
  enabled?: number;
}

export interface DbConnectionUpdateInput {
  name?: string;
  db_type?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  description?: string | null;
  tags?: string | null;
  enabled?: number;
}

export const dbConnectionRepository = {
  /** 列出所有数据库连接（按 created_at 倒序） */
  listAll(): DbConnectionRecord[] {
    return db.prepare('SELECT * FROM databases ORDER BY created_at DESC').all() as DbConnectionRecord[];
  },

  /** 按 ID 查询 */
  getById(id: string): DbConnectionRecord | undefined {
    return db.prepare('SELECT * FROM databases WHERE id = ?').get(id) as DbConnectionRecord | undefined;
  },

  /** 创建数据库连接 */
  insert(input: DbConnectionInsertInput): void {
    db.prepare(`
      INSERT INTO databases (id, name, db_type, host, port, username, password, database, description, tags, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.name,
      input.db_type ?? 'mysql',
      input.host,
      input.port ?? 3306,
      input.username,
      input.password,
      input.database,
      input.description ?? null,
      input.tags ?? null,
      input.enabled ?? 1
    );
  },

  /** 更新数据库连接（动态 SET，仅更新提供的字段） */
  update(id: string, fields: DbConnectionUpdateInput): number {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (fields.name !== undefined) { sets.push('name = ?'); params.push(fields.name); }
    if (fields.db_type !== undefined) { sets.push('db_type = ?'); params.push(fields.db_type); }
    if (fields.host !== undefined) { sets.push('host = ?'); params.push(fields.host); }
    if (fields.port !== undefined) { sets.push('port = ?'); params.push(fields.port); }
    if (fields.username !== undefined) { sets.push('username = ?'); params.push(fields.username); }
    if (fields.password !== undefined) { sets.push('password = ?'); params.push(fields.password); }
    if (fields.database !== undefined) { sets.push('database = ?'); params.push(fields.database); }
    if (fields.description !== undefined) { sets.push('description = ?'); params.push(fields.description); }
    if (fields.tags !== undefined) { sets.push('tags = ?'); params.push(fields.tags); }
    if (fields.enabled !== undefined) { sets.push('enabled = ?'); params.push(fields.enabled); }

    if (sets.length === 0) return 0;

    sets.push("updated_at = datetime('now','localtime')");
    params.push(id);

    return db.prepare(`UPDATE databases SET ${sets.join(', ')} WHERE id = ?`).run(...params).changes;
  },

  /** 删除数据库连接 */
  deleteById(id: string): number {
    return db.prepare('DELETE FROM databases WHERE id = ?').run(id).changes;
  },
};
