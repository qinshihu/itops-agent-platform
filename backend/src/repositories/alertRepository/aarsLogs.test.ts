/**
 * aarsLogs 子 repository 测试
 *
 * 验证：
 *   - getByAlertId ORDER BY created_at DESC LIMIT 1
 *   - list 默认 limit=50
 *   - save INSERT OR REPLACE + 默认 approval_status='not_needed'
 *   - updateCompleted 设置 completed_at + updated_at
 *   - getStats 执行 5 条 COUNT 查询
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

vi.mock('../../models/database', () => ({ default: mockDb }));

import { aarsLogsRepo } from './aarsLogs';

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('aarsLogsRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByAlertId', () => {
    it('ORDER BY created_at DESC LIMIT 1', () => {
      const getSpy = vi.fn(() => ({ id: 'l1', alert_id: 'a1' }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('WHERE alert_id = ?');
        expect(sql).toContain('ORDER BY created_at DESC LIMIT 1');
        return { run: vi.fn(), get: getSpy, all: vi.fn() };
      });
      const result = aarsLogsRepo.getByAlertId('a1');
      expect(result?.alert_id).toBe('a1');
      expect(getSpy).toHaveBeenCalledWith('a1');
    });
  });

  describe('list', () => {
    it('默认 limit=50', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('ORDER BY started_at DESC LIMIT ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      aarsLogsRepo.list();
      expect(allSpy).toHaveBeenCalledWith(50);
    });

    it('自定义 limit', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: allSpy }));
      aarsLogsRepo.list(10);
      expect(allSpy).toHaveBeenCalledWith(10);
    });
  });

  describe('save', () => {
    it('INSERT OR REPLACE + 默认 approval_status=not_needed', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT OR REPLACE INTO aars_response_logs');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      aarsLogsRepo.save({ id: 'l1', alert_id: 'a1', status: 'resolved' } as never);
      const args = runSpy.mock.calls[0];
      expect(args[0]).toBe('l1');
      expect(args[1]).toBe('a1');
      expect(args[5]).toBe('resolved');
      expect(args[11]).toBe('not_needed');
    });
  });

  describe('updateCompleted', () => {
    it('设置 completed_at + updated_at', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('completed_at = datetime');
        expect(sql).toContain('updated_at = datetime');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });
      aarsLogsRepo.updateCompleted('l1');
      expect(runSpy).toHaveBeenCalledWith('l1');
    });
  });

  describe('getStats', () => {
    it('执行 5 条 COUNT 查询并返回汇总', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(),
        get: vi.fn(() => ({ c: 10 })),
        all: vi.fn(),
      }));
      const stats = aarsLogsRepo.getStats();
      expect(mockDb.prepare).toHaveBeenCalledTimes(5);
      expect(stats.total).toBe(10);
      expect(stats.success).toBe(10);
    });
  });
});
