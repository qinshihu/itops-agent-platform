/**
 * snmpRepository 测试
 *
 * 验证：
 *   - credentials.list 联表 host + 可选 deviceId 过滤
 *   - credentials.create 12 字段 + 默认值
 *   - credentials.update COALESCE 部分更新
 *   - trapEvents.insert 9 字段 + 默认值
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

import { snmpRepository } from './snmpRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('snmpRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('credentials.list', () => {
    it('联表 network_devices 获取 host，无 deviceId 时按 device_id 排序', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('LEFT JOIN network_devices nd');
        expect(sql).toContain('COALESCE(c.host, nd.ip_address) AS host');
        expect(sql).toContain('ORDER BY c.device_id');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      snmpRepository.credentials.list();
      expect(allSpy).toHaveBeenCalledWith();
    });

    it('带 deviceId 时按 snmp_version DESC 排序', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('WHERE c.device_id = ?');
        expect(sql).toContain('ORDER BY c.snmp_version DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });
      snmpRepository.credentials.list('d1');
      expect(allSpy).toHaveBeenCalledWith('d1');
    });
  });

  describe('credentials.create', () => {
    it('12 字段 + 默认值 name=default, version=v2c, port=161', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO snmp_credentials');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      snmpRepository.credentials.create({ id: 'c1' });
      expect(runSpy).toHaveBeenCalledWith(
        'c1', null, 'default', null, 'v2c', 161, null, null, null, null, null, null
      );
    });
  });

  describe('credentials.update', () => {
    it('COALESCE 部分更新 10 个字段 + updated_at', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('name = COALESCE(?, name)');
        expect(sql).toContain('host = COALESCE(?, host)');
        expect(sql).toContain("updated_at = datetime('now','localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      snmpRepository.credentials.update('c1', { name: 'newname', snmp_port: 162 });
      const args = runSpy.mock.calls[0];
      expect(args[0]).toBe('newname');
      expect(args[3]).toBe(162);
      expect(args[args.length - 1]).toBe('c1');
    });
  });

  describe('credentials.delete', () => {
    it('执行 DELETE FROM snmp_credentials WHERE id = ?', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('DELETE FROM snmp_credentials');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });
      snmpRepository.credentials.delete('c1');
      expect(runSpy).toHaveBeenCalledWith('c1');
    });
  });

  describe('trapEvents.insert', () => {
    it('9 字段 + 默认值 generic_type=0, specific_type=0', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO snmp_trap_events');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      snmpRepository.trapEvents.insert({ id: 't1', source_ip: '10.0.0.1' });
      expect(runSpy).toHaveBeenCalledWith(
        't1', '10.0.0.1', null, null, null, 0, 0, null, undefined
      );
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { credentials: { list: vi.fn(() => []) }, trapEvents: { insert: vi.fn() } };
      container.replace('snmpRepository', mockRepo);
      const result = container.get<typeof mockRepo>('snmpRepository');
      expect(result).toBe(mockRepo);
    });
  });
});
