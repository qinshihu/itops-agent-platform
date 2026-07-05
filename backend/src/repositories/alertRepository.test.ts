/**
 * alertRepository 测试（聚焦 Phase 1.4 新增子 repository）
 *
 * 验证：
 *   - deviceAssociations / correlations / aarsLogs / noiseReduction / workflowMappings
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

import { alertRepository } from './alertRepository';
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

describe('alertRepository 子 repository', () => {
  beforeEach(() => {
    prepared.clear();
  });

  // ── deviceAssociations ──

  describe('deviceAssociations', () => {
    it('getByAlertId 查询关联设备', () => {
      mockPrepareOnce({ device_type: 'server', device_id: 's1', match_method: 'exact_hostname' });
      const result = alertRepository.deviceAssociations.getByAlertId('alert1');
      expect(result?.device_type).toBe('server');
    });

    it('save 执行 INSERT OR REPLACE', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT OR REPLACE INTO alert_device_associations');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.deviceAssociations.save({
        alert_id: 'a1', device_type: 'server', device_id: 's1', match_method: 'exact_hostname', confidence: 100
      });
      expect(runSpy).toHaveBeenCalledWith('a1', 'server', 's1', 'exact_hostname', 100);
    });

    it('recordUnmatched 执行 INSERT OR IGNORE', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT OR IGNORE INTO alert_device_match_log');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.deviceAssociations.recordUnmatched('a1', 'title', 'host1');
      expect(runSpy).toHaveBeenCalledWith('a1', 'title', 'host1');
    });
  });

  // ── correlations ──

  describe('correlations', () => {
    it('listGroups 带 status 过滤 + 分页', () => {
      const allSpy = vi.fn(() => [{ id: 'g1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('member_count');
        expect(sql).toContain('g.status = ?');
        expect(sql).toContain('LIMIT ? OFFSET ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      alertRepository.correlations.listGroups({ status: 'open', limit: 10, offset: 0 });
      expect(allSpy).toHaveBeenCalledWith('open', 10, 0);
    });

    it('getAlertGroup 按 alertId 查找所属分组', () => {
      mockPrepareOnce({ id: 'g1', title: 'group1' });
      const result = alertRepository.correlations.getAlertGroup('a1');
      expect(result?.title).toBe('group1');
    });

    it('createGroup 执行 INSERT', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO alert_correlation_groups');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.correlations.createGroup({
        id: 'g1', title: 't', status: 'open', root_alert_id: 'a1', alert_count: 1,
        device_ids: '[]', severity: 'high', auto_detected: 1, created_at: '2026', updated_at: '2026'
      });
      expect(runSpy).toHaveBeenCalledWith('g1', 't', 'open', 'a1', 1, '[]', 'high', 1, '2026', '2026');
    });

    it('addMember 执行 INSERT OR IGNORE', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT OR IGNORE INTO alert_correlation_members');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.correlations.addMember({ id: 'm1', group_id: 'g1', alert_id: 'a1', is_root: 1 });
      expect(runSpy).toHaveBeenCalledWith('m1', 'g1', 'a1', 1);
    });

    it('resolveGroup 设置 status = resolved', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain("status = 'resolved'");
        expect(sql).toContain('root_cause = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.correlations.resolveGroup('g1', 'root cause');
      expect(runSpy).toHaveBeenCalledWith('root cause', 'g1');
    });

    it('deleteGroup 删成员 + 删分组', () => {
      const runSpy = vi.fn();
      let callCount = 0;
      mockDb.prepare = vi.fn((sql: string) => {
        callCount++;
        if (callCount === 1) {
          expect(sql).toContain('DELETE FROM alert_correlation_members');
        } else {
          expect(sql).toContain('DELETE FROM alert_correlation_groups');
        }
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.correlations.deleteGroup('g1');
      expect(runSpy).toHaveBeenCalledTimes(2);
    });

    it('getStats 返回 5 项统计', () => {
      let callCount = 0;
      mockDb.prepare = vi.fn(() => {
        callCount++;
        // 第 4 次调用是 AVG 查询，其余是 COUNT 查询
        if (callCount === 4) {
          return { run: vi.fn(), get: vi.fn(() => ({ avg: 2.5 })), all: vi.fn() };
        }
        return { run: vi.fn(), get: vi.fn(() => ({ count: 5 })), all: vi.fn() };
      });

      const stats = alertRepository.correlations.getStats();
      expect(stats.total).toBe(5);
      expect(stats.open).toBe(5);
      expect(stats.avgAlertCount).toBe(2.5);
    });
  });

  // ── aarsLogs ──

  describe('aarsLogs', () => {
    it('getByAlertId 查询单条日志', () => {
      mockPrepareOnce({ id: 'log1', alert_id: 'a1', status: 'resolved' });
      const result = alertRepository.aarsLogs.getByAlertId('a1');
      expect(result?.status).toBe('resolved');
    });

    it('list 带 limit 参数', () => {
      const allSpy = vi.fn(() => [{ id: 'log1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('ORDER BY started_at DESC');
        expect(sql).toContain('LIMIT ?');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      alertRepository.aarsLogs.list(20);
      expect(allSpy).toHaveBeenCalledWith(20);
    });

    it('save 执行 15 字段 INSERT OR REPLACE', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT OR REPLACE INTO aars_response_logs');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.aarsLogs.save({
        id: 'log1', alert_id: 'a1', status: 'pending',
        device_id: 's1', device_type: 'server'
      });
      expect(runSpy).toHaveBeenCalled();
      const args = runSpy.mock.calls[0];
      expect(args[0]).toBe('log1');
      expect(args[1]).toBe('a1');
      expect(args[2]).toBe('s1');
      expect(args[3]).toBe('server');
      expect(args[5]).toBe('pending');
      expect(args[11]).toBe('not_needed'); // approval_status default
    });

    it('updateCompleted 设置 completed_at', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('completed_at = datetime(\'now\',\'localtime\')');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.aarsLogs.updateCompleted('log1');
      expect(runSpy).toHaveBeenCalledWith('log1');
    });
  });

  // ── noiseReduction ──

  describe('noiseReduction', () => {
    it('getByFingerprint 按 fingerprint 查询', () => {
      mockPrepareOnce({ id: 'n1', alert_fingerprint: 'fp1', is_suppressed: 1 });
      const result = alertRepository.noiseReduction.getByFingerprint('fp1');
      expect(result?.is_suppressed).toBe(1);
    });

    it('create 执行 INSERT OR IGNORE', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT OR IGNORE INTO alert_noise_reduction');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.noiseReduction.create({
        id: 'n1', alert_fingerprint: 'fp1', alert_source: 'zabbix',
        alert_title: 't', first_occurrence: '2026', last_occurrence: '2026'
      });
      expect(runSpy).toHaveBeenCalledWith('n1', 'fp1', 'zabbix', 't', '2026', '2026');
    });

    it('suppress 设置 is_suppressed = 1', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('is_suppressed = 1');
        expect(sql).toContain('suppression_reason = ?');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.noiseReduction.suppress('fp1', '频繁告警', '2026-07-02');
      expect(runSpy).toHaveBeenCalledWith('频繁告警', '2026-07-02', 'fp1');
    });

    it('unsuppress 返回 changes', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
      expect(alertRepository.noiseReduction.unsuppress('fp1')).toBe(1);
    });

    it('cleanup 返回删除行数', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 5 })), get: vi.fn(), all: vi.fn() }));
      expect(alertRepository.noiseReduction.cleanup('2026-01-01')).toBe(5);
    });
  });

  // ── workflowMappings ──

  describe('workflowMappings', () => {
    it('list JOIN workflows 获取 workflow_name', () => {
      const allSpy = vi.fn(() => [{ id: 'm1', workflow_name: 'wf1' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('LEFT JOIN workflows w');
        expect(sql).toContain('workflow_name');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      const result = alertRepository.workflowMappings.list();
      expect(result).toHaveLength(1);
    });

    it('create 执行 INSERT（无 updated_at）', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO alert_workflow_mappings');
        expect(sql).not.toContain('updated_at');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      alertRepository.workflowMappings.create({
        id: 'm1', alert_source: 'zabbix', workflow_id: 'wf1', enabled: 1
      });
      expect(runSpy).toHaveBeenCalledWith('m1', 'zabbix', null, null, 'wf1', 1);
    });

    it('update 动态 SET（无 updated_at）', () => {
      const runSpy = vi.fn(() => ({ changes: 1 }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('enabled = ?');
        expect(sql).not.toContain('updated_at');
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      const result = alertRepository.workflowMappings.update('m1', { enabled: 0 });
      expect(runSpy).toHaveBeenCalledWith(0, 'm1');
      expect(result).toBe(1);
    });

    it('delete 返回 changes', () => {
      mockDb.prepare = vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn() }));
      expect(alertRepository.workflowMappings.delete('m1')).toBe(1);
    });

    it('findMatching 按 source 排序', () => {
      const allSpy = vi.fn(() => [{ id: 'm1', alert_source: 'zabbix' }]);
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('enabled = 1');
        expect(sql).toContain('ORDER BY');
        return { run: vi.fn(), get: vi.fn(), all: allSpy };
      });

      alertRepository.workflowMappings.findMatching('zabbix');
      expect(allSpy).toHaveBeenCalledWith('zabbix');
    });
  });

  // ── DI 可替换性 ──

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getById: vi.fn(() => ({ id: 'mocked' })) };
      container.replace('alertRepository', mockRepo);

      const result = container.get<typeof mockRepo>('alertRepository');
      expect(result).toBe(mockRepo);
      expect(result.getById('any').id).toBe('mocked');
    });
  });
});
