/**
 * serverRepository 测试
 *
 * 验证 servers / groups / sshKeys 三个子 repository 的方法正确性，
 * 以及 container.replace() 的 DI 可替换性。
 *
 * 使用 vi.hoisted() 构建 mock db，避免 hoisting 错误（项目约定）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock db（vi.hoisted 避免提升错误）──
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

import { serverRepository, serversRepo, groupsRepo, sshKeysRepo } from './serverRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

// ── 辅助：构造可配置的 prepare mock ──
function setupPrepare(overrides: { get?: (...a: unknown[]) => unknown; all?: (...a: unknown[]) => unknown[]; run?: (...a: unknown[]) => unknown } = {}) {
  const stmt = {
    run: overrides.run ? vi.fn(overrides.run) : vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
    get: overrides.get ? vi.fn(overrides.get) : vi.fn(() => undefined),
    all: overrides.all ? vi.fn(overrides.all) : vi.fn(() => []),
  };
  mockDb.prepare = vi.fn(() => stmt) as never;
  return stmt;
}

describe('serverRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── serversRepo ──

  describe('serversRepo.list', () => {
    it('返回服务器列表', () => {
      const fakeServers = [{ id: '1', name: 'srv1' }];
      const stmt = setupPrepare({ all: () => fakeServers });

      const result = serversRepo.list();
      expect(result).toBe(fakeServers);
      expect(stmt.all).toHaveBeenCalled();
    });
  });

  describe('serversRepo.getById', () => {
    it('按 ID 查询服务器', () => {
      const fakeServer = { id: 'abc', name: 'srv' };
      const stmt = setupPrepare({ get: () => fakeServer });

      const result = serversRepo.getById('abc');
      expect(result).toBe(fakeServer);
      expect(stmt.get).toHaveBeenCalledWith('abc');
    });

    it('不存在时返回 undefined', () => {
      setupPrepare({ get: () => undefined });
      expect(serversRepo.getById('missing')).toBeUndefined();
    });
  });

  describe('serversRepo.getByIp', () => {
    it('匹配 hostname / ip_address / private_ip 三字段', () => {
      const stmt = setupPrepare({ get: () => ({ id: '1' }) });
      serversRepo.getByIp('10.0.0.1');
      // 同一参数传三次
      expect(stmt.get).toHaveBeenCalledWith('10.0.0.1', '10.0.0.1', '10.0.0.1');
    });
  });

  describe('serversRepo.countAll', () => {
    it('返回总数', () => {
      setupPrepare({ get: () => ({ c: 42 }) });
      expect(serversRepo.countAll()).toBe(42);
    });
  });

  describe('serversRepo.countEnabled', () => {
    it('返回启用数', () => {
      setupPrepare({ get: () => ({ c: 5 }) });
      expect(serversRepo.countEnabled()).toBe(5);
    });
  });

  describe('serversRepo.existsById', () => {
    it('存在返回 true', () => {
      setupPrepare({ get: () => ({ '1': 1 }) });
      expect(serversRepo.existsById('x')).toBe(true);
    });

    it('不存在返回 false', () => {
      setupPrepare({ get: () => undefined });
      expect(serversRepo.existsById('x')).toBe(false);
    });
  });

  describe('serversRepo.create', () => {
    it('执行 INSERT 并传递全部字段', () => {
      const stmt = setupPrepare();
      serversRepo.create({
        id: 'uuid1', name: 'srv', hostname: 'h', username: 'u',
        port: 2222, password: 'p', use_ssh_key: 1, os_type: 'linux',
      });
      expect(stmt.run).toHaveBeenCalledWith(
        'uuid1', 'srv', 'h', 2222, 'u', 'p', null, 1, null, null, 'linux', null
      );
    });
  });

  describe('serversRepo.delete', () => {
    it('执行 DELETE', () => {
      const stmt = setupPrepare();
      serversRepo.delete('id1');
      expect(stmt.run).toHaveBeenCalledWith('id1');
    });
  });

  // ── groupsRepo ──

  describe('groupsRepo.list', () => {
    it('返回带 server_count 的分组列表', () => {
      const fakeGroups = [{ id: 'g1', name: 'group1', server_count: 3, children_count: 0 }];
      setupPrepare({ all: () => fakeGroups });
      const result = groupsRepo.list();
      expect(result).toBe(fakeGroups);
    });
  });

  describe('groupsRepo.create', () => {
    it('执行 INSERT', () => {
      const stmt = setupPrepare();
      groupsRepo.create({ id: 'g1', name: 'group1', description: 'desc', sort_order: 2 });
      expect(stmt.run).toHaveBeenCalledWith('g1', 'group1', 'desc', null, 2);
    });
  });

  describe('groupsRepo.delete', () => {
    it('先删映射再删分组', () => {
      const stmt = setupPrepare();
      groupsRepo.delete('g1');
      expect(stmt.run).toHaveBeenCalledTimes(2);
      expect(stmt.run).toHaveBeenNthCalledWith(1, 'g1');
      expect(stmt.run).toHaveBeenNthCalledWith(2, 'g1');
    });
  });

  describe('groupsRepo.addMapping', () => {
    it('执行 INSERT OR IGNORE', () => {
      const stmt = setupPrepare();
      groupsRepo.addMapping('srv1', 'g1');
      expect(stmt.run).toHaveBeenCalledWith('srv1', 'g1');
    });
  });

  describe('groupsRepo.removeMapping', () => {
    it('执行 DELETE FROM server_group_mapping', () => {
      const stmt = setupPrepare();
      groupsRepo.removeMapping('srv1', 'g1');
      expect(stmt.run).toHaveBeenCalledWith('srv1', 'g1');
    });
  });

  describe('groupsRepo.countChildren', () => {
    it('返回子分组数', () => {
      setupPrepare({ get: () => ({ c: 2 }) });
      expect(groupsRepo.countChildren('g1')).toBe(2);
    });
  });

  // ── sshKeysRepo ──

  describe('sshKeysRepo.list', () => {
    it('返回带 usage_count 的 SSH key 列表', () => {
      const fakeKeys = [{ id: 'k1', name: 'key1', usage_count: 3 }];
      setupPrepare({ all: () => fakeKeys });
      expect(sshKeysRepo.list()).toBe(fakeKeys);
    });
  });

  describe('sshKeysRepo.getById', () => {
    it('按 ID 查询', () => {
      const fakeKey = { id: 'k1', name: 'key1' };
      const stmt = setupPrepare({ get: () => fakeKey });
      expect(sshKeysRepo.getById('k1')).toBe(fakeKey);
      expect(stmt.get).toHaveBeenCalledWith('k1');
    });
  });

  describe('sshKeysRepo.findByName', () => {
    it('按名称查询', () => {
      const stmt = setupPrepare({ get: () => ({ id: 'k1' }) });
      sshKeysRepo.findByName('mykey');
      expect(stmt.get).toHaveBeenCalledWith('mykey');
    });
  });

  describe('sshKeysRepo.countUsage', () => {
    it('返回使用该 key 的服务器数', () => {
      setupPrepare({ get: () => ({ c: 4 }) });
      expect(sshKeysRepo.countUsage('k1')).toBe(4);
    });
  });

  describe('sshKeysRepo.createKey', () => {
    it('执行 key 类型的 INSERT', () => {
      const stmt = setupPrepare();
      sshKeysRepo.createKey({ id: 'k1', name: 'key1', key_type: 'rsa', fingerprint: 'fp', private_key: 'pk' });
      expect(stmt.run).toHaveBeenCalledWith('k1', 'key1', 'rsa', 'fp', 'pk', null);
    });
  });

  describe('sshKeysRepo.delete', () => {
    it('执行 DELETE', () => {
      const stmt = setupPrepare();
      sshKeysRepo.delete('k1');
      expect(stmt.run).toHaveBeenCalledWith('k1');
    });
  });

  // ── 聚合对象 ──

  describe('聚合导出', () => {
    it('serverRepository 包含 servers / groups / sshKeys 三个子 repo', () => {
      expect(serverRepository.servers).toBe(serversRepo);
      expect(serverRepository.groups).toBe(groupsRepo);
      expect(serverRepository.sshKeys).toBe(sshKeysRepo);
    });
  });

  // ── DI 可替换性 ──

  describe('container.replace()', () => {
    it('serverRepository 可通过 container.replace() 注入 mock', () => {
      const mockRepo = { servers: { list: vi.fn(() => []) } };
      container.replace('serverRepository', mockRepo);

      const result = container.get<typeof mockRepo>('serverRepository');
      expect(result).toBe(mockRepo);
      expect(result.servers.list()).toEqual([]);
    });
  });
});
