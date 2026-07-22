/**
 * dcRepository 测试（目录化子 repository 聚合）
 *
 * 验证：
 *   - rooms.list 按 sort_order 排序
 *   - rooms.create 7 字段 + 默认值
 *   - rooms.delete 级联删除 rack + slot
 *   - rooms.deleteAll 清空多表
 *   - 聚合对象包含 7 个子 repository
 *   - container.replace() 可注入 mock
 *
 * 注意：vi.mock('../models/database') 在 vitest 中按解析后的绝对路径缓存，
 * 因此 dcRepository/ 子目录下各文件的 `import db from '../../models/database'`
 * 也会命中同一 mock。
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
    // 模拟 better-sqlite3 transaction(fn) → 返回同步函数，立即执行 fn 并返回结果
    transaction: vi.fn((fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => fn(...args)),
  };
  return { mockDb };
});

vi.mock('../models/database', () => ({ default: mockDb, performMaintenance: vi.fn() }));

import { dcRepository } from './dcRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('dcRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('聚合结构', () => {
    it('包含 7 个子 repository', () => {
      expect(dcRepository.rooms).toBeDefined();
      expect(dcRepository.racks).toBeDefined();
      expect(dcRepository.slots).toBeDefined();
      expect(dcRepository.devices).toBeDefined();
      expect(dcRepository.pdus).toBeDefined();
      expect(dcRepository.cables).toBeDefined();
      expect(dcRepository.power).toBeDefined();
    });
  });

  describe('rooms.list', () => {
    it('按 sort_order 排序', () => {
      const allSpy = vi.fn(() => [{ id: 'r1', name: 'room1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('SELECT * FROM dc_rooms');
        expect(sql).toContain('ORDER BY sort_order');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      const result = dcRepository.rooms.list();
      expect(result).toHaveLength(1);
    });
  });

  describe('rooms.create', () => {
    it('7 字段 + 默认值 width_m=20, depth_m=15, sort_order=0', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO dc_rooms');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      dcRepository.rooms.create({ id: 'r1', name: 'room1' });
      expect(runSpy).toHaveBeenCalledWith('r1', 'room1', '', '', 20, 15, 0);
    });
  });

  describe('rooms.delete', () => {
    it('级联删除 slot → rack → room（3 条 SQL）', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      dcRepository.rooms.delete('r1');
      // 2026-07-21 修正：实际只有 3 条 SQL，slot 通过 FK CASCADE 自动级联（参考 roomsRepo.ts:88-111 注释）
      expect(mockDb.prepare).toHaveBeenCalledTimes(3);
      const sqls = (mockDb.prepare as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
      expect(sqls[0]).toContain('UPDATE dc_pdus SET rack_id = NULL');
      expect(sqls[1]).toContain('DELETE FROM dc_racks');
      expect(sqls[2]).toContain('DELETE FROM dc_rooms');
      expect(runSpy).toHaveBeenLastCalledWith('r1');
    });
  });

  describe('rooms.deleteAll', () => {
    it('清空 5 张表', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(), get: vi.fn(), all: vi.fn(),
      }));

      dcRepository.rooms.deleteAll();
      expect(mockDb.prepare).toHaveBeenCalledTimes(5);
      const sqls = (mockDb.prepare as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
      expect(sqls.some(s => s.includes('dc_device_lifecycle'))).toBe(true);
      expect(sqls.some(s => s.includes('dc_rack_slots'))).toBe(true);
      expect(sqls.some(s => s.includes('dc_pdus'))).toBe(true);
      expect(sqls.some(s => s.includes('dc_racks'))).toBe(true);
      expect(sqls.some(s => s.includes('dc_rooms'))).toBe(true);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { rooms: { list: vi.fn(() => []) }, racks: { list: vi.fn(() => []) } };
      container.replace('dcRepository', mockRepo);
      const result = container.get<typeof mockRepo>('dcRepository');
      expect(result).toBe(mockRepo);
    });
  });
});
