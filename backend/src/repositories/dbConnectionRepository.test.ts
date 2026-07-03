/**
 * dbConnectionRepository 测试
 *
 * 验证：
 *   - listAll / getById 查询
 *   - insert 默认值（db_type=mysql, port=3306, enabled=1）
 *   - update 动态 SET + 空字段返回 0
 *   - deleteById 返回 changes
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

import { dbConnectionRepository } from './dbConnectionRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('dbConnectionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAll', () => {
    it('按 created_at DESC 排序', () => {
      const allSpy = vi.fn(() => [{ id: 'd1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('ORDER BY created_at DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      const result = dbConnectionRepository.listAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('执行 SELECT * FROM databases WHERE id = ?', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(), get: vi.fn(() => ({ id: 'd1', name: 'mysql1' })), all: vi.fn(),
      }));
      const result = dbConnectionRepository.getById('d1');
      expect(result?.name).toBe('mysql1');
    });
  });

  describe('insert', () => {
    it('应用默认值 db_type=mysql, port=3306, enabled=1', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO databases');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      dbConnectionRepository.insert({
        id: 'd1', name: 'conn1', host: '127.0.0.1',
        username: 'root', password: 'pw', database: 'test',
      });
      expect(runSpy).toHaveBeenCalledWith(
        'd1', 'conn1', 'mysql', '127.0.0.1', 3306, 'root', 'pw', 'test', null, null, 1
      );
    });
  });

  describe('update', () => {
    it('空字段返回 0 且不调用 prepare', () => {
      mockDb.prepare = vi.fn();
      expect(dbConnectionRepository.update('d1', {})).toBe(0);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('动态 SET 包含 updated_at', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('host = ?');
        expect(sql).toContain("updated_at = datetime('now','localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const changes = dbConnectionRepository.update('d1', { host: '1.2.3.4' });
      expect(runSpy).toHaveBeenCalledWith('1.2.3.4', 'd1');
      expect(changes).toBe(1);
    });
  });

  describe('deleteById', () => {
    it('返回 changes', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn(),
      }));
      expect(dbConnectionRepository.deleteById('d1')).toBe(1);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { listAll: vi.fn(() => []) };
      container.replace('dbConnectionRepository', mockRepo);
      const result = container.get<typeof mockRepo>('dbConnectionRepository');
      expect(result).toBe(mockRepo);
    });
  });
});
