/**
 * 认证模块集成测试
 *
 * 使用真实 SQLite 内存数据库（非 mock），通过 supertest 测试完整的 HTTP 认证流程：
 * - 用户登录 / 获取当前用户信息 / Token 刷新 / 登出
 * - 验证数据库状态变化（审计日志、token 黑名单）
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// ============================================================
// Mock：logger —— 抑制测试日志输出
// ============================================================
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    startTimer: vi.fn(() => ({ end: vi.fn() })),
    shutdown: vi.fn(),
  },
}));

// ============================================================
// Mock：env —— 提供确定性 JWT 密钥与测试配置
// ============================================================
vi.mock('../../utils/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-for-integration-tests-32chars',
    JWT_EXPIRES_IN: '24h',
    NODE_ENV: 'test',
    DATABASE_PATH: ':memory:',
    PORT: 3001,
    LOG_LEVEL: 'info',
    ALLOWED_ORIGINS: ['http://localhost:3000'],
    WEBHOOK_VERIFY_ENABLED: 'false' as const,
  },
}));

// ============================================================
// Mock：database —— 用真实 SQLite 内存数据库替换全局 db 单例
// factory 异步初始化：创建库 → 运行全部迁移 → 返回 db 实例
// 所有 repository / tokenBlacklist / loginThrottler 均通过此 mock 获取真实 DB
// ============================================================
vi.mock('../../models/database', async () => {
  const { createTestDatabase } = await import('./testDb');
  const db = await createTestDatabase();
  return {
    default: db,
    db,
    initializeDatabase: vi.fn(),
    performMaintenance: vi.fn(),
    getIOInstance: vi.fn(),
    setIOInstance: vi.fn(),
    getDbInstance: () => db,
  };
});

// ============================================================
// Import —— 在 mock 生效后加载 auth 路由及测试工具
// ============================================================
import authRouter from '../../modules/auth/routes/authRoutes';
import { getTestDb, cleanupTestDatabase } from './testDb';
import { clearUserCache } from '../../middleware/auth';

// ============================================================
// 构建 Express App —— 仅挂载 auth 路由
// ============================================================
const app: Express = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// ============================================================
// 测试数据
// ============================================================
const TEST_USER = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  username: 'testadmin',
  password: 'Test@1234',
  email: 'testadmin@example.com',
  role: 'admin',
};

// ============================================================
// 辅助：登录并返回 token
// ============================================================
async function loginAndGetTokens() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: TEST_USER.username, password: TEST_USER.password });
  return {
    token: res.body.data?.token as string,
    refreshToken: res.body.data?.refreshToken as string,
    loginResponse: res,
  };
}

// ============================================================
// 测试套件
// ============================================================
describe('Auth Integration Tests', () => {

  beforeAll(() => {
    // 插入测试用户（密码已哈希，与生产注册流程一致）
    const db = getTestDb();
    const hashedPassword = bcrypt.hashSync(TEST_USER.password, 12);
    db.prepare(`
      INSERT INTO users (id, username, password, email, role, enabled, password_must_change)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      TEST_USER.id,
      TEST_USER.username,
      hashedPassword,
      TEST_USER.email,
      TEST_USER.role,
      1,  // enabled
      0,  // password_must_change = false
    );
  });

  afterAll(() => {
    cleanupTestDatabase();
  });

  beforeEach(() => {
    // 每个测试前重置登录限流状态、token 黑名单 & 用户缓存，避免测试间状态泄漏
    const db = getTestDb();
    db.prepare(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = ?'
    ).run(TEST_USER.username);
    db.prepare('DELETE FROM token_blacklist').run();
    clearUserCache();
  });

  // ──────────────────────────────────────────────────────────
  // POST /api/auth/login
  // ──────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {

    it('有效凭据 → 返回 token、refreshToken 和用户信息', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: TEST_USER.username, password: TEST_USER.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('登录成功');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.id).toBe(TEST_USER.id);
      expect(res.body.data.user.username).toBe(TEST_USER.username);
      expect(res.body.data.user.role).toBe(TEST_USER.role);
      expect(res.body.data.user.passwordMustChange).toBe(false);
    });

    it('错误密码 → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: TEST_USER.username, password: 'WrongPassword1!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('不存在的用户 → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'ghost_user', password: 'SomePassword1!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('空字段 → 400（参数校验）', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────
  // GET /api/auth/me
  // ──────────────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {

    it('有效 token → 返回用户档案', async () => {
      const { token } = await loginAndGetTokens();

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(TEST_USER.id);
      expect(res.body.data.username).toBe(TEST_USER.username);
      expect(res.body.data.email).toBe(TEST_USER.email);
      expect(res.body.data.role).toBe(TEST_USER.role);
    });

    it('无 token → 401', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('无效 token → 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────
  // POST /api/auth/refresh
  // ──────────────────────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {

    it('有效 refreshToken → 返回新的 token 对', async () => {
      const { token: oldToken, refreshToken } = await loginAndGetTokens();

      // 等待 1.1s 确保新 JWT 的 iat 时间戳不同（JWT 精度为秒）
      await new Promise(r => setTimeout(r, 1100));

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      // 新 token 应与旧 token 不同
      expect(res.body.data.token).not.toBe(oldToken);
      expect(res.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('缺少 refreshToken → 400', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('无效 refreshToken → 401', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.refresh.token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('已刷新过的 refreshToken 再次使用 → 401（已被加入黑名单）', async () => {
      // 等待 1.1s 确保本次 refreshToken 与前序测试的不同（JWT iat 精度为秒）
      await new Promise(r => setTimeout(r, 1100));

      const { refreshToken } = await loginAndGetTokens();

      // 第一次刷新成功，旧 token 被加入黑名单
      const firstRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(firstRefresh.status).toBe(200);

      // 第二次使用同一 refreshToken → 应被拒绝
      const secondRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(secondRefresh.status).toBe(401);
      expect(secondRefresh.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────
  // POST /api/auth/logout
  // ──────────────────────────────────────────────────────────
  describe('POST /api/auth/logout', () => {

    it('有效 token → 登出成功，token 被加入黑名单', async () => {
      const { token } = await loginAndGetTokens();

      // 登出
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('退出成功');

      // 验证 token 已失效 —— 用同一 token 访问 /me 应返回 401
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(401);
      expect(meRes.body.success).toBe(false);
    });

    it('无 token → 401', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 数据库状态验证
  // ──────────────────────────────────────────────────────────
  describe('数据库状态', () => {

    it('登录后应写入 audit_logs 表', async () => {
      const db = getTestDb();

      const before = (db.prepare(
        'SELECT COUNT(*) as count FROM audit_logs WHERE action = ? AND user_id = ?'
      ).get('login', TEST_USER.id) as { count: number }).count;

      await loginAndGetTokens();

      const after = (db.prepare(
        'SELECT COUNT(*) as count FROM audit_logs WHERE action = ? AND user_id = ?'
      ).get('login', TEST_USER.id) as { count: number }).count;

      expect(after).toBe(before + 1);
    });

    it('登出后 token 应写入 token_blacklist 表', async () => {
      const db = getTestDb();
      const { token } = await loginAndGetTokens();

      // 登出前：黑名单中无此 token
      const before = (db.prepare(
        'SELECT COUNT(*) as count FROM token_blacklist WHERE token = ?'
      ).get(token) as { count: number }).count;
      expect(before).toBe(0);

      // 执行登出
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // 登出后：黑名单中应有此 token
      const after = (db.prepare(
        'SELECT COUNT(*) as count FROM token_blacklist WHERE token = ?'
      ).get(token) as { count: number }).count;
      expect(after).toBe(1);
    });

    it('错误密码应递增 failed_login_attempts', async () => {
      const db = getTestDb();

      // 确保初始值为 0
      db.prepare(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?'
      ).run(TEST_USER.id);

      await request(app)
        .post('/api/auth/login')
        .send({ username: TEST_USER.username, password: 'WrongPass1!' });

      const user = db.prepare(
        'SELECT failed_login_attempts FROM users WHERE id = ?'
      ).get(TEST_USER.id) as { failed_login_attempts: number };

      expect(user.failed_login_attempts).toBe(1);
    });

    it('成功登录应重置 failed_login_attempts 为 0', async () => {
      const db = getTestDb();

      // 先制造一次失败登录
      await request(app)
        .post('/api/auth/login')
        .send({ username: TEST_USER.username, password: 'WrongPass1!' });

      // 然后成功登录
      await request(app)
        .post('/api/auth/login')
        .send({ username: TEST_USER.username, password: TEST_USER.password });

      const user = db.prepare(
        'SELECT failed_login_attempts FROM users WHERE id = ?'
      ).get(TEST_USER.id) as { failed_login_attempts: number };

      expect(user.failed_login_attempts).toBe(0);
    });
  });
});
