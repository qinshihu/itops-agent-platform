/**
 * virtualMachineRepository 测试
 *
 * 验证：
 *   - countAll / countByStatus / count（带过滤）
 *   - list（过滤+分页+排序）
 *   - insert 14 字段 + 默认值
 *   - update 动态 SET + 空字段返回 0
 *   - upsertFromHypervisor（ON CONFLICT）
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

import { virtualMachineRepository } from './virtualMachineRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('virtualMachineRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('countAll', () => {
    it('返回 count 字段', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(), get: vi.fn(() => ({ count: 12 })), all: vi.fn(),
      }));
      expect(virtualMachineRepository.countAll()).toBe(12);
    });
  });

  describe('countByStatus', () => {
    it('GROUP BY status', () => {
      const allSpy = vi.fn(() => [{ status: 'running', count: 3 }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('GROUP BY status');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      const result = virtualMachineRepository.countByStatus();
      expect(result[0].count).toBe(3);
    });
  });

  describe('count', () => {
    it('带 search 过滤生成 3 个 LIKE 参数', () => {
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('name LIKE ? OR host LIKE ? OR ip_address LIKE ?');
        return { run: vi.fn(), get: vi.fn(() => ({ count: 2 })), all: vi.fn() };
      });
      expect(virtualMachineRepository.count({ search: 'web' })).toBe(2);
    });
  });

  describe('list', () => {
    it('过滤+分页+按 updated_at DESC 排序', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('status = ?');
        expect(sql).toContain('ORDER BY updated_at DESC');
        expect(sql).toContain('LIMIT ? OFFSET ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      virtualMachineRepository.list({ status: 'running', limit: 15, offset: 30 });
      expect(allSpy).toHaveBeenCalledWith('running', 15, 30);
    });
  });

  describe('insert', () => {
    it('14 字段 + 默认值 status=stopped, tags=[]', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO virtual_machines');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      virtualMachineRepository.insert({ id: 'vm1', name: 'web' });
      const args = runSpy.mock.calls[0];
      expect(args[0]).toBe('vm1');
      expect(args[1]).toBe('web');
      expect(args[3]).toBe('stopped');
      expect(args[12]).toBe('[]');
    });
  });

  describe('update', () => {
    it('空字段返回 0', () => {
      mockDb.prepare = vi.fn();
      expect(virtualMachineRepository.update('vm1', {})).toBe(0);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('动态 SET 含 updated_at', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('status = ?');
        expect(sql).toContain("updated_at = datetime('now','localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const changes = virtualMachineRepository.update('vm1', { status: 'running' });
      expect(runSpy).toHaveBeenCalledWith('running', 'vm1');
      expect(changes).toBe(1);
    });
  });

  describe('upsertFromHypervisor', () => {
    it('使用 ON CONFLICT(id) DO UPDATE', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      virtualMachineRepository.upsertFromHypervisor({ id: 'vm1', name: 'web' });
      expect(runSpy).toHaveBeenCalled();
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { list: vi.fn(() => []), getById: vi.fn(() => undefined) };
      container.replace('virtualMachineRepository', mockRepo);
      const result = container.get<typeof mockRepo>('virtualMachineRepository');
      expect(result).toBe(mockRepo);
    });
  });
});
