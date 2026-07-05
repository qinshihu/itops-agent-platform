/**
 * remediationPolicyRepository 测试
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

import { remediationPolicyRepository } from './remediationPolicyRepository';
import { container } from '../core/serviceContainer';

// Mock logger for serviceContainer
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

function mockPrepareOnce(getReturn?: unknown, allReturn?: unknown[]) {
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

describe('remediationPolicyRepository', () => {
  beforeEach(() => {
    prepared.clear();
  });

  describe('getById', () => {
    it('执行 SELECT * FROM remediation_policies WHERE id = ?', () => {
      mockPrepareOnce({ id: '1', name: 'policy1' });
      const result = remediationPolicyRepository.getById('1');
      expect(result?.name).toBe('policy1');
    });
  });

  describe('list', () => {
    it('带 enabled + alert_source 过滤 + 分页', () => {
      const allSpy = vi.fn(() => [{ id: '1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('enabled = ?');
        expect(sql).toContain('alert_source = ?');
        expect(sql).toContain('LIMIT ? OFFSET ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = remediationPolicyRepository.list({ enabled: 1, alert_source: 'zabbix', limit: 10, offset: 0 });
      expect(allSpy).toHaveBeenCalledWith(1, 'zabbix', 10, 0);
      expect(result).toHaveLength(1);
    });
  });

  describe('countAll', () => {
    it('返回策略总数（带过滤）', () => {
      mockPrepareOnce({ count: 5 });
      expect(remediationPolicyRepository.countAll({ enabled: 1 })).toBe(5);
    });
  });

  describe('count / countEnabled', () => {
    it('count 返回总数', () => {
      mockPrepareOnce({ count: 12 });
      expect(remediationPolicyRepository.count()).toBe(12);
    });

    it('countEnabled 返回启用数', () => {
      mockPrepareOnce({ count: 8 });
      expect(remediationPolicyRepository.countEnabled()).toBe(8);
    });
  });

  describe('create', () => {
    it('执行 24 字段 INSERT 并应用默认值', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO remediation_policies');
        expect(sql).toContain('datetime(\'now\',\'localtime\')');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      remediationPolicyRepository.create({ id: 'p1', name: 'policy1', alert_source: 'zabbix', execution_mode: 'approval', workflow_id: 'wf1' });
      expect(runSpy).toHaveBeenCalledWith(
        'p1', 'policy1', null, 'zabbix', null, null, null,
        'approval', 'wf1', null, 3, 300, 0, 0, null, null, 300, 0, null, 0, 1, null
      );
    });
  });

  describe('createMinimal', () => {
    it('执行 10 字段 INSERT（AlertProcessor 临时策略）', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO remediation_policies');
        expect(sql).toContain('enabled, created_at, updated_at');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      remediationPolicyRepository.createMinimal({
        id: 'p2', name: '临时策略: test', description: '系统自动创建',
        alert_source: 'zabbix', alert_severity: 'critical', execution_mode: 'approval', workflow_id: 'wf2'
      });
      expect(runSpy).toHaveBeenCalledWith('p2', '临时策略: test', '系统自动创建', 'zabbix', 'critical', 'approval', 'wf2');
    });
  });

  describe('update (动态 SET)', () => {
    it('空 fields 返回 0', () => {
      mockDb.prepare = vi.fn();
      expect(remediationPolicyRepository.update('1', {})).toBe(0);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('构建动态 SET 并附加 updated_at', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('name = ?');
        expect(sql).toContain('enabled = ?');
        expect(sql).toContain("updated_at = datetime('now','localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const result = remediationPolicyRepository.update('1', { name: 'new', enabled: 0 });
      expect(runSpy).toHaveBeenCalledWith('new', 0, '1');
      expect(result).toBe(1);
    });
  });

  describe('setEnabled', () => {
    it('切换启用状态', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('SET enabled = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      expect(remediationPolicyRepository.setEnabled('1', 1)).toBe(1);
      expect(runSpy).toHaveBeenCalledWith(1, '1');
    });
  });

  describe('delete', () => {
    it('删除成功返回 changes', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
      expect(remediationPolicyRepository.delete('1')).toBe(1);
    });
  });

  describe('findMatchingBySource', () => {
    it('按 source 匹配并排序', () => {
      const allSpy = vi.fn(() => [{ id: '1', alert_source: 'zabbix' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('LOWER(alert_source) = ?');
        expect(sql).toContain('alert_source = \'*\'');
        expect(sql).toContain('ORDER BY');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = remediationPolicyRepository.findMatchingBySource('zabbix', 'zabbix');
      expect(allSpy).toHaveBeenCalledWith('zabbix', 'zabbix');
      expect(result).toHaveLength(1);
    });
  });

  describe('findCatchAll', () => {
    it('查询 alert_source = * 的策略', () => {
      const allSpy = vi.fn(() => [{ id: '1', alert_source: '*' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain("alert_source = '*'");
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = remediationPolicyRepository.findCatchAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('findBySourceSeverityWorkflow', () => {
    it('按 source + severity + workflowId 查找', () => {
      mockPrepareOnce({ id: '1', alert_source: 'zabbix' });
      const result = remediationPolicyRepository.findBySourceSeverityWorkflow('zabbix', 'critical', 'wf1');
      expect(result?.alert_source).toBe('zabbix');
    });
  });

  describe('listForMcp', () => {
    it('MCP 工具列表查询带 enabled 过滤 + limit', () => {
      const allSpy = vi.fn(() => [{ id: '1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('LIMIT ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      remediationPolicyRepository.listForMcp(1, 20);
      expect(allSpy).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('updateWorkflowBindings', () => {
    it('更新 workflow_id + verification + rollback 绑定', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('workflow_id = ?');
        expect(sql).toContain('verification_workflow_id = ?');
        expect(sql).toContain('rollback_workflow_id = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      remediationPolicyRepository.updateWorkflowBindings('p1', 'wf1', 'vf1', null);
      expect(runSpy).toHaveBeenCalledWith('wf1', 'vf1', null, 'p1');
    });
  });

  describe('listIdsNamesWorkflowIds', () => {
    it('返回 id/name/workflow_id 列表', () => {
      mockPrepareOnce(undefined, [{ id: 'p1', name: 'policy1', workflow_id: 'wf1' }]);
      const result = remediationPolicyRepository.listIdsNamesWorkflowIds();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('policy1');
    });
  });

  describe('listNames', () => {
    it('返回 name 列表', () => {
      mockPrepareOnce(undefined, [{ name: 'policy1' }, { name: 'policy2' }]);
      const result = remediationPolicyRepository.listNames();
      expect(result).toHaveLength(2);
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getById: vi.fn(() => ({ id: 'mocked' })) };
      container.replace('remediationPolicyRepository', mockRepo);

      const result = container.get<typeof mockRepo>('remediationPolicyRepository');
      expect(result).toBe(mockRepo);
      expect(result.getById('any').id).toBe('mocked');
    });
  });
});
