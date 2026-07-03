/**
 * knowledgeRepository 测试
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

import { knowledgeRepository } from './knowledgeRepository';
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

describe('knowledgeRepository', () => {
  beforeEach(() => {
    prepared.clear();
  });

  describe('list', () => {
    it('无过滤查询全部，按 usage_count DESC 排序', () => {
      const allSpy = vi.fn(() => [{ id: '1', title: 'kb1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('ORDER BY usage_count DESC, created_at DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = knowledgeRepository.list();
      expect(result).toHaveLength(1);
      expect(allSpy).toHaveBeenCalledWith();
    });

    it('带 category + search 过滤', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('category = ?');
        expect(sql).toContain('(title LIKE ? OR content LIKE ?)');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      knowledgeRepository.list({ category: 'network', search: 'switch' });
      expect(allSpy).toHaveBeenCalledWith('network', '%switch%', '%switch%');
    });
  });

  describe('search', () => {
    it('带 limit 生成 3 个参数', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('title LIKE ? OR content LIKE ?');
        expect(sql).toContain('LIMIT ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      knowledgeRepository.search('keyword', 10);
      expect(allSpy).toHaveBeenCalledWith('%keyword%', '%keyword%', 10);
    });

    it('无 limit 不带 LIMIT 子句', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).not.toContain('LIMIT');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      knowledgeRepository.search('keyword');
      expect(allSpy).toHaveBeenCalledWith('%keyword%', '%keyword%');
    });
  });

  describe('getById', () => {
    it('按 id 查询完整记录', () => {
      mockPrepareOnce({ id: '1', title: 'kb1' });
      const result = knowledgeRepository.getById('1');
      expect(result?.title).toBe('kb1');
    });
  });

  describe('findByAlertId', () => {
    it('按 alert_id 查询，LIMIT 1', () => {
      mockPrepareOnce({ id: '1', alert_id: 'a1' });
      const result = knowledgeRepository.findByAlertId('a1');
      expect(result?.alert_id).toBe('a1');
    });
  });

  describe('findDuplicates', () => {
    it('按 title LIKE 或 alert_id 匹配，LIMIT 5', () => {
      const allSpy = vi.fn(() => [{ id: '1', title: 't', content: 'c' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('title LIKE ? OR alert_id = ?');
        expect(sql).toContain('LIMIT 5');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = knowledgeRepository.findDuplicates('title', 'a1');
      expect(allSpy).toHaveBeenCalledWith('%title%', 'a1');
      expect(result).toHaveLength(1);
    });
  });

  describe('countAll', () => {
    it('返回总数', () => {
      mockPrepareOnce({ count: 42 });
      expect(knowledgeRepository.countAll()).toBe(42);
    });
  });

  describe('countByCategory', () => {
    it('按分类统计并按 count DESC 排序', () => {
      const allSpy = vi.fn(() => [{ category: 'network', count: 5 }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('GROUP BY category');
        expect(sql).toContain('ORDER BY count DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = knowledgeRepository.countByCategory();
      expect(result[0].count).toBe(5);
    });
  });

  describe('create', () => {
    it('执行 16 字段 INSERT，usage_count 硬编码 1', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO knowledge_base');
        expect(sql).toContain(', 1, datetime(');  // usage_count=1, timestamps
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      knowledgeRepository.create({
        id: 'k1', title: 'title1', category: 'network', content: 'content',
      });
      expect(runSpy).toHaveBeenCalledWith(
        'k1', 'title1', 'network', 'content', null, null, null, null, null, null, null, null, null
      );
    });
  });

  describe('createFromRest', () => {
    it('执行 7 字段 INSERT 含 related_alerts', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('related_alerts');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      knowledgeRepository.createFromRest({
        id: 'k2', title: 't2', content: 'c2',
      });
      expect(runSpy).toHaveBeenCalledWith('k2', 't2', 'general', null, 'c2', null, null);
    });
  });

  describe('mergeOnDuplicate', () => {
    it('合并更新 content + success_rating + duration_ms + usage_count++', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('usage_count = COALESCE(usage_count, 0) + 1');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      knowledgeRepository.mergeOnDuplicate('k1', 'new content', 0.8, 5000);
      expect(runSpy).toHaveBeenCalledWith('new content', 0.8, 5000, 'k1');
    });
  });

  describe('incrementUsageCount', () => {
    it('usage_count++', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('usage_count = usage_count + 1');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      knowledgeRepository.incrementUsageCount('k1');
      expect(runSpy).toHaveBeenCalledWith('k1');
    });
  });

  describe('delete', () => {
    it('删除成功返回 true', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
      expect(knowledgeRepository.delete('1')).toBe(true);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getById: vi.fn(() => ({ id: 'mocked' })) };
      container.replace('knowledgeRepository', mockRepo);

      const result = container.get<typeof mockRepo>('knowledgeRepository');
      expect(result).toBe(mockRepo);
      expect(result.getById('any').id).toBe('mocked');
    });
  });
});
