/**
 * auditLogRepository 测试
 *
 * 验证：
 *   - insert 7 字段 + null 默认值
 *   - list/count 多条件过滤与分页
 *   - 统计方法 getActionStats / getResourceStats / getTodayCount
 *   - container.replace() 可注入 mock
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      get: vi.fn(() => undefined),
      all: vi.fn(() => []),
    })),
    exec: vi.fn(),
  };
  return { mockDb };
});

vi.mock('../models/database', () => ({ default: mockDb }));

import { auditLogRepository } from './auditLogRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('auditLogRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insert', () => {
    it('7 字段 + null 默认值正确传递', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO audit_logs');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      auditLogRepository.insert({
        id: 'l1', action: 'login', resource_type: 'user',
      });
      expect(runSpy).toHaveBeenCalledWith('l1', null, 'login', 'user', null, null, null);
    });
  });

  describe('list', () => {
    it('多过滤条件生成对应 WHERE 子句与参数', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('action = ?');
        expect(sql).toContain('resource_type = ?');
        expect(sql).toContain('created_at >= ?');
        expect(sql).toContain('ORDER BY created_at DESC LIMIT ? OFFSET ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      auditLogRepository.list({
        action: 'login', resource_type: 'user', start_date: '2026-01-01',
        limit: 10, offset: 5,
      });
      expect(allSpy).toHaveBeenCalledWith('login', 'user', '2026-01-01', 10, 5);
    });

    it('无过滤时使用默认 limit/offset', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: allSpy }));
      auditLogRepository.list();
      const args = allSpy.mock.calls[0];
      expect(args[args.length - 2]).toBe(50);
      expect(args[args.length - 1]).toBe(0);
    });
  });

  describe('count', () => {
    it('返回 total 字段值', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(), get: vi.fn(() => ({ total: 99 })), all: vi.fn(),
      }));
      expect(auditLogRepository.count({ action: 'login' })).toBe(99);
    });
  });

  describe('getActionStats', () => {
    it('查询 7 天内的 action 统计', () => {
      const allSpy = vi.fn(() => [{ action: 'login', count: 5 }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain("datetime('now', '-7 days')");
        expect(sql).toContain('GROUP BY action');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      const result = auditLogRepository.getActionStats();
      expect(result[0].count).toBe(5);
    });
  });

  describe('getTodayCount', () => {
    it('使用 start of day 过滤', () => {
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain("datetime('now', 'start of day')");
        return { run: vi.fn(), get: vi.fn(() => ({ count: 3 })), all: vi.fn() };
      });
      expect(auditLogRepository.getTodayCount()).toBe(3);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { list: vi.fn(() => []) };
      container.replace('auditLogRepository', mockRepo);
      const result = container.get<typeof mockRepo>('auditLogRepository');
      expect(result).toBe(mockRepo);
    });
  });
});
