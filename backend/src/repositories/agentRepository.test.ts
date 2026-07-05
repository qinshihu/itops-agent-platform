/**
 * agentRepository 测试
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

import { agentRepository } from './agentRepository';
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

describe('agentRepository', () => {
  beforeEach(() => {
    prepared.clear();
  });

  describe('list', () => {
    it('联表 ai_models 查询并按 is_preset DESC 排序', () => {
      const allSpy = vi.fn(() => [{ id: '1', name: 'agent1', primary_model_name: 'm1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('LEFT JOIN ai_models pm');
        expect(sql).toContain('ORDER BY a.is_preset DESC');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = agentRepository.list();
      expect(result).toHaveLength(1);
    });

    it('带 category 过滤', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('a.category = ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      agentRepository.list({ category: 'network' });
      expect(allSpy).toHaveBeenCalledWith('network');
    });

    it('带 search 过滤生成 3 个 LIKE 参数', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('a.name LIKE ? OR a.role LIKE ? OR a.description LIKE ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      agentRepository.list({ search: '告警' });
      const args = allSpy.mock.calls[0];
      expect(args[0]).toBe('%告警%');
      expect(args[1]).toBe('%告警%');
      expect(args[2]).toBe('%告警%');
    });
  });

  describe('getById', () => {
    it('执行 SELECT * FROM agents WHERE id = ?', () => {
      mockPrepareOnce({ id: '1', name: 'agent' });
      const result = agentRepository.getById('1');
      expect(result?.name).toBe('agent');
    });
  });

  describe('getByIdWithModels', () => {
    it('联表查询模型名称', () => {
      mockPrepareOnce({ id: '1', primary_model_name: 'm1' });
      const result = agentRepository.getByIdWithModels('1');
      expect(result?.primary_model_name).toBe('m1');
    });
  });

  describe('getLlmConfig', () => {
    it('查询 8 个 LLM 配置字段', () => {
      mockPrepareOnce({ id: '1', name: 'a', system_prompt: 'p', temperature: 0.7 });
      const result = agentRepository.getLlmConfig('1');
      expect(result?.name).toBe('a');
    });
  });

  describe('countAll', () => {
    it('返回 Agent 总数', () => {
      mockPrepareOnce({ count: 15 });
      expect(agentRepository.countAll()).toBe(15);
    });
  });

  describe('getStats', () => {
    it('返回 total + enabled', () => {
      mockPrepareOnce({ total: 10, enabled: 8 });
      const result = agentRepository.getStats();
      expect(result.total).toBe(10);
      expect(result.enabled).toBe(8);
    });

    it('enabled 为 null 时返回 0', () => {
      mockPrepareOnce({ total: 0, enabled: null });
      const result = agentRepository.getStats();
      expect(result.enabled).toBe(0);
    });
  });

  describe('countByPrimaryModelId', () => {
    it('返回使用指定主模型的 Agent 数', () => {
      mockPrepareOnce({ count: 2 });
      expect(agentRepository.countByPrimaryModelId('m1')).toBe(2);
    });
  });

  describe('create', () => {
    it('执行 15 字段 INSERT 并应用默认值', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO agents');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      agentRepository.create({ id: 'a1', name: 'agent1' });
      expect(runSpy).toHaveBeenCalledWith(
        'a1', 'agent1', null, null, null, 'doubao-4o', 0.7, 1, 0, null, null, null, 'doubao', null, null
      );
    });

    it('自定义字段值正确传递', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

      agentRepository.create({
        id: 'a2', name: 'agent2', model: 'gpt-4o', temperature: 0.5,
        enabled: 0, is_preset: 1, api_provider: 'openai', primary_model_id: 'm1',
      });
      expect(runSpy).toHaveBeenCalledWith(
        'a2', 'agent2', null, null, null, 'gpt-4o', 0.5, 0, 1, null, null, null, 'openai', 'm1', null
      );
    });
  });

  describe('update (动态 SET)', () => {
    it('空 fields 返回 0', () => {
      mockDb.prepare = vi.fn();
      expect(agentRepository.update('1', {})).toBe(0);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('构建动态 SET 并附加 updated_at', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('name = ?');
        expect(sql).toContain("updated_at = datetime('now','localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const result = agentRepository.update('1', { name: 'new' });
      expect(runSpy).toHaveBeenCalledWith('new', '1');
      expect(result).toBe(1);
    });
  });

  describe('incrementUsageStats', () => {
    it('更新 usage_count + 1 + last_used_at + updated_at', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('usage_count = usage_count + 1');
        expect(sql).toContain('last_used_at = datetime(\'now\',\'localtime\')');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      agentRepository.incrementUsageStats('a1');
      expect(runSpy).toHaveBeenCalledWith('a1');
    });
  });

  describe('updatePresetModel', () => {
    it('执行 UPDATE agents SET model = ? WHERE is_preset = 1', () => {
      const runSpy = vi.fn(() => ({ changes: 5 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('is_preset = 1');
        expect(sql).toContain('SET model = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const changes = agentRepository.updatePresetModel('doubao-4o');
      expect(changes).toBe(5);
      expect(runSpy).toHaveBeenCalledWith('doubao-4o');
    });
  });

  describe('clearPresetModel', () => {
    it('执行 UPDATE agents SET model = NULL WHERE is_preset = 1', () => {
      const runSpy = vi.fn(() => ({ changes: 8 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('model = NULL');
        expect(sql).toContain('is_preset = 1');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const changes = agentRepository.clearPresetModel();
      expect(changes).toBe(8);
    });
  });

  describe('delete', () => {
    it('删除成功返回 true', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
      expect(agentRepository.delete('1')).toBe(true);
    });

    it('删除不存在记录返回 false', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 0 })), get: vi.fn(), all: vi.fn() }));
      expect(agentRepository.delete('missing')).toBe(false);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getById: vi.fn(() => ({ id: 'mocked' })) };
      container.replace('agentRepository', mockRepo);

      const result = container.get<typeof mockRepo>('agentRepository');
      expect(result).toBe(mockRepo);
      expect(result.getById('any').id).toBe('mocked');
    });
  });
});
