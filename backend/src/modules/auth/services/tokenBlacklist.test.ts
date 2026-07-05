import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock("../../../models/database", () => {
  // 保留原有的导出结构，将 default 增强为可用的功能性 mock，
  // 使 db.prepare(...).run()/get() 不会抛错，从而测试真实业务逻辑
  const prepare = () => ({
    run: () => ({ changes: 0 }),
    get: () => undefined,
  });
  return {
    default: { prepare },
    db: {},
    initializeDatabase: vi.fn(),
    performMaintenance: vi.fn(),
    getIOInstance: vi.fn(),
  };
});

vi.mock("../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '../../../utils/logger';
import { tokenBlacklist, initTokenBlacklist } from './tokenBlacklist';

describe('tokenBlacklist', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should be defined", () => { expect(tokenBlacklist).toBeDefined(); });

  it('isBlacklisted 对未拉黑的 token 应返回 false', () => {
    const token = jwt.sign({ sub: 'unknown-user' }, 'test-secret');
    expect(tokenBlacklist.isBlacklisted(token)).toBe(false);
  });

  it('addToBlacklist 添加 token 后 isBlacklisted 应返回 true', () => {
    const token = jwt.sign({ sub: 'test-user' }, 'test-secret');
    tokenBlacklist.addToBlacklist(token, 'logout', 'test-user');
    expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
  });

  it('cleanExpiredTokens 应清理过期的缓存 token 并保留有效 token', () => {
    // 添加一个未过期的 token，验证清理不会误删
    const validToken = jwt.sign({ sub: 'valid-user' }, 'test-secret');
    tokenBlacklist.addToBlacklist(validToken, 'logout', 'valid-user');

    // 添加一个已过期的 token（exp 为 1 小时前）
    const expiredToken = jwt.sign(
      { sub: 'expired-user', exp: Math.floor(Date.now() / 1000) - 3600 },
      'test-secret'
    );
    tokenBlacklist.addToBlacklist(expiredToken, 'logout', 'expired-user');

    // 执行清理
    tokenBlacklist.cleanExpiredTokens();

    // 验证：过期 token 已从缓存清理
    // （cleanupExpiredCache 仅在 cleanedCount > 0 时记录 "Cleaned N expired tokens from cache"）
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/Cleaned \d+ expired tokens from cache/)
    );
    // 验证：未过期 token 仍然被正确识别为已拉黑
    expect(tokenBlacklist.isBlacklisted(validToken)).toBe(true);
  });

});
