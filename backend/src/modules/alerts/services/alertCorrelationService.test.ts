/**
 * AlertCorrelationService 单元测试
 *
 * 验证：
 *   1. 相似告警关联（同源 + 相似标题 + 同设备 → 高分关联）
 *   2. 去重：关联告警被归入同一组
 *   3. 时间窗口：超出 30 分钟窗口的告警不被关联
 *   4. 不同来源的告警不被关联
 *   5. 基本 API 方法（getGroups / getGroupDetail / createManualGroup / resolveGroup / deleteGroup / getStats）
 *
 * 使用 vi.hoisted() 模式构建可控的 db mock。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.hoisted() 把 mock 状态与 db 对象定义在提升上下文中 ──
const { mockDb, state } = vi.hoisted(() => {
  // 可变 mock 状态，测试中修改这些值即可驱动不同分支
  const state = {
    ungroupedAlerts: [] as any[],
    existingGroups: [] as any[],
    membersByGroup: new Map<string, any[]>(),
    alertsById: new Map<string, any>(),
    groupsById: new Map<string, any>(),
    alertToGroup: new Map<string, any>(),
    groupsList: [] as any[],
    existingMember: null as any,
    insertCalls: [] as any[],
    runCalls: [] as any[],
    stats: {
      totalGroups: 0,
      openGroups: 0,
      resolvedGroups: 0,
      autoDetected: 0,
      avgSize: 0,
    },
  };

  const mockDb = {
    prepare: vi.fn((rawSql: string) => {
      // 标准化 SQL：将所有空白字符压缩为单个空格，便于 substring 匹配
      const sql = rawSql.replace(/\s+/g, ' ').trim();

      // ── get() 路由 ──
      const get = vi.fn((...args: any[]) => {
        if (sql.includes('SELECT name FROM network_devices')) return null;
        if (sql.includes('SELECT name FROM servers')) return null;
        if (sql.includes('SELECT COUNT(*) as count FROM alert_correlation_groups') && sql.includes('auto_detected')) {
          return { count: state.stats.autoDetected };
        }
        if (sql.includes("SELECT COUNT(*) as count FROM alert_correlation_groups WHERE status = 'open'")) {
          return { count: state.stats.openGroups };
        }
        if (sql.includes("SELECT COUNT(*) as count FROM alert_correlation_groups WHERE status = 'resolved'")) {
          return { count: state.stats.resolvedGroups };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM alert_correlation_groups')) {
          return { count: state.stats.totalGroups };
        }
        if (sql.includes('SELECT AVG(alert_count) as avg FROM alert_correlation_groups')) {
          return { avg: state.stats.avgSize };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM alert_correlation_members WHERE group_id = ?')) {
          return { count: state.membersByGroup.get(args[0])?.length ?? 0 };
        }
        if (sql.includes('SELECT id FROM alert_correlation_members WHERE group_id = ? AND alert_id = ?')) {
          return state.existingMember;
        }
        if (sql.includes('SELECT * FROM alert_correlation_groups WHERE id = ?')) {
          return state.groupsById.get(args[0]) ?? null;
        }
        if (sql.includes('SELECT * FROM alerts WHERE id = ?')) {
          return state.alertsById.get(args[0]) ?? null;
        }
        // JOIN 查询：getAlertGroup（告警所在组）
        if (sql.includes('SELECT g.* FROM alert_correlation_groups g JOIN alert_correlation_members m')) {
          return state.alertToGroup.get(args[0]) ?? null;
        }
        // count query used by getGroups (replacement of SELECT)
        if (sql.includes('SELECT COUNT(*) as total FROM')) {
          return { total: state.groupsList.length };
        }
        return null;
      });

      // ── all() 路由 ──
      const all = vi.fn((...args: any[]) => {
        if (sql.includes('FROM alerts a LEFT JOIN alert_device_associations')) {
          return state.ungroupedAlerts;
        }
        if (sql.includes('FROM alert_correlation_groups') && sql.includes('WHERE 1=1')) {
          return state.groupsList;
        }
        if (sql.includes('FROM alert_correlation_groups WHERE status')) {
          return state.existingGroups;
        }
        if (sql.includes('FROM alert_correlation_members acm')) {
          return state.membersByGroup.get(args[0]) ?? [];
        }
        if (sql.includes('SELECT * FROM alerts WHERE id IN')) {
          return Array.from(state.alertsById.values());
        }
        return [];
      });

      // ── run() 路由 ──
      const run = vi.fn((...args: any[]) => {
        state.runCalls.push({ sql, args });
        if (sql.includes('INSERT INTO alert_correlation_groups')) {
          state.insertCalls.push({ type: 'group', args });
        }
        if (sql.includes('INSERT OR IGNORE INTO alert_correlation_members')) {
          state.insertCalls.push({ type: 'member', args });
        }
        return {};
      });

      return { get, all, run };
    }),
  };

  return { mockDb, state };
});

vi.mock('../../../models/database', () => ({
  default: mockDb,
  db: mockDb,
  initializeDatabase: vi.fn(),
  setIOInstance: vi.fn(),
  getIOInstance: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

import { alertCorrelationService } from './alertCorrelationService';

// ── 测试辅助 ──

function resetState() {
  state.ungroupedAlerts.length = 0;
  state.existingGroups.length = 0;
  state.membersByGroup.clear();
  state.alertsById.clear();
  state.groupsById.clear();
  state.alertToGroup.clear();
  state.groupsList.length = 0;
  state.existingMember = null;
  state.insertCalls.length = 0;
  state.runCalls.length = 0;
  state.stats.totalGroups = 0;
  state.stats.openGroups = 0;
  state.stats.resolvedGroups = 0;
  state.stats.autoDetected = 0;
  state.stats.avgSize = 0;
}

function makeAlert(overrides: Partial<any> = {}): any {
  return {
    id: overrides.id || `alert-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title || 'Test alert',
    content: overrides.content || '',
    severity: overrides.severity || 'high',
    source: overrides.source || 'snmp',
    status: overrides.status || 'new',
    device_id: overrides.device_id || 'dev-1',
    created_at: overrides.created_at || '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

describe('AlertCorrelationService - autoCorrelate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it('相似告警（同源+同设备+相似标题）被关联分组', async () => {
    const t = '2026-01-01T10:00:00Z';
    state.ungroupedAlerts.push(
      makeAlert({
        id: 'a1', title: 'Interface down on port 1', content: 'link error',
        source: 'snmp', device_id: 'dev-1', severity: 'high', created_at: t,
      }),
      makeAlert({
        id: 'a2', title: 'Interface flapping on port 1', content: 'link down',
        source: 'snmp', device_id: 'dev-1', severity: 'high',
        created_at: '2026-01-01T10:03:00Z',
      })
    );
    // 无已有分组
    state.existingGroups = [];

    const grouped = await alertCorrelationService.autoCorrelate();

    expect(grouped).toBeGreaterThan(0);
    // 至少创建了一个组（INSERT INTO alert_correlation_groups）
    const groupInserts = state.insertCalls.filter(c => c.type === 'group');
    expect(groupInserts.length).toBeGreaterThanOrEqual(1);
    // 至少插入了成员（INSERT OR IGNORE INTO alert_correlation_members）
    const memberInserts = state.insertCalls.filter(c => c.type === 'member');
    expect(memberInserts.length).toBeGreaterThanOrEqual(2);
  });

  it('多条相似告警被去重归入同一组', async () => {
    const t = '2026-01-01T10:00:00Z';
    const alerts = [
      makeAlert({ id: 'd1', title: 'CPU usage error', source: 'snmp', device_id: 'dev-1', created_at: t }),
      makeAlert({ id: 'd2', title: 'CPU threshold error', source: 'snmp', device_id: 'dev-1', created_at: '2026-01-01T10:01:00Z' }),
      makeAlert({ id: 'd3', title: 'CPU alarm failure', source: 'snmp', device_id: 'dev-1', created_at: '2026-01-01T10:02:00Z' }),
    ];
    state.ungroupedAlerts.push(...alerts);
    state.existingGroups = [];

    const grouped = await alertCorrelationService.autoCorrelate();

    expect(grouped).toBeGreaterThan(0);
    // 验证至少有成员插入
    const memberInserts = state.insertCalls.filter(c => c.type === 'member');
    expect(memberInserts.length).toBeGreaterThanOrEqual(2);
  });

  it('超出 30 分钟时间窗口的告警不被关联', async () => {
    // 同设备、同源，但标题无关键词重叠，时间间隔 > 30 分钟
    // score = 5(device) + 0(time) + 0(keywords) + 1(source) + 1(severity) = 7 < 8
    state.ungroupedAlerts.push(
      makeAlert({
        id: 'w1', title: 'CPU high', content: '',
        source: 'snmp', device_id: 'dev-1', severity: 'high',
        created_at: '2026-01-01T10:00:00Z',
      }),
      makeAlert({
        id: 'w2', title: 'Memory low', content: '',
        source: 'snmp', device_id: 'dev-1', severity: 'high',
        created_at: '2026-01-01T10:40:00Z', // 40 分钟后，超出 30 分钟窗口
      })
    );
    state.existingGroups = [];

    const grouped = await alertCorrelationService.autoCorrelate();

    // 关联分数 = 5(device) + 0(time>30min) + 0(no common keywords) + 1(source) + 1(severity) = 7 < 8
    expect(grouped).toBe(0);
    const groupInserts = state.insertCalls.filter(c => c.type === 'group');
    expect(groupInserts).toHaveLength(0);
  });

  it('不同来源且不同设备的告警不被关联', async () => {
    // 不同设备、不同源、无关键词重叠
    // score = 0(device) + 3(time<30min) + 0(keywords) + 0(source) + 0(severity) = 3 < 8
    state.ungroupedAlerts.push(
      makeAlert({
        id: 's1', title: 'CPU high', content: '',
        source: 'snmp', device_id: 'dev-1', severity: 'high',
        created_at: '2026-01-01T10:00:00Z',
      }),
      makeAlert({
        id: 's2', title: 'Memory low', content: '',
        source: 'syslog', device_id: 'dev-2', severity: 'medium',
        created_at: '2026-01-01T10:05:00Z',
      })
    );
    state.existingGroups = [];

    const grouped = await alertCorrelationService.autoCorrelate();

    // score = 0(device) + 3(time) + 2(<5min) + 0(keywords) + 0(source) + 0(severity) = 5
    // 但 sameDevice=false 且 score>5 且有 device_id → 限分到 5 < 8
    expect(grouped).toBe(0);
    const groupInserts = state.insertCalls.filter(c => c.type === 'group');
    expect(groupInserts).toHaveLength(0);
  });

  it('无未分组告警时返回 0', async () => {
    state.ungroupedAlerts = [];
    const grouped = await alertCorrelationService.autoCorrelate();
    expect(grouped).toBe(0);
  });

  it('单条未分组告警（无 companion）不创建组', async () => {
    state.ungroupedAlerts.push(
      makeAlert({ id: 'single-1', title: '孤立告警', source: 'snmp', device_id: 'dev-1' })
    );
    state.existingGroups = [];

    const grouped = await alertCorrelationService.autoCorrelate();
    expect(grouped).toBe(0);
    const groupInserts = state.insertCalls.filter(c => c.type === 'group');
    expect(groupInserts).toHaveLength(0);
  });

  it('已有分组时相似告警被加入已有组而非新建', async () => {
    const existingGroup = {
      id: 'grp-1',
      title: 'Interface alert group',
      status: 'open',
      root_alert_id: 'root-1',
      alert_count: 1,
      device_ids: 'dev-1',
      severity: 'high',
      auto_detected: 1,
      created_at: '2026-01-01T09:50:00Z',
      updated_at: '2026-01-01T09:50:00Z',
    };
    state.existingGroups.push(existingGroup);
    // 已有组成员
    state.membersByGroup.set('grp-1', [
      makeAlert({
        id: 'root-1', title: 'Interface down on port 1', content: 'link error',
        source: 'snmp', device_id: 'dev-1', severity: 'high',
        created_at: '2026-01-01T09:55:00Z',
      }),
    ]);
    // 新告警与已有成员高度相似
    state.ungroupedAlerts.push(
      makeAlert({
        id: 'new-1', title: 'Interface flapping on port 1', content: 'link down',
        source: 'snmp', device_id: 'dev-1', severity: 'high',
        created_at: '2026-01-01T10:00:00Z',
      })
    );

    const grouped = await alertCorrelationService.autoCorrelate();

    // 匹配到已有组时不计入 grouped（仅新建组才计数）
    expect(grouped).toBe(0);
    // 不应创建新组
    const groupInserts = state.insertCalls.filter(c => c.type === 'group');
    expect(groupInserts).toHaveLength(0);
    // 应添加成员到已有组（INSERT OR IGNORE INTO alert_correlation_members）
    const memberInserts = state.insertCalls.filter(c => c.type === 'member');
    expect(memberInserts.length).toBeGreaterThanOrEqual(1);
    // 验证加入的是 grp-1
    expect(memberInserts[0].args[1]).toBe('grp-1');
  });
});

describe('AlertCorrelationService - getGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it('返回分页后的组列表与总数', () => {
    state.groupsList = [
      { id: 'g1', title: 'Group 1', alert_count: 3, member_count: 3 },
      { id: 'g2', title: 'Group 2', alert_count: 2, member_count: 2 },
    ];

    const result = alertCorrelationService.getGroups({ status: 'all', limit: 10, offset: 0 });

    expect(result.groups).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('按 status 过滤', () => {
    state.groupsList = [{ id: 'g1', title: 'Group 1', status: 'open' }];
    const result = alertCorrelationService.getGroups({ status: 'open', limit: 10, offset: 0 });
    expect(result.groups).toBeDefined();
  });

  it('无组时返回空数组与 total=0', () => {
    state.groupsList = [];
    const result = alertCorrelationService.getGroups({ status: 'all' });
    expect(result.groups).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('AlertCorrelationService - getGroupDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it('返回组详情与成员列表', () => {
    const group = { id: 'detail-1', title: 'Detail Group', status: 'open' };
    state.groupsById.set('detail-1', group);
    const members = [
      { id: 'm1', group_id: 'detail-1', alert_id: 'a1', alert_title: 'Alert 1', is_root: 1 },
      { id: 'm2', group_id: 'detail-1', alert_id: 'a2', alert_title: 'Alert 2', is_root: 0 },
    ];
    state.membersByGroup.set('detail-1', members);

    const result = alertCorrelationService.getGroupDetail('detail-1');

    expect(result).not.toBeNull();
    expect(result!.group.id).toBe('detail-1');
    expect(result!.members).toHaveLength(2);
  });

  it('组不存在时返回 null', () => {
    expect(alertCorrelationService.getGroupDetail('non-existent')).toBeNull();
  });
});

describe('AlertCorrelationService - createManualGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it('根据告警 ID 列表创建手动关联组', () => {
    const a1 = makeAlert({ id: 'manual-1', title: 'Manual 1', severity: 'high', device_id: 'dev-1' });
    const a2 = makeAlert({ id: 'manual-2', title: 'Manual 2', severity: 'critical', device_id: 'dev-2' });
    state.alertsById.set('manual-1', a1);
    state.alertsById.set('manual-2', a2);

    const group = alertCorrelationService.createManualGroup(['manual-1', 'manual-2'], '手动测试组');

    expect(group).toBeDefined();
    expect(group.title).toBe('手动测试组');
    expect(group.alert_count).toBe(2);
    expect(group.auto_detected).toBe(0);
    expect(group.status).toBe('open');
    // 验证插入被调用
    const groupInserts = state.insertCalls.filter(c => c.type === 'group');
    expect(groupInserts).toHaveLength(1);
    const memberInserts = state.insertCalls.filter(c => c.type === 'member');
    expect(memberInserts).toHaveLength(2);
  });

  it('无有效告警时抛出异常', () => {
    expect(() => alertCorrelationService.createManualGroup(['non-existent'])).toThrow();
  });

  it('未提供 title 时使用默认标题', () => {
    const a1 = makeAlert({ id: 'auto-title-1' });
    state.alertsById.set('auto-title-1', a1);

    const group = alertCorrelationService.createManualGroup(['auto-title-1']);

    expect(group.title).toContain('手动关联组');
  });

  it('severity 取最高级别', () => {
    const a1 = makeAlert({ id: 'sev-1', severity: 'low' });
    const a2 = makeAlert({ id: 'sev-2', severity: 'critical' });
    const a3 = makeAlert({ id: 'sev-3', severity: 'medium' });
    state.alertsById.set('sev-1', a1);
    state.alertsById.set('sev-2', a2);
    state.alertsById.set('sev-3', a3);

    const group = alertCorrelationService.createManualGroup(['sev-1', 'sev-2', 'sev-3']);
    expect(group.severity).toBe('critical');
  });
});

describe('AlertCorrelationService - addAlertToGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it('组不存在时抛出异常', () => {
    expect(() => alertCorrelationService.addAlertToGroup('no-group', 'no-alert')).toThrow('Group not found');
  });

  it('告警不存在时抛出异常', () => {
    state.groupsById.set('grp-ok', { id: 'grp-ok', title: 'Group' });
    expect(() => alertCorrelationService.addAlertToGroup('grp-ok', 'no-alert')).toThrow('Alert not found');
  });

  it('告警已在组中时抛出异常', () => {
    state.groupsById.set('grp-ok', { id: 'grp-ok', title: 'Group' });
    state.alertsById.set('alert-ok', makeAlert({ id: 'alert-ok' }));
    state.existingMember = { id: 'existing-member' };

    expect(() => alertCorrelationService.addAlertToGroup('grp-ok', 'alert-ok')).toThrow('already in group');
  });
});

describe('AlertCorrelationService - removeAlertFromGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it('移除后组成员数为 0 时自动删除组', () => {
    state.groupsById.set('rm-1', { id: 'rm-1', title: 'To Delete' });
    state.membersByGroup.set('rm-1', []); // COUNT(*) returns 0

    alertCorrelationService.removeAlertFromGroup('rm-1', 'alert-1');

    // 验证 DELETE group 被调用
    const deleteCalls = state.runCalls.filter(c => c.sql.includes('DELETE FROM alert_correlation_groups'));
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('移除后仍有成员时更新组计数', () => {
    // COUNT(*) returns 2
    state.membersByGroup.set('rm-2', [{ id: 'm1' }, { id: 'm2' }]);

    alertCorrelationService.removeAlertFromGroup('rm-2', 'alert-1');

    // 验证 UPDATE 被调用（而非 DELETE group）
    const updateCalls = state.runCalls.filter(c => c.sql.includes('UPDATE alert_correlation_groups'));
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    const deleteGroupCalls = state.runCalls.filter(c => c.sql.includes('DELETE FROM alert_correlation_groups'));
    expect(deleteGroupCalls).toHaveLength(0);
  });
});

describe('AlertCorrelationService - resolveGroup / deleteGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it('resolveGroup 更新组状态为 resolved', () => {
    alertCorrelationService.resolveGroup('grp-r', '根因分析完成');

    const updateCalls = state.runCalls.filter(c => c.sql.includes('UPDATE alert_correlation_groups') && c.sql.includes("status = 'resolved'"));
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].args[0]).toBe('根因分析完成');
    expect(updateCalls[0].args[1]).toBe('grp-r');
  });

  it('deleteGroup 删除组成员与组本身', () => {
    alertCorrelationService.deleteGroup('grp-del');

    const deleteMemberCalls = state.runCalls.filter(c => c.sql.includes('DELETE FROM alert_correlation_members'));
    const deleteGroupCalls = state.runCalls.filter(c => c.sql.includes('DELETE FROM alert_correlation_groups'));
    expect(deleteMemberCalls).toHaveLength(1);
    expect(deleteGroupCalls).toHaveLength(1);
    expect(deleteMemberCalls[0].args[0]).toBe('grp-del');
    expect(deleteGroupCalls[0].args[0]).toBe('grp-del');
  });
});

describe('AlertCorrelationService - getAlertGroup / getStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it('getAlertGroup 返回告警所在的关联组', () => {
    const group = { id: 'ag-1', title: 'Alert Group', status: 'open' };
    state.alertToGroup.set('alert-in-group', group);

    const result = alertCorrelationService.getAlertGroup('alert-in-group');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('ag-1');
    expect(result!.title).toBe('Alert Group');
  });

  it('getAlertGroup 在告警未关联时返回 null', () => {
    expect(alertCorrelationService.getAlertGroup('unrelated-alert')).toBeNull();
  });

  it('getStats 返回完整统计数据', () => {
    state.stats.totalGroups = 10;
    state.stats.openGroups = 5;
    state.stats.resolvedGroups = 5;
    state.stats.autoDetected = 7;
    state.stats.avgSize = 2.5;

    const stats = alertCorrelationService.getStats();

    expect(stats.total_groups).toBe(10);
    expect(stats.open_groups).toBe(5);
    expect(stats.resolved_groups).toBe(5);
    expect(stats.auto_detected).toBe(7);
    expect(stats.avg_group_size).toBe(2.5);
  });

  it('getStats 在无数据时返回零值', () => {
    const stats = alertCorrelationService.getStats();
    expect(stats.total_groups).toBe(0);
    expect(stats.open_groups).toBe(0);
    expect(stats.resolved_groups).toBe(0);
    expect(stats.avg_group_size).toBe(0);
  });
});
