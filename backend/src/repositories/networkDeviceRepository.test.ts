/**
 * networkDeviceRepository 测试
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

import { networkDeviceRepository } from './networkDeviceRepository';
import { container } from '../core/serviceContainer';

// Mock logger for serviceContainer
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

describe('networkDeviceRepository', () => {
  beforeEach(() => {
    prepared.clear();
  });

  describe('list', () => {
    it('执行联表查询并返回数组', () => {
      const allSpy = vi.fn(() => [{ id: '1', name: 'dev1', snmp_credential_name: 'cred1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('LEFT JOIN snmp_credentials');
        expect(sql).toContain('ORDER BY nd.created_at DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = networkDeviceRepository.list();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('dev1');
    });
  });

  describe('listSnmpEnabledBasic', () => {
    it('查询 snmp_enabled = 1 的设备', () => {
      const allSpy = vi.fn(() => [{ id: '1', name: 'd', ip_address: '1.1.1.1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('WHERE snmp_enabled = 1');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = networkDeviceRepository.listSnmpEnabledBasic();
      expect(result).toHaveLength(1);
    });
  });

  describe('listIdsByStatus', () => {
    it('空数组返回空数组（不查询）', () => {
      const result = networkDeviceRepository.listIdsByStatus([]);
      expect(result).toEqual([]);
    });

    it('多状态生成 IN (?,?)', () => {
      const allSpy = vi.fn(() => [{ id: '1' }, { id: '2' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('status IN (?,?)');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = networkDeviceRepository.listIdsByStatus(['online', 'unknown']);
      expect(allSpy).toHaveBeenCalledWith('online', 'unknown');
      expect(result).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('执行 SELECT * FROM network_devices WHERE id = ?', () => {
      mockPrepareOnce({ id: '1', name: 'dev' });
      const result = networkDeviceRepository.getById('1');
      expect(result?.name).toBe('dev');
    });
  });

  describe('getByIp', () => {
    it('执行按 ip 查询 id/name', () => {
      mockPrepareOnce({ id: '1', name: 'dev' });
      const result = networkDeviceRepository.getByIp('1.1.1.1');
      expect(result?.id).toBe('1');
    });
  });

  describe('getByIpWithSshCreds', () => {
    it('WHERE 包含 username IS NOT NULL AND username != ""', () => {
      mockPrepareOnce({ id: '1', name: 'd', ip_address: '1.1.1.1', username: 'u', password: 'p' });
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain("username IS NOT NULL AND username != ''");
        expect(sql).toContain('LIMIT 1');
        return { run: vi.fn(), get: vi.fn(() => ({ id: '1', name: 'd', ip_address: '1.1.1.1', username: 'u', password: 'p' })), all: vi.fn() };
      });

      const result = networkDeviceRepository.getByIpWithSshCreds('1.1.1.1');
      expect(result?.username).toBe('u');
    });
  });

  describe('getSshCredentials', () => {
    it('只查询 3 个字段', () => {
      mockPrepareOnce({ username: 'u', password: 'p', ssh_port: 22 });
      const result = networkDeviceRepository.getSshCredentials('1');
      expect(result?.username).toBe('u');
      expect(result?.ssh_port).toBe(22);
    });
  });

  describe('countAll', () => {
    it('返回数字计数', () => {
      mockPrepareOnce({ c: 42 });
      const result = networkDeviceRepository.countAll();
      expect(result).toBe(42);
    });
  });

  describe('create', () => {
    it('执行 17 字段 INSERT 并传递参数', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO network_devices');
        expect(sql).toMatch(/VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/);
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      networkDeviceRepository.create({
        id: 'd1', name: 'dev1', ip_address: '1.1.1.1', vendor: 'cisco',
      });

      expect(runSpy).toHaveBeenCalledWith(
        'd1', 'dev1', '1.1.1.1', 'cisco',
        null, null, 22, null, null, null, null, null, null, 'online', 1, null, 161
      );
    });

    it('自定义字段值正确传递', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

      networkDeviceRepository.create({
        id: 'd2', name: 'dev2', ip_address: '2.2.2.2', vendor: 'huawei',
        ssh_port: 2222, username: 'admin', password: 'secret',
        snmp_enabled: 0, snmp_port: 162,
      });

      expect(runSpy).toHaveBeenCalledWith(
        'd2', 'dev2', '2.2.2.2', 'huawei',
        null, null, 2222, null, 'admin', 'secret', null, null, null, 'online', 0, null, 162
      );
    });
  });

  describe('update (动态 SET)', () => {
    it('空 fields 返回 0 不执行 SQL', () => {
      const prepareSpy = vi.fn();
      mockDb.prepare = prepareSpy;
      const result = networkDeviceRepository.update('1', {});
      expect(result).toBe(0);
      expect(prepareSpy).not.toHaveBeenCalled();
    });

    it('构建动态 SET 子句并附加 updated_at', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('name = ?');
        expect(sql).toContain("updated_at = datetime('now','localtime')");
        expect(sql).toContain('WHERE id = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const result = networkDeviceRepository.update('1', { name: 'new-name' });
      expect(runSpy).toHaveBeenCalledWith('new-name', '1');
      expect(result).toBe(1);
    });

    it('多字段更新参数顺序正确', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

      networkDeviceRepository.update('1', { name: 'n', model: 'm', ssh_port: 23 });
      expect(runSpy).toHaveBeenCalledWith('n', 'm', 23, '1');
    });
  });

  describe('updateInspectionResult', () => {
    it('更新 last_inspection_at + last_inspection_result', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain("last_inspection_at = datetime('now','localtime')");
        expect(sql).toContain('last_inspection_result = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      networkDeviceRepository.updateInspectionResult('1', 'OK');
      expect(runSpy).toHaveBeenCalledWith('OK', '1');
    });
  });

  describe('delete', () => {
    it('删除成功返回 true', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
      expect(networkDeviceRepository.delete('1')).toBe(true);
    });

    it('删除不存在记录返回 false', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 0 })), get: vi.fn(), all: vi.fn() }));
      expect(networkDeviceRepository.delete('missing')).toBe(false);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getById: vi.fn(() => ({ id: 'mocked' })) };
      container.replace('networkDeviceRepository', mockRepo);

      const result = container.get<typeof mockRepo>('networkDeviceRepository');
      expect(result).toBe(mockRepo);
      expect(result.getById('any').id).toBe('mocked');
    });
  });
});
