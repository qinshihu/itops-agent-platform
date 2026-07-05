/**
 * pdusRepo 子 repository 测试
 *
 * 验证：
 *   - list 基本 SELECT
 *   - listWithRack 联表 dc_racks 获取 rack_name
 *   - create 13 字段 + 默认值（type=pdu, status=active, input_voltage=220）
 *   - update 全字段更新
 *   - delete
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

import { pdusRepo } from './pdusRepo';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('pdusRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('执行 SELECT * FROM dc_pdus', () => {
      const allSpy = vi.fn(() => [{ id: 'p1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('SELECT * FROM dc_pdus');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      const result = pdusRepo.list();
      expect(result).toHaveLength(1);
    });
  });

  describe('listWithRack', () => {
    it('联表 dc_racks 获取 rack_name 并按 name 排序', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('LEFT JOIN dc_racks r');
        expect(sql).toContain('r.name as rack_name');
        expect(sql).toContain('ORDER BY p.name');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      pdusRepo.listWithRack();
    });
  });

  describe('create', () => {
    it('13 字段 + 默认值 type=pdu, status=active, input_voltage=220', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO dc_pdus');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      pdusRepo.create({ id: 'p1', name: 'pdu1' });
      expect(runSpy).toHaveBeenCalledWith(
        'p1', 'pdu1', 'pdu', 'active', null,
        0, 0, 220, 0, '', '', '', ''
      );
    });

    it('自定义字段值正确传递', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

      pdusRepo.create({
        id: 'p2', name: 'pdu2', type: 'ats', status: 'warning',
        power_capacity_w: 5000, input_voltage: 110, ip_address: '10.0.0.1',
      });
      const args = runSpy.mock.calls[0];
      expect(args[2]).toBe('ats');
      expect(args[3]).toBe('warning');
      expect(args[5]).toBe(5000);
      expect(args[7]).toBe(110);
      expect(args[10]).toBe('10.0.0.1');
    });
  });

  describe('update', () => {
    it('全字段更新 + updated_at', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('UPDATE dc_pdus SET');
        expect(sql).toContain("updated_at=datetime('now','localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      pdusRepo.update('p1', {
        id: 'p1', name: 'updated', type: 'pdu', status: 'active',
      });
      const args = runSpy.mock.calls[0];
      expect(args[0]).toBe('updated');
      expect(args[args.length - 1]).toBe('p1');
    });
  });

  describe('delete', () => {
    it('执行 DELETE FROM dc_pdus WHERE id = ?', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('DELETE FROM dc_pdus');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });
      pdusRepo.delete('p1');
      expect(runSpy).toHaveBeenCalledWith('p1');
    });
  });
});
