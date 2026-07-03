/**
 * userRepository 测试
 *
 * 验证：
 *   - 各方法执行正确的 SQL 并传递正确的参数
 *   - container.replace() 可注入 mock（DI 可替换性）
 *
 * 使用 vi.hoisted() 构建 mock db，避免 hoisting 错误（项目约定）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { userRepository } from './userRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

function mockPrepareOnce(getReturn?: unknown, allReturn?: unknown) {
  mockDb.prepare = vi.fn((sql: string) => {
    const stmt = {
      sql,
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      get: vi.fn(() => getReturn),
      all: vi.fn(() => allReturn ?? []),
    };
    prepared.set(sql, stmt as never);
    return stmt;
  });
}

describe('userRepository', () => {
  beforeEach(() => {
    prepared.clear();
  });

  describe('list', () => {
    it('查询不含 password 的字段，按 created_at DESC 排序', () => {
      const allSpy = vi.fn(() => [{ id: '1', username: 'admin' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).not.toContain('password');
        expect(sql).toContain('ORDER BY created_at DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = userRepository.list();
      expect(result).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('执行 SELECT * 含 password', () => {
      mockPrepareOnce({ id: '1', username: 'admin', password: 'hash' });
      const result = userRepository.getById('1');
      expect(result?.password).toBe('hash');
    });
  });

  describe('getByUsername', () => {
    it('按用户名查询完整记录', () => {
      mockPrepareOnce({ id: '1', username: 'admin' });
      const result = userRepository.getByUsername('admin');
      expect(result?.username).toBe('admin');
    });
  });

  describe('existsByUsername', () => {
    it('存在返回 true', () => {
      mockPrepareOnce({ id: '1' });
      expect(userRepository.existsByUsername('admin')).toBe(true);
    });

    it('不存在返回 false', () => {
      mockPrepareOnce(undefined);
      expect(userRepository.existsByUsername('nobody')).toBe(false);
    });
  });

  describe('getLockoutStatus', () => {
    it('返回 id + failed_login_attempts + locked_until', () => {
      mockPrepareOnce({ id: '1', failed_login_attempts: 3, locked_until: '2026-07-01' });
      const result = userRepository.getLockoutStatus('admin');
      expect(result?.failed_login_attempts).toBe(3);
    });
  });

  describe('countAll', () => {
    it('返回用户总数', () => {
      mockPrepareOnce({ count: 5 });
      expect(userRepository.countAll()).toBe(5);
    });
  });

  describe('create', () => {
    it('执行 8 字段 INSERT 并生成时间戳', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO users');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      userRepository.create({
        id: 'u1', username: 'user1', hashedPassword: 'hashed', role: 'user', enabled: 1,
      });
      const args = runSpy.mock.calls[0];
      expect(args[0]).toBe('u1');
      expect(args[1]).toBe('user1');
      expect(args[2]).toBe('hashed');
      expect(args[3]).toBeNull();
      expect(args[4]).toBe('user');
      expect(args[5]).toBe(1);
      expect(typeof args[6]).toBe('string'); // created_at
      expect(typeof args[7]).toBe('string'); // updated_at
    });
  });

  describe('update (动态 SET)', () => {
    it('空 fields 返回 0', () => {
      mockDb.prepare = vi.fn();
      expect(userRepository.update('1', {})).toBe(0);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('构建动态 SET 并附加 updated_at', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('role = ?');
        expect(sql).toContain('enabled = ?');
        expect(sql).toContain('updated_at = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const result = userRepository.update('1', { role: 'admin', enabled: 0 });
      const args = runSpy.mock.calls[0];
      expect(args[0]).toBe('admin');
      expect(args[1]).toBe(0);
      expect(typeof args[2]).toBe('string'); // updated_at
      expect(args[3]).toBe('1');
      expect(result).toBe(1);
    });
  });

  describe('updatePassword', () => {
    it('更新 password + password_must_change=0', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('password = ?');
        expect(sql).toContain('password_must_change = 0');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const result = userRepository.updatePassword('u1', 'newhash');
      expect(runSpy).toHaveBeenCalledWith('newhash', 'u1');
      expect(result).toBe(1);
    });
  });

  describe('unlock', () => {
    it('重置 failed_login_attempts + locked_until', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('failed_login_attempts = 0');
        expect(sql).toContain('locked_until = NULL');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      userRepository.unlock('u1');
      expect(runSpy).toHaveBeenCalledWith('u1');
    });
  });

  describe('recordFailedLoginWithLock', () => {
    it('记录失败登录 + 锁定时间', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('locked_until = ?');
        expect(sql).toContain('last_failed_login = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      userRepository.recordFailedLoginWithLock('u1', 5, '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');
      expect(runSpy).toHaveBeenCalledWith(5, '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z', 'u1');
    });
  });

  describe('delete', () => {
    it('删除成功返回 true', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
      expect(userRepository.delete('1')).toBe(true);
    });

    it('删除不存在记录返回 false', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 0 })), get: vi.fn(), all: vi.fn() }));
      expect(userRepository.delete('missing')).toBe(false);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getById: vi.fn(() => ({ id: 'mocked' })) };
      container.replace('userRepository', mockRepo);

      const result = container.get<typeof mockRepo>('userRepository');
      expect(result).toBe(mockRepo);
      expect(result.getById('any').id).toBe('mocked');
    });
  });
});
