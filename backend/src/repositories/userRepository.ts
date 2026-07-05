/**
 * userRepository — users 表的统一数据访问层
 *
 * 取代 userRoutes.ts / authRoutes.ts / loginThrottler.ts /
 *       middleware/auth.ts / shared/websocket/handler.ts 等散落的 db.prepare 调用。
 *
 * users 表结构（v001 + v008，id 已从 INTEGER 改为 TEXT）：
 *   id(TEXT PK), username(UNIQUE NOT NULL), password(NOT NULL), email,
 *   role(NOT NULL), enabled(DEFAULT 1), password_must_change(DEFAULT 0),
 *   failed_login_attempts(DEFAULT 0), locked_until, last_failed_login,
 *   created_at, updated_at
 *
 * 注意：密码哈希（bcrypt）保留在路由/服务层，仓库仅接收已哈希的密码。
 */

import db from '../models/database';
import type { User } from './types/auth';

// ── 类型定义 ──

/** 用户完整记录（与 types/auth.ts 的 User 一致，保留本地别名供兼容） */
export type UserRecord = User;

/** 管理员列表展示字段（不含密码） */
export interface UserListItem {
  id: string;
  username: string;
  email: string | null;
  role: string;
  enabled: number;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
}

/** 认证所需字段（含密码） */
export interface UserAuthRecord {
  id: string;
  username: string;
  password: string;
  role: string;
  email: string | null;
  enabled: number;
  password_must_change: number;
}

/** 缓存用户字段（中间件/WebSocket 用） */
export interface UserCacheFields {
  id: string;
  username: string;
  email: string | null;
  role: string;
  enabled: number;
  password_must_change?: number;
}

/** 登录锁定状态字段 */
export interface UserLockoutStatus {
  id: string;
  failed_login_attempts: number;
  locked_until: string | null;
}

/** 创建用户输入（密码已哈希） */
export interface UserCreateInput {
  id: string;
  username: string;
  hashedPassword: string;
  email?: string | null;
  role: string;
  enabled: number;
  passwordMustChange?: number;
}

/** 动态更新字段 */
export interface UserUpdateInput {
  username?: string;
  email?: string | null;
  role?: string;
  enabled?: number;
  password?: string;
}

// ── repository 实现 ──

export const userRepository = {
  // ── SELECT：列表 ──

  /**
   * 列出全部用户（管理员视图，不含密码）
   * 对应 userRoutes.ts 1.1
   */
  list(): UserListItem[] {
    return db.prepare(`
      SELECT id, username, email, role, enabled, failed_login_attempts, locked_until, created_at
      FROM users
      ORDER BY created_at DESC
    `).all() as UserListItem[];
  },

  // ── SELECT：单条查询 ──

  /**
   * 按 id 获取完整记录（含密码，用于修改密码前置检查）
   * 对应 userRoutes.ts 1.5 / authRoutes.ts 1.9
   */
  getById(id: string): UserRecord | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | undefined;
  },

  /**
   * 按 id 获取管理员视图字段（不含密码）
   * 对应 userRoutes.ts 1.2
   */
  getByIdSafe(id: string): UserListItem | undefined {
    return db.prepare(`
      SELECT id, username, email, role, enabled, failed_login_attempts, locked_until, created_at
      FROM users WHERE id = ?
    `).get(id) as UserListItem | undefined;
  },

  /**
   * 按 id 获取 username（删除/解锁前置查询）
   * 对应 userRoutes.ts 1.4
   */
  getUsername(id: string): string | undefined {
    const row = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as { username: string } | undefined;
    return row?.username;
  },

  /**
   * 按用户名获取完整记录（登录用，含密码）
   * 对应 authRoutes.ts 1.6
   */
  getByUsername(username: string): UserRecord | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRecord | undefined;
  },

  /**
   * 按用户名获取认证字段（登录验证用）
   * 对应 authRoutes.ts 1.6
   */
  getForAuth(username: string): UserAuthRecord | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserAuthRecord | undefined;
  },

  /**
   * 按用户名获取 id（存在性检查）
   * 对应 userRoutes.ts 1.3 / database.ts 1.14
   */
  getIdByUsername(username: string): string | undefined {
    const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
    return row?.id;
  },

  /**
   * 按用户名检查是否存在
   * 对应 userRoutes.ts 1.3
   */
  existsByUsername(username: string): boolean {
    const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    return !!row;
  },

  /**
   * 按 id 获取用户档案（/me 端点用）
   * 对应 authRoutes.ts 1.8
   */
  getProfile(id: string): { id: string; username: string; email: string | null; role: string; enabled: number; created_at: string } | undefined {
    return db.prepare('SELECT id, username, email, role, enabled, created_at FROM users WHERE id = ?')
      .get(id) as { id: string; username: string; email: string | null; role: string; enabled: number; created_at: string } | undefined;
  },

  /**
   * 按 id 获取缓存字段（auth 中间件用，含 password_must_change）
   * 对应 middleware/auth.ts 1.10
   */
  getCachedFields(id: string): UserCacheFields | undefined {
    return db.prepare('SELECT id, username, email, role, enabled, password_must_change FROM users WHERE id = ?')
      .get(id) as UserCacheFields | undefined;
  },

  /**
   * 按 id 获取 WebSocket 认证字段（不含 password_must_change）
   * 对应 shared/websocket/handler.ts 1.11
   */
  getForWebSocket(id: string): { id: string; username: string; email: string | null; role: string; enabled: number } | undefined {
    return db.prepare('SELECT id, username, email, role, enabled FROM users WHERE id = ?')
      .get(id) as { id: string; username: string; email: string | null; role: string; enabled: number } | undefined;
  },

  /**
   * 按用户名获取锁定状态（登录限流用）
   * 对应 loginThrottler.ts 1.12
   */
  getLockoutStatus(username: string): UserLockoutStatus | undefined {
    return db.prepare('SELECT id, failed_login_attempts, locked_until FROM users WHERE username = ?')
      .get(username) as UserLockoutStatus | undefined;
  },

  /**
   * 按用户名获取失败登录次数
   * 对应 loginThrottler.ts 1.13
   */
  getFailedAttempts(username: string): { id: string; failed_login_attempts: number } | undefined {
    return db.prepare('SELECT id, failed_login_attempts FROM users WHERE username = ?')
      .get(username) as { id: string; failed_login_attempts: number } | undefined;
  },

  // ── SELECT：统计 ──

  /**
   * 统计用户总数
   * 对应 database.ts 1.15
   */
  countAll(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return row.count;
  },

  // ── INSERT ──

  /**
   * 创建用户（密码已哈希，8 字段）
   * 对应 userRoutes.ts 2.1
   */
  create(input: UserCreateInput): void {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, username, password, email, role, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.username,
      input.hashedPassword,
      input.email ?? null,
      input.role,
      input.enabled,
      now,
      now
    );
  },

  /**
   * 创建默认管理员（7 字段，含 password_must_change）
   * 对应 database.ts 2.2
   */
  createDefaultAdmin(input: {
    id: string; username: string; hashedPassword: string; email: string; role: string; enabled: number; passwordMustChange: number;
  }): void {
    db.prepare(`
      INSERT INTO users (id, username, password, email, role, enabled, password_must_change)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.username,
      input.hashedPassword,
      input.email,
      input.role,
      input.enabled,
      input.passwordMustChange
    );
  },

  // ── UPDATE ──

  /**
   * 动态更新用户字段（构建 SET 子句）
   * 对应 userRoutes.ts 3.1
   * 密码字段应为已哈希的值
   */
  update(id: string, fields: UserUpdateInput): number {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (fields.username !== undefined) { setClauses.push('username = ?'); values.push(fields.username); }
    if (fields.email !== undefined) { setClauses.push('email = ?'); values.push(fields.email); }
    if (fields.role !== undefined) { setClauses.push('role = ?'); values.push(fields.role); }
    if (fields.enabled !== undefined) { setClauses.push('enabled = ?'); values.push(fields.enabled); }
    if (fields.password !== undefined) { setClauses.push('password = ?'); values.push(fields.password); }

    if (setClauses.length === 0) return 0;

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const result = db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return (result as { changes: number }).changes;
  },

  /**
   * 修改密码（password + password_must_change=0）
   * 对应 authRoutes.ts 3.4
   * 密码应为已哈希的值
   */
  updatePassword(id: string, hashedPassword: string): number {
    const result = db.prepare(`
      UPDATE users
      SET password = ?, password_must_change = 0, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(hashedPassword, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 登录成功后更新 updated_at
   * 对应 authRoutes.ts 3.3
   */
  touchLogin(id: string): void {
    db.prepare("UPDATE users SET updated_at = datetime('now','localtime') WHERE id = ?").run(id);
  },

  /**
   * 解锁用户（重置失败次数和锁定时间）
   * 对应 userRoutes.ts 3.2 / loginThrottler.ts 3.8
   */
  unlock(id: string): void {
    db.prepare(`
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(id);
  },

  /**
   * 清除锁定状态（不更新 updated_at）
   * 对应 loginThrottler.ts 3.5
   */
  clearLockout(id: string): void {
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(id);
  },

  /**
   * 记录失败登录（达到阈值，含 locked_until）
   * 对应 loginThrottler.ts 3.6
   */
  recordFailedLoginWithLock(id: string, attempts: number, lockedUntilIso: string, nowIso: string): void {
    db.prepare(`
      UPDATE users
      SET failed_login_attempts = ?, locked_until = ?, last_failed_login = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(attempts, lockedUntilIso, nowIso, id);
  },

  /**
   * 记录失败登录（未达阈值，无 locked_until）
   * 对应 loginThrottler.ts 3.7
   */
  recordFailedLogin(id: string, attempts: number, nowIso: string): void {
    db.prepare(`
      UPDATE users
      SET failed_login_attempts = ?, last_failed_login = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(attempts, nowIso, id);
  },

  // ── DELETE ──

  /**
   * 按 id 删除用户
   * 对应 userRoutes.ts 4.1
   */
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return (result as { changes: number }).changes > 0;
  },
};
