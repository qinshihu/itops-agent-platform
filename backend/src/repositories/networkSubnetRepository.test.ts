/**
 * networkSubnetRepository 测试
 *
 * 验证：
 *   - subnets.list 联表 used_ips 统计
 *   - subnets.create 默认值（network_type=lan, status=active）
 *   - subnets.update COALESCE 部分更新
 *   - ips.list 过滤 + 分页
 *   - ips.bulkInsertAvailable 使用事务
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
    transaction: vi.fn((fn: () => void) => fn),
  };
  return { mockDb };
});

vi.mock('../models/database', () => ({ default: mockDb }));

import { networkSubnetRepository } from './networkSubnetRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('networkSubnetRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('subnets.list', () => {
    it('联表统计 used_ips 并按 created_at DESC 排序', () => {
      const allSpy = vi.fn(() => [{ id: 's1', used_ips: 5 }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('SELECT COUNT(*) FROM network_ips WHERE subnet_id = s.id');
        expect(sql).toContain('ORDER BY s.created_at DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      const result = networkSubnetRepository.subnets.list();
      expect(result[0].used_ips).toBe(5);
    });
  });

  describe('subnets.create', () => {
    it('应用默认值 network_type=lan, status=active, total_ips=0', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO network_subnets');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      networkSubnetRepository.subnets.create({ id: 's1', name: 'lan1', cidr: '192.168.1.0/24' });
      expect(runSpy).toHaveBeenCalledWith(
        's1', 'lan1', '192.168.1.0/24', null, null, 'lan', null, null, 'active', 0
      );
    });
  });

  describe('subnets.update', () => {
    it('COALESCE 部分更新 + updated_at', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('COALESCE(?, name)');
        expect(sql).toContain("updated_at = datetime('now','localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      networkSubnetRepository.subnets.update('s1', { name: 'newname', status: 'inactive' });
      const args = runSpy.mock.calls[0];
      expect(args[0]).toBe('newname');
      expect(args[6]).toBe('inactive');
      expect(args[args.length - 1]).toBe('s1');
    });
  });

  describe('ips.list', () => {
    it('带 status 和 search 过滤生成对应参数', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('AND status = ?');
        expect(sql).toContain('ip_address LIKE ? OR device_name LIKE ? OR mac_address LIKE ?');
        expect(sql).toContain('ORDER BY ip_address ASC LIMIT ? OFFSET ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      networkSubnetRepository.ips.list({
        subnetId: 's1', status: 'used', search: '192', limit: 50, offset: 10,
      });
      const args = allSpy.mock.calls[0];
      expect(args[0]).toBe('s1');
      expect(args[1]).toBe('used');
      expect(args[2]).toBe('%192%');
      expect(args[3]).toBe('%192%');
      expect(args[4]).toBe('%192%');
      expect(args[5]).toBe(50);
      expect(args[6]).toBe(10);
    });

    it('status=all 时不附加 status 过滤', () => {
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).not.toContain('AND status = ?');
        return { run: vi.fn(), get: vi.fn(), all: vi.fn(() => []) };
      });
      networkSubnetRepository.ips.list({ subnetId: 's1', status: 'all' });
    });
  });

  describe('ips.bulkInsertAvailable', () => {
    it('使用事务 + 预编译语句批量插入', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

      networkSubnetRepository.ips.bulkInsertAvailable('s1', ['10.0.0.1', '10.0.0.2']);
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(runSpy).toHaveBeenCalledTimes(2);
      expect(runSpy).toHaveBeenCalledWith(expect.any(String), 's1', '10.0.0.1');
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { subnets: { list: vi.fn(() => []) }, ips: { list: vi.fn(() => []) } };
      container.replace('networkSubnetRepository', mockRepo);
      const result = container.get<typeof mockRepo>('networkSubnetRepository');
      expect(result).toBe(mockRepo);
    });
  });
});
