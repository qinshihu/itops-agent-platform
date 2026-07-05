/**
 * infraRepository 测试（5 子 repository 聚合）
 *
 * 验证：
 *   - toolLinks.create/update 动态 SET
 *   - scripts.list 带 category + search 过滤 + parameters JSON.parse
 *   - notifications.list 分页 + count
 *   - configTemplates.list 返回 { data, total }
 *   - approvals.countPending
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

import { infraRepository } from './infraRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('infraRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('聚合结构', () => {
    it('包含 5 个子 repository', () => {
      expect(infraRepository.toolLinks).toBeDefined();
      expect(infraRepository.scripts).toBeDefined();
      expect(infraRepository.notifications).toBeDefined();
      expect(infraRepository.configTemplates).toBeDefined();
      expect(infraRepository.approvals).toBeDefined();
    });
  });

  describe('toolLinks.create', () => {
    it('插入 tool_links 表并使用 datetime 默认值', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO tool_links');
        expect(sql).toContain("datetime('now', 'localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      infraRepository.toolLinks.create({ id: 't1', name: 'tool1', url: 'http://x' });
      expect(runSpy).toHaveBeenCalledWith('t1', 'tool1', 'http://x', undefined, undefined);
    });
  });

  describe('toolLinks.update', () => {
    it('空字段返回 0', () => {
      mockDb.prepare = vi.fn();
      expect(infraRepository.toolLinks.update('t1', {})).toBe(0);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });
  });

  describe('scripts.list', () => {
    it('带 category 和 search 过滤，search 生成 2 个 LIKE', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('category = ?');
        expect(sql).toContain('name LIKE ? OR description LIKE ?');
        expect(sql).toContain('ORDER BY created_at DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      infraRepository.scripts.list({ category: 'ops', search: 'deploy' });
      const args = allSpy.mock.calls[0];
      expect(args[0]).toBe('ops');
      expect(args[1]).toBe('%deploy%');
      expect(args[2]).toBe('%deploy%');
    });
  });

  describe('scripts.getById', () => {
    it('parameters JSON 字符串被解析为数组', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(),
        get: vi.fn(() => ({ id: 's1', name: 'script1', parameters: '[{"a":1}]', type: 'shell', content: '', version: 1, created_at: '' })),
        all: vi.fn(),
      }));

      const result = infraRepository.scripts.getById('s1');
      expect(result?.parameters).toEqual([{ a: 1 }]);
    });

    it('parameters 为 null 时返回空数组', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(),
        get: vi.fn(() => ({ id: 's1', name: 'script1', parameters: null, type: 'shell', content: '', version: 1, created_at: '' })),
        all: vi.fn(),
      }));

      const result = infraRepository.scripts.getById('s1');
      expect(result?.parameters).toEqual([]);
    });
  });

  describe('notifications.list', () => {
    it('过滤 + 分页 + 默认 limit=50', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('type = ?');
        expect(sql).toContain('ORDER BY created_at DESC LIMIT ? OFFSET ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      infraRepository.notifications.list({ type: 'email', offset: 10 });
      const args = allSpy.mock.calls[0];
      expect(args[0]).toBe('email');
      expect(args[args.length - 2]).toBe(50);
      expect(args[args.length - 1]).toBe(10);
    });
  });

  describe('configTemplates.list', () => {
    it('返回 { data, total } 结构', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(),
        get: vi.fn(() => ({ count: 5 })),
        all: vi.fn(() => [{ id: 'ct1' }]),
      }));

      const result = infraRepository.configTemplates.list({ pageSize: 10, offset: 0 });
      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('approvals.countPending', () => {
    it('统计 status=pending 的审批数', () => {
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain("status = 'pending'");
        return { run: vi.fn(), get: vi.fn(() => ({ count: 3 })), all: vi.fn() };
      });
      expect(infraRepository.approvals.countPending()).toBe(3);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { toolLinks: { list: vi.fn(() => []) }, scripts: { list: vi.fn(() => []) } };
      container.replace('infraRepository', mockRepo);
      const result = container.get<typeof mockRepo>('infraRepository');
      expect(result).toBe(mockRepo);
    });
  });
});
