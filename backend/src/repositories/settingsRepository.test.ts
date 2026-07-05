/**
 * settingsRepository 测试
 *
 * 验证：
 *   - 各方法执行正确的 SQL 并传递正确的参数
 *   - container.replace() 可注入 mock（DI 可替换性）
 *
 * 使用 vi.hoisted() 构建 mock db，避免 hoisting 错误（项目约定）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock db（必须在 import repository 之前用 vi.hoisted 构建）──
const { mockDb, prepared } = vi.hoisted(() => {
  const prepared = new Map<string, { sql: string; run: (...args: unknown[]) => unknown; get: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[] }>();
  const mockDb = {
    prepare(sql: string) {
      const stmt = {
        sql,
        run: vi.fn((...args: unknown[]) => { prepared.get(sql)?.run(...args); return { changes: 1, lastInsertRowid: 1 }; }),
        get: vi.fn((...args: unknown[]) => { prepared.get(sql)?.get(...args); return undefined; }),
        all: vi.fn((...args: unknown[]) => { prepared.get(sql)?.all(...args); return []; }),
      };
      prepared.set(sql, stmt as never);
      return stmt;
    },
    exec: vi.fn(),
  };
  return { mockDb, prepared };
});

vi.mock('../models/database', () => ({ default: mockDb }));

import { settingsRepository } from './settingsRepository';
import { container } from '../core/serviceContainer';

// Mock logger for serviceContainer
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('settingsRepository', () => {
  beforeEach(() => {
    prepared.clear();
    // 重新设置 mock 返回值
    for (const [, stmt] of prepared) {
      (stmt.run as ReturnType<typeof vi.fn>).mockReturnValue({ changes: 1, lastInsertRowid: 1 });
      (stmt.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
      (stmt.all as ReturnType<typeof vi.fn>).mockReturnValue([]);
    }
  });

  describe('getValue', () => {
    it('执行 SELECT value FROM settings WHERE key = ?', () => {
      // 预设返回值
      mockDb.prepare = vi.fn((sql: string) => {
        const stmt = prepared.get(sql) || {
          sql,
          run: vi.fn(),
          get: vi.fn(() => ({ value: 'hello' })),
          all: vi.fn(),
        };
        prepared.set(sql, stmt as never);
        return stmt;
      });

      const result = settingsRepository.getValue('TEST_KEY');
      expect(result).toBe('hello');
    });

    it('key 不存在时返回 undefined', () => {
      mockDb.prepare = vi.fn((sql: string) => {
        const stmt = {
          sql,
          run: vi.fn(),
          get: vi.fn(() => undefined),
          all: vi.fn(),
        };
        prepared.set(sql, stmt as never);
        return stmt;
      });

      const result = settingsRepository.getValue('NONEXISTENT');
      expect(result).toBeUndefined();
    });
  });

  describe('upsert', () => {
    it('执行带 ON CONFLICT 的 INSERT', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('ON CONFLICT(key) DO UPDATE');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      settingsRepository.upsert('MY_KEY', 'my_value');
      expect(runSpy).toHaveBeenCalledWith('MY_KEY', 'my_value', 'my_value');
    });
  });

  describe('upsertMany', () => {
    it('对每个 entry 调用 upsert', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

      settingsRepository.upsertMany({ A: '1', B: '2', C: '3' });
      expect(runSpy).toHaveBeenCalledTimes(3);
      expect(runSpy).toHaveBeenCalledWith('A', '1', '1');
      expect(runSpy).toHaveBeenCalledWith('B', '2', '2');
      expect(runSpy).toHaveBeenCalledWith('C', '3', '3');
    });
  });

  describe('delete', () => {
    it('执行 DELETE FROM settings WHERE key = ?', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('DELETE FROM settings');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      settingsRepository.delete('OLD_KEY');
      expect(runSpy).toHaveBeenCalledWith('OLD_KEY');
    });
  });

  describe('getByKeyPrefix', () => {
    it('使用 LIKE ? 传递 prefix%', () => {
      const allSpy = vi.fn(() => [{ key: 'DOUBAO_KEY', value: 'xxx' }]);
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: allSpy }));

      const result = settingsRepository.getByKeyPrefix('DOUBAO_');
      expect(allSpy).toHaveBeenCalledWith('DOUBAO_%');
      expect(result).toHaveLength(1);
    });
  });

  describe('getMany', () => {
    it('空数组返回空对象', () => {
      const result = settingsRepository.getMany([]);
      expect(result).toEqual({});
    });

    it('多 key 返回 key-value 映射', () => {
      const allSpy = vi.fn(() => [
        { key: 'A', value: '1' },
        { key: 'C', value: '3' },
      ]);
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: allSpy }));

      const result = settingsRepository.getMany(['A', 'B', 'C']);
      expect(result.A).toBe('1');
      expect(result.B).toBeUndefined();
      expect(result.C).toBe('3');
    });
  });

  describe('getAll', () => {
    it('返回全部设置列表', () => {
      const allSpy = vi.fn(() => [{ key: 'K1', value: 'V1' }]);
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: allSpy }));

      const result = settingsRepository.getAll();
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('K1');
    });
  });

  describe('exists', () => {
    it('存在时返回 true', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(), get: vi.fn(() => ({ '1': 1 })), all: vi.fn() }));
      expect(settingsRepository.exists('KEY')).toBe(true);
    });

    it('不存在时返回 false', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(), get: vi.fn(() => undefined), all: vi.fn() }));
      expect(settingsRepository.exists('MISSING')).toBe(false);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getValue: vi.fn(() => 'mocked') };
      container.replace('settingsRepository', mockRepo);

      const result = container.get<typeof mockRepo>('settingsRepository');
      expect(result).toBe(mockRepo);
      expect(result.getValue('any')).toBe('mocked');
    });
  });
});
