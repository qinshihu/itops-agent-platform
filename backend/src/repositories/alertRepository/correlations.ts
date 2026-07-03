// ── correlations 子 repository ──

import db from '../../models/database';
import type {
  AlertCorrelationGroupCreateInput,
  AlertCorrelationGroupListFilters,
  AlertCorrelationGroupRecord,
  AlertCorrelationMemberInput,
} from './types';

export const correlationsRepo = {
  /**
   * 列出关联分组（支持 status 过滤 + 分页，含 member_count 子查询）
   * 对应：alertCorrelationService.getGroups
   */
  listGroups(filters: AlertCorrelationGroupListFilters = {}): AlertCorrelationGroupRecord[] {
    const params: unknown[] = [];
    let sql = `
      SELECT g.*, (SELECT COUNT(*) FROM alert_correlation_members WHERE group_id = g.id) as member_count
      FROM alert_correlation_groups g WHERE 1=1
    `;
    if (filters.status !== undefined) {
      sql += ' AND g.status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50, filters.offset || 0);
    return db.prepare(sql).all(...params) as AlertCorrelationGroupRecord[];
  },

  /**
   * 列出关联分组总数（与 listGroups 使用相同过滤）
   * 对应：alertCorrelationService.getGroups 的 COUNT
   */
  countGroups(filters: AlertCorrelationGroupListFilters = {}): number {
    const params: unknown[] = [];
    let sql = 'SELECT COUNT(*) as total FROM alert_correlation_groups g WHERE 1=1';
    if (filters.status !== undefined) {
      sql += ' AND g.status = ?';
      params.push(filters.status);
    }
    return (db.prepare(sql).get(...params) as { total: number }).total;
  },

  /**
   * 查询分组详情（含成员列表 JOIN alerts）
   * 对应：alertCorrelationService.getGroupDetail
   */
  getGroupDetail(groupId: string): { group: AlertCorrelationGroupRecord | undefined; members: Array<Record<string, unknown>> } {
    const group = db.prepare('SELECT * FROM alert_correlation_groups WHERE id = ?').get(groupId) as AlertCorrelationGroupRecord | undefined;
    const members = db.prepare(`
      SELECT acm.*, a.title, a.content, a.severity, a.source, a.status, a.created_at as alert_created_at
      FROM alert_correlation_members acm
      LEFT JOIN alerts a ON acm.alert_id = a.id
      WHERE acm.group_id = ?
      ORDER BY acm.is_root DESC, a.created_at ASC
    `).all(groupId) as Array<Record<string, unknown>>;
    return { group, members };
  },

  /**
   * 按 alertId 查询其所属关联分组
   * 对应：alertCorrelationService.getAlertGroup
   */
  getAlertGroup(alertId: string): AlertCorrelationGroupRecord | undefined {
    return db.prepare(`
      SELECT g.* FROM alert_correlation_groups g
      JOIN alert_correlation_members m ON g.id = m.group_id
      WHERE m.alert_id = ?
    `).get(alertId) as AlertCorrelationGroupRecord | undefined;
  },

  /**
   * 列出所有 open 状态的分组（自动关联用）
   * 对应：alertCorrelationService.autoCorrelate
   */
  listOpenGroups(): AlertCorrelationGroupRecord[] {
    return db.prepare(`
      SELECT * FROM alert_correlation_groups WHERE status = 'open' ORDER BY created_at DESC
    `).all() as AlertCorrelationGroupRecord[];
  },

  /**
   * 列出未分组的高级别告警（含 device_id，用于自动关联）
   * 对应：alertCorrelationService.autoCorrelate
   */
  listUngroupedAlertsForCorrelation(): Array<{
    id: string;
    title: string;
    content: string;
    severity: string;
    source: string;
    status: string;
    created_at: string;
    device_id: string;
  }> {
    return db.prepare(`
      SELECT a.id, a.title, a.content, a.severity, a.source, a.status, a.created_at,
             COALESCE(ada.device_id, '') as device_id
      FROM alerts a
      LEFT JOIN alert_device_associations ada ON a.id = ada.alert_id
      WHERE a.status IN ('new', 'acknowledged')
        AND a.severity IN ('critical', 'high', 'medium')
        AND a.id NOT IN (
          SELECT alert_id FROM alert_correlation_members
        )
      ORDER BY a.created_at DESC
      LIMIT 50
    `).all() as Array<{
      id: string; title: string; content: string; severity: string;
      source: string; status: string; created_at: string; device_id: string;
    }>;
  },

  /**
   * 列出分组成员（JOIN alerts 获取标题/严重级别/时间/内容/来源/设备，用于匹配计算）
   * 对应：alertCorrelationService.matchAlertToGroup
   * 注意：a.created_at 覆盖 acm.created_at（与原 SQL 行为一致）
   */
  listMembersWithAlert(groupId: string): Array<{
    id: string;
    group_id: string;
    alert_id: string;
    is_root: number;
    created_at: string;
    title: string;
    severity: string;
    content: string;
    source: string;
    device_id: string;
  }> {
    return db.prepare(`
      SELECT acm.*, a.title, a.severity, a.created_at, a.content, a.source,
             COALESCE(ada.device_id, '') as device_id
      FROM alert_correlation_members acm
      LEFT JOIN alerts a ON acm.alert_id = a.id
      LEFT JOIN alert_device_associations ada ON a.id = ada.alert_id
      WHERE acm.group_id = ?
    `).all(groupId) as Array<{
      id: string; group_id: string; alert_id: string; is_root: number;
      created_at: string; title: string; severity: string;
      content: string; source: string; device_id: string;
    }>;
  },

  /**
   * 创建关联分组
   * 对应：alertCorrelationService.createGroup / createManualGroup
   */
  createGroup(input: AlertCorrelationGroupCreateInput): void {
    db.prepare(`
      INSERT INTO alert_correlation_groups (id, title, status, root_alert_id, alert_count, device_ids, severity, auto_detected, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.title, input.status, input.root_alert_id, input.alert_count, input.device_ids, input.severity, input.auto_detected, input.created_at, input.updated_at);
  },

  /**
   * 添加成员到分组（INSERT OR IGNORE）
   * 对应：alertCorrelationService.addToGroup
   */
  addMember(input: AlertCorrelationMemberInput): void {
    db.prepare(`
      INSERT OR IGNORE INTO alert_correlation_members (id, group_id, alert_id, is_root, created_at)
      VALUES (?, ?, ?, ?, datetime('now','localtime'))
    `).run(input.id, input.group_id, input.alert_id, input.is_root);
  },

  /**
   * 更新分组的 alert_count（基于成员表实际计数）
   * 对应：alertCorrelationService.addToGroup 的 count 更新
   */
  refreshGroupCount(groupId: string): void {
    db.prepare(`
      UPDATE alert_correlation_groups
      SET alert_count = (SELECT COUNT(*) FROM alert_correlation_members WHERE group_id = ?), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(groupId, groupId);
  },

  /**
   * 查询分组中是否已包含指定告警
   * 对应：alertCorrelationService.addAlertToGroup
   */
  getMember(groupId: string, alertId: string): { id: string } | undefined {
    return db.prepare('SELECT id FROM alert_correlation_members WHERE group_id = ? AND alert_id = ?').get(groupId, alertId) as { id: string } | undefined;
  },

  /**
   * 统计分组成员数
   * 对应：alertCorrelationService.removeAlertFromGroup
   */
  countMembers(groupId: string): number {
    return (db.prepare('SELECT COUNT(*) as count FROM alert_correlation_members WHERE group_id = ?').get(groupId) as { count: number }).count;
  },

  /**
   * 从分组移除告警成员
   * 对应：alertCorrelationService.removeAlertFromGroup
   */
  removeMember(groupId: string, alertId: string): void {
    db.prepare('DELETE FROM alert_correlation_members WHERE group_id = ? AND alert_id = ?').run(groupId, alertId);
  },

  /**
   * 更新分组成员计数（移除成员后）
   * 对应：alertCorrelationService.removeAlertFromGroup 的 count 更新
   */
  setGroupCount(groupId: string, count: number): void {
    db.prepare(`UPDATE alert_correlation_groups SET alert_count = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(count, groupId);
  },

  /**
   * 解决关联分组
   * 对应：alertCorrelationService.resolveGroup
   */
  resolveGroup(groupId: string, rootCause?: string | null): void {
    db.prepare(`
      UPDATE alert_correlation_groups
      SET status = 'resolved', root_cause = ?, resolved_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(rootCause || null, groupId);
  },

  /**
   * 删除关联分组（同时删成员）
   * 对应：alertCorrelationService.deleteGroup
   */
  deleteGroup(groupId: string): void {
    db.prepare('DELETE FROM alert_correlation_members WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM alert_correlation_groups WHERE id = ?').run(groupId);
  },

  /**
   * 关联统计信息
   * 对应：alertCorrelationService.getStats
   */
  getStats(): { total: number; open: number; resolved: number; avgAlertCount: number; autoDetected: number } {
    const total = (db.prepare('SELECT COUNT(*) as count FROM alert_correlation_groups').get() as { count: number }).count;
    const open = (db.prepare("SELECT COUNT(*) as count FROM alert_correlation_groups WHERE status = 'open'").get() as { count: number }).count;
    const resolved = (db.prepare("SELECT COUNT(*) as count FROM alert_correlation_groups WHERE status = 'resolved'").get() as { count: number }).count;
    const avg = (db.prepare('SELECT AVG(alert_count) as avg FROM alert_correlation_groups').get() as { avg: number | null }).avg || 0;
    const autoDetected = (db.prepare('SELECT COUNT(*) as count FROM alert_correlation_groups WHERE auto_detected = 1').get() as { count: number }).count;
    return { total, open, resolved, avgAlertCount: avg, autoDetected };
  },
};