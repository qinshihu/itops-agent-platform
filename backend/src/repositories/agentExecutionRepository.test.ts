/**
 * agentExecutionRepository 测试
 *
 * 验证：
 *   - create 序列化 metadata 并写入正确字段
 *   - listByAgent/countByAgent 的过滤与分页
 *   - updateStatus 带/不带 errorMessage 的两条分支
 *   - container.replace() 可注入 mock
 *
 * 使用 vi.hoisted() 构建 mock db，避免 hoisting 错误（项目约定）。
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

import { agentExecutionRepository } from './agentExecutionRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

function stubPrepare(overrides?: { get?: unknown; all?: unknown[]; runResult?: unknown }) {
  mockDb.prepare = vi.fn(() => ({
    run: vi.fn(() => overrides?.runResult ?? { changes: 1, lastInsertRowid: 1 }),
    get: vi.fn(() => overrides?.get ?? undefined),
    all: vi.fn(() => overrides?.all ?? []),
  })) as never;
}

describe('agentExecutionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('metadata 对象被 JSON.stringify 序列化', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO agent_executions');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      agentExecutionRepository.create({
        id: 'e1', agentId: 'a1', agentName: 'agent',
        inputText: 'in', outputText: 'out', status: 'success',
        metadata: { foo: 'bar' },
      });
      const args = runSpy.mock.calls[0];
      expect(args[8]).toBe(JSON.stringify({ foo: 'bar' }));
    });

    it('metadata 为 null 时传 null', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

      agentExecutionRepository.create({
        id: 'e2', agentId: 'a1', agentName: 'agent',
        inputText: 'in', outputText: 'out', status: 'failure',
      });
      const args = runSpy.mock.calls[0];
      expect(args[8]).toBeNull();
    });
  });

  describe('getById', () => {
    it('执行 SELECT * FROM agent_executions WHERE id = ?', () => {
      stubPrepare({ get: { id: 'e1', agent_name: 'x' } });
      const result = agentExecutionRepository.getById('e1');
      expect(result?.agent_name).toBe('x');
    });
  });

  describe('listByAgent', () => {
    it('带 status 过滤生成额外参数', () => {
      const allSpy = vi.fn(() => []);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('AND status = ?');
        expect(sql).toContain('ORDER BY created_at DESC');
        expect(sql).toContain('LIMIT ? OFFSET ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      agentExecutionRepository.listByAgent('a1', { status: 'success', limit: 10, offset: 5 });
      expect(allSpy).toHaveBeenCalledWith('a1', 'success', 10, 5);
    });
  });

  describe('countByAgent', () => {
    it('返回 count 字段值', () => {
      stubPrepare({ get: { count: 42 } });
      expect(agentExecutionRepository.countByAgent('a1')).toBe(42);
    });
  });

  describe('countAll', () => {
    it('执行全表 COUNT', () => {
      stubPrepare({ get: { count: 7 } });
      expect(agentExecutionRepository.countAll()).toBe(7);
    });
  });

  describe('updateStatus', () => {
    it('带 errorMessage 时走双字段 UPDATE', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('status = ?, error_message = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });
      agentExecutionRepository.updateStatus('e1', 'error', 'boom');
      expect(runSpy).toHaveBeenCalledWith('error', 'boom', 'e1');
    });

    it('不带 errorMessage 时走单字段 UPDATE', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('SET status = ? WHERE id = ?');
        expect(sql).not.toContain('error_message');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });
      agentExecutionRepository.updateStatus('e1', 'running');
      expect(runSpy).toHaveBeenCalledWith('running', 'e1');
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getById: vi.fn(() => ({ id: 'mocked' })) };
      container.replace('agentExecutionRepository', mockRepo);
      const result = container.get<typeof mockRepo>('agentExecutionRepository');
      expect(result).toBe(mockRepo);
      expect(result.getById('any').id).toBe('mocked');
    });
  });
});
