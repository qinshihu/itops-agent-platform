/**
 * workflowRepository 测试
 *
 * 验证：
 *   - workflows / tasks / scheduledTasks 三个子 repository 各方法
 *   - 聚合导出结构正确
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

import { workflowRepository, workflowsRepo, tasksRepo, scheduledTasksRepo } from './workflowRepository';
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

describe('workflowRepository', () => {
  beforeEach(() => {
    prepared.clear();
  });

  describe('聚合结构', () => {
    it('三个子 repository 正确聚合', () => {
      expect(workflowRepository.workflows).toBe(workflowsRepo);
      expect(workflowRepository.tasks).toBe(tasksRepo);
      expect(workflowRepository.scheduledTasks).toBe(scheduledTasksRepo);
    });
  });

  // ── workflows 子 repository ──

  describe('workflowsRepo', () => {
    describe('list', () => {
      it('按 is_template DESC, created_at DESC 排序', () => {
        const allSpy = vi.fn(() => [{ id: '1', name: 'wf1' }]);
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('ORDER BY is_template DESC, created_at DESC');
          return { run: vi.fn(), get: vi.fn(), all: allSpy };
        });

        const result = workflowsRepo.list();
        expect(result).toHaveLength(1);
      });
    });

    describe('getById', () => {
      it('按 id 查询完整记录', () => {
        mockPrepareOnce({ id: '1', name: 'wf' });
        const result = workflowsRepo.getById('1');
        expect(result?.id).toBe('1');
      });
    });

    describe('existsById', () => {
      it('存在返回 true', () => {
        mockPrepareOnce({ id: '1' });
        expect(workflowsRepo.existsById('1')).toBe(true);
      });

      it('不存在返回 false', () => {
        mockPrepareOnce(undefined);
        expect(workflowsRepo.existsById('missing')).toBe(false);
      });
    });

    describe('countWithTemplates', () => {
      it('返回 total 和 templates 计数', () => {
        mockPrepareOnce({ total: 10, templates: 3 });
        const result = workflowsRepo.countWithTemplates();
        expect(result.total).toBe(10);
        expect(result.templates).toBe(3);
      });

      it('templates 为 null 时返回 0', () => {
        mockPrepareOnce({ total: 0, templates: null });
        const result = workflowsRepo.countWithTemplates();
        expect(result.templates).toBe(0);
      });
    });

    describe('create', () => {
      it('执行 7 字段 INSERT', () => {
        const runSpy = vi.fn();
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('INSERT INTO workflows');
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        workflowsRepo.create({ id: 'w1', name: 'wf1', is_template: 1 });
        expect(runSpy).toHaveBeenCalledWith('w1', 'wf1', null, null, null, null, 1);
      });
    });

    describe('update', () => {
      it('更新 6 字段 + updated_at', () => {
        const runSpy = vi.fn(() => ({ changes: 1 }));
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('SET name = ?');
          expect(sql).toContain('is_template = ?');
          expect(sql).toContain("updated_at = datetime('now','localtime')");
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        const result = workflowsRepo.update('w1', { name: 'new', is_template: 0 });
        expect(runSpy).toHaveBeenCalledWith('new', null, null, null, null, 0, 'w1');
        expect(result).toBe(1);
      });
    });

    describe('delete', () => {
      it('删除成功返回 true', () => {
        mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
        expect(workflowsRepo.delete('w1')).toBe(true);
      });
    });
  });

  // ── tasks 子 repository ──

  describe('tasksRepo', () => {
    describe('list (动态查询)', () => {
      it('无过滤查询全部', () => {
        const allSpy = vi.fn(() => [{ id: 't1' }]);
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toBe('SELECT * FROM tasks ORDER BY created_at DESC');
          return { run: vi.fn(), get: vi.fn(), all: allSpy };
        });

        const result = tasksRepo.list();
        expect(allSpy).toHaveBeenCalledWith();
        expect(result).toHaveLength(1);
      });

      it('带 status 过滤', () => {
        const allSpy = vi.fn(() => []);
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('WHERE status = ?');
          return { run: vi.fn(), get: vi.fn(), all: allSpy };
        });

        tasksRepo.list({ status: 'running' });
        expect(allSpy).toHaveBeenCalledWith('running');
      });

      it('带 limit', () => {
        const allSpy = vi.fn(() => []);
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('LIMIT ?');
          return { run: vi.fn(), get: vi.fn(), all: allSpy };
        });

        tasksRepo.list({ limit: 15 });
        expect(allSpy).toHaveBeenCalledWith(15);
      });
    });

    describe('getStatus', () => {
      it('只返回 status 字段', () => {
        mockPrepareOnce({ status: 'running' });
        expect(tasksRepo.getStatus('t1')).toBe('running');
      });
    });

    describe('countPending', () => {
      it('返回 pending 任务数', () => {
        mockPrepareOnce({ count: 5 });
        expect(tasksRepo.countPending()).toBe(5);
      });
    });

    describe('create', () => {
      it('执行 5 字段 INSERT，status 硬编码 pending', () => {
        const runSpy = vi.fn();
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain("'pending'");
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        tasksRepo.create({ id: 't1', workflow_id: 'w1', name: 'task1', context: '{}' });
        expect(runSpy).toHaveBeenCalledWith('t1', 'w1', 'task1', '{}');
      });

      it('context 默认 null', () => {
        const runSpy = vi.fn();
        mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

        tasksRepo.create({ id: 't2', workflow_id: 'w1', name: 'task2' });
        expect(runSpy).toHaveBeenCalledWith('t2', 'w1', 'task2', null);
      });
    });

    describe('updateStatus', () => {
      it('仅更新 status', () => {
        const runSpy = vi.fn(() => ({ changes: 1 }));
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toBe('UPDATE tasks SET status = ? WHERE id = ?');
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        const result = tasksRepo.updateStatus('t1', 'paused');
        expect(runSpy).toHaveBeenCalledWith('paused', 't1');
        expect(result).toBe(1);
      });
    });

    describe('updateStatusWithEndTime', () => {
      it('更新 status + end_time', () => {
        const runSpy = vi.fn(() => ({ changes: 1 }));
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain("end_time = datetime('now','localtime')");
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        tasksRepo.updateStatusWithEndTime('t1', 'cancelled');
        expect(runSpy).toHaveBeenCalledWith('cancelled', 't1');
      });
    });

    describe('finalizeTask', () => {
      it('更新 status + end_time + node_results + current_node_id=NULL', () => {
        const runSpy = vi.fn(() => ({ changes: 1 }));
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('node_results = ?');
          expect(sql).toContain('current_node_id = NULL');
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        tasksRepo.finalizeTask('t1', 'completed', '{"results":[]}');
        expect(runSpy).toHaveBeenCalledWith('completed', '{"results":[]}', 't1');
      });
    });

    describe('appendTaskLog', () => {
      it('使用 json_insert 追加日志', () => {
        const runSpy = vi.fn();
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('json_insert');
          expect(sql).toContain("IFNULL(logs, '[]')");
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        tasksRepo.appendTaskLog('t1', { type: 'info', content: 'msg', nodeId: 'n1' });
        expect(runSpy).toHaveBeenCalledWith('info', 'msg', 'n1', 't1');
      });

      it('nodeId 默认 null', () => {
        const runSpy = vi.fn();
        mockDb.prepare = vi.fn(() => ({ run: runSpy, get: vi.fn(), all: vi.fn() }));

        tasksRepo.appendTaskLog('t1', { type: 'info', content: 'msg' });
        expect(runSpy).toHaveBeenCalledWith('info', 'msg', null, 't1');
      });
    });
  });

  // ── scheduled_tasks 子 repository ──

  describe('scheduledTasksRepo', () => {
    describe('list', () => {
      it('联表 workflows 查询 workflow_name', () => {
        const allSpy = vi.fn(() => [{ id: 's1', workflow_name: 'wf1' }]);
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('LEFT JOIN workflows w');
          expect(sql).toContain('w.name as workflow_name');
          expect(sql).toContain('st.schedule as cron_expression');
          return { run: vi.fn(), get: vi.fn(), all: allSpy };
        });

        const result = scheduledTasksRepo.list();
        expect(result).toHaveLength(1);
        expect(result[0].workflow_name).toBe('wf1');
      });
    });

    describe('getById', () => {
      it('按 id 查询完整记录', () => {
        mockPrepareOnce({ id: 's1', name: 'task1' });
        const result = scheduledTasksRepo.getById('s1');
        expect(result?.name).toBe('task1');
      });
    });

    describe('listEnabled', () => {
      it('查询 enabled = 1', () => {
        const allSpy = vi.fn(() => [{ id: 's1' }]);
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('WHERE enabled = 1');
          return { run: vi.fn(), get: vi.fn(), all: allSpy };
        });

        const result = scheduledTasksRepo.listEnabled();
        expect(result).toHaveLength(1);
      });
    });

    describe('countAll', () => {
      it('返回总数', () => {
        mockPrepareOnce({ count: 7 });
        expect(scheduledTasksRepo.countAll()).toBe(7);
      });
    });

    describe('create', () => {
      it('执行 8 字段 INSERT', () => {
        const runSpy = vi.fn();
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('INSERT INTO scheduled_tasks');
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        scheduledTasksRepo.create({
          id: 's1', name: 'task1', schedule: '0 * * * *', enabled: 1,
        });
        // 验证前 6 个参数（最后 2 个是 ISO 时间戳，动态）
        const args = runSpy.mock.calls[0];
        expect(args[0]).toBe('s1');
        expect(args[1]).toBe('task1');
        expect(args[2]).toBeNull();
        expect(args[3]).toBeNull();
        expect(args[4]).toBe('0 * * * *');
        expect(args[5]).toBe(1);
        expect(typeof args[6]).toBe('string'); // created_at
        expect(typeof args[7]).toBe('string'); // updated_at
      });
    });

    describe('update (动态 SET)', () => {
      it('空 fields 返回 0', () => {
        mockDb.prepare = vi.fn();
        const result = scheduledTasksRepo.update('s1', {});
        expect(result).toBe(0);
        expect(mockDb.prepare).not.toHaveBeenCalled();
      });

      it('构建动态 SET 并附加 updated_at', () => {
        const runSpy = vi.fn(() => ({ changes: 1 }));
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain('name = ?');
          expect(sql).toContain('enabled = ?');
          expect(sql).toContain('updated_at = ?');
          expect(sql).toContain('WHERE id = ?');
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        const result = scheduledTasksRepo.update('s1', { name: 'new', enabled: 0 });
        const args = runSpy.mock.calls[0];
        expect(args[0]).toBe('new');
        expect(args[1]).toBe(0);
        expect(typeof args[2]).toBe('string'); // updated_at
        expect(args[3]).toBe('s1');
        expect(result).toBe(1);
      });
    });

    describe('setEnabled', () => {
      it('更新 enabled + updated_at', () => {
        const runSpy = vi.fn(() => ({ changes: 1 }));
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toBe('UPDATE scheduled_tasks SET enabled = ?, updated_at = ? WHERE id = ?');
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        const result = scheduledTasksRepo.setEnabled('s1', 1);
        expect(runSpy.mock.calls[0][0]).toBe(1);
        expect(runSpy.mock.calls[0][2]).toBe('s1');
        expect(result).toBe(1);
      });
    });

    describe('updateLastRun', () => {
      it('更新 last_run + last_status', () => {
        const runSpy = vi.fn();
        mockDb.prepare = vi.fn((sql: string) => {
          expect(sql).toContain("last_run = datetime('now','localtime')");
          expect(sql).toContain('last_status = ?');
          return { run: runSpy, get: vi.fn(), all: vi.fn() };
        });

        scheduledTasksRepo.updateLastRun('s1', 'success');
        expect(runSpy).toHaveBeenCalledWith('success', 's1');
      });
    });

    describe('delete', () => {
      it('删除成功返回 true', () => {
        mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
        expect(scheduledTasksRepo.delete('s1')).toBe(true);
      });
    });
  });

  // ── DI 可替换性 ──

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = {
        workflows: { getById: vi.fn(() => ({ id: 'mocked' })) },
        tasks: { getStatus: vi.fn(() => 'mocked') },
        scheduledTasks: { list: vi.fn(() => []) },
      };
      container.replace('workflowRepository', mockRepo);

      const result = container.get<typeof mockRepo>('workflowRepository');
      expect(result).toBe(mockRepo);
      expect(result.workflows.getById('any').id).toBe('mocked');
    });
  });
});
