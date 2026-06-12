/**
 * =============================================================================
 * ITOps Agent Platform - 告警关联聚合服务
 * =============================================================================
 * 将相关告警自动归为一组，支持：
 * 1. IP 关联：同一设备 IP 的告警
 * 2. 时间窗口关联：短时间内发生的关联告警
 * 3. 关键词关联：语义相关的告警（如接口 down + 链路错误）
 * 4. 根因聚合：从属告警归入根因告警
 * 5. 手动关联：用户手动将告警分组
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';

// ====================== 接口定义 ======================

export interface CorrelationGroup {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'resolved' | 'closed';
  root_alert_id?: string;
  root_cause?: string;
  alert_count: number;
  device_ids: string;
  severity: string;
  auto_detected: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface CorrelationMember {
  id: string;
  group_id: string;
  alert_id: string;
  alert_title?: string;
  alert_severity?: string;
  device_id?: string;
  device_name?: string;
  device_ip?: string;
  is_root: number;
  created_at: string;
}

// ====================== 关联规则 ======================

interface CorrelationRule {
  name: string;
  description: string;
  weight: number;             // 权重，越高越优先
  check: (alerts: any[]) => boolean;
}

// ====================== 服务实现 ======================

class AlertCorrelationService {
  private readonly TIME_WINDOW_MS = 30 * 60 * 1000;   // 30 分钟窗口
  private readonly MAX_GROUP_ALERTS = 20;              // 每组最多告警数
  private readonly MIN_CORRELATION_SCORE = 8;          // 最小关联得分（8=强关联: 同设备5+时间3, 或同源1+关键词4+时间3）
  private autoRunTimer: NodeJS.Timeout | null = null;

  /**
   * 启动自动关联定时器
   */
  start(): void {
    if (this.autoRunTimer) return;
    logger.info('🔗 Alert correlation service started');

    // 每分钟扫描一次新的未关联告警
    this.autoRunTimer = setInterval(() => {
      this.autoCorrelate().catch(err => {
        logger.error('Auto-correlation failed:', err);
      });
    }, 60 * 1000);

    // 启动时立即跑一次
    setImmediate(() => {
      this.autoCorrelate().catch(err => {
        logger.error('Initial auto-correlation failed:', err);
      });
    });
  }

  /**
   * 停止自动关联定时器
   */
  stop(): void {
    if (this.autoRunTimer) {
      clearInterval(this.autoRunTimer);
      this.autoRunTimer = null;
    }
  }

  /**
   * 自动关联未分组的警告
   */
  async autoCorrelate(): Promise<number> {
    try {
      // 获取未关联的高级别告警
      const ungroupedAlerts = db.prepare(`
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
      `).all() as any[];

      if (ungroupedAlerts.length === 0) return 0;

      let grouped = 0;
      const existingGroups = db.prepare(`
        SELECT * FROM alert_correlation_groups
        WHERE status = 'open'
        ORDER BY created_at DESC
      `).all() as CorrelationGroup[];

      for (const alert of ungroupedAlerts) {
        // 尝试匹配到已有组
        let matched = false;
        for (const group of existingGroups) {
          if (this.matchAlertToGroup(alert, group)) {
            this.addToGroup(group.id, alert);
            matched = true;
            break;
          }
        }

        if (!matched) {
          // 尝试找其他未分组的告警建立新组
          const companions = ungroupedAlerts.filter(a =>
            a.id !== alert.id &&
            this.calculateCorrelationScore(alert, a) >= this.MIN_CORRELATION_SCORE
          );

          if (companions.length >= 1) {
            // 创建新组
            const group = this.createGroup(alert, companions);
            grouped += 1 + companions.length;
          }
        }
      }

      if (grouped > 0) {
        logger.info(`🔗 Auto-correlation: ${grouped} alerts grouped`);
      }

      return grouped;
    } catch (err) {
      logger.error('Auto-correlation error:', err);
      return 0;
    }
  }

  /**
   * 计算两条告警的关联分数
   */
  private calculateCorrelationScore(a: any, b: any): number {
    let score = 0;
    let sameDevice = false;

    // 1. 同一设备（最高权重）
    if (a.device_id && b.device_id && a.device_id === b.device_id) {
      score += 5;
      sameDevice = true;
    }

    // 2. 时间窗口
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    const timeDiff = Math.abs(timeA - timeB);
    if (timeDiff < this.TIME_WINDOW_MS) {
      score += 3;
      if (timeDiff < 5 * 60 * 1000) score += 2;  // 5 分钟内 +2
    }

    // 3. 关键词关联
    const keywords = this.extractKeywords(a.title + ' ' + (a.content || ''));
    const companionKeywords = this.extractKeywords(b.title + ' ' + (b.content || ''));
    const commonKeywords = keywords.filter(k => companionKeywords.includes(k));
    score += commonKeywords.length * 2;

    // 4. 相同告警源
    if (a.source && b.source && a.source === b.source) {
      score += 1;
    }

    // 5. 相同严重级别
    if (a.severity === b.severity) {
      score += 1;
    }

    // 6. 非同一设备的关联分不能过高（防止关键词+时间跨设备误合并）
    //    只有当至少一个告警有明确的 device_id 时才限分
    //    两个 device_id 都为空时（均为 IP/文本发现的设备），不限分
    if (!sameDevice && score > 5 && (a.device_id || b.device_id)) {
      score = 5;
    }

    return score;
  }

  /**
   * 判断告警是否能匹配到已有组
   */
  private matchAlertToGroup(alert: any, group: CorrelationGroup): boolean {
    // 获取组成员
    const members = db.prepare(`
      SELECT acm.*, a.title, a.severity, a.created_at
      FROM alert_correlation_members acm
      LEFT JOIN alerts a ON acm.alert_id = a.id
      WHERE acm.group_id = ?
    `).all(group.id) as any[];

    if (members.length >= this.MAX_GROUP_ALERTS) return false;

    // 匹配到已有组需要足够分数（与创建新组阈值一致）
    const minScore = this.MIN_CORRELATION_SCORE;

    for (const member of members) {
      const score = this.calculateCorrelationScore(alert, member);
      if (score >= minScore) return true;
    }

    return false;
  }

  /**
   * 创建告警关联组
   */
  private createGroup(root: any, companions: any[]): CorrelationGroup {
    const groupId = randomUUID();
    const deviceIds = [root.device_id, ...companions.map(c => c.device_id)]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(',');

    // 以最高严重级别为准
    const severities = [root.severity, ...companions.map(c => c.severity)];
    const severityLevels: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const topSeverity = severities.reduce((a, b) =>
      (severityLevels[a] || 0) > (severityLevels[b] || 0) ? a : b
    );

    // 生成组标题
    const title = this.generateGroupTitle(root, companions);

    const group: CorrelationGroup = {
      id: groupId,
      title,
      status: 'open',
      root_alert_id: root.id,
      alert_count: 1 + companions.length,
      device_ids: deviceIds,
      severity: topSeverity,
      auto_detected: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO alert_correlation_groups (id, title, status, root_alert_id, alert_count, device_ids, severity, auto_detected, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(group.id, group.title, group.status, group.root_alert_id, group.alert_count, group.device_ids, group.severity, group.auto_detected, group.created_at, group.updated_at);

    // 添加组成员
    this.addToGroup(groupId, root, true);
    for (const companion of companions) {
      this.addToGroup(groupId, companion, false);
    }

    return group;
  }

  /**
   * 将告警添加到组
   */
  private addToGroup(groupId: string, alert: any, isRoot = false): void {
    try {
      const memberId = randomUUID();
      db.prepare(`
        INSERT OR IGNORE INTO alert_correlation_members (id, group_id, alert_id, is_root, created_at)
        VALUES (?, ?, ?, ?, datetime('now','localtime'))
      `).run(memberId, groupId, alert.id, isRoot ? 1 : 0);

      // 更新组的告警计数和时间
      db.prepare(`
        UPDATE alert_correlation_groups
        SET alert_count = (SELECT COUNT(*) FROM alert_correlation_members WHERE group_id = ?),
            updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(groupId, groupId);
    } catch (err) {
      // 可能已存在，忽略
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    if (!text) return [];
    const normalized = text.toLowerCase();

    const keywordMap: Record<string, string[]> = {
      'interface': ['interface', 'port', 'link', 'up', 'down', 'flapping'],
      'network': ['network', 'connectivity', 'reachability', 'route', 'routing', 'bgp', 'ospf'],
      'system': ['system', 'cpu', 'memory', 'disk', 'storage', 'temperature', 'fan'],
      'security': ['security', 'auth', 'login', 'access', 'permission', 'violation'],
      'error': ['error', 'fail', 'failure', 'timeout', 'exceed', 'threshold', 'alarm'],
      'power': ['power', 'supply', 'voltage', 'current'],
      'service': ['service', 'process', 'daemon', 'application', 'http', 'dns', 'dhcp'],
    };

    const found: Set<string> = new Set();
    for (const [, values] of Object.entries(keywordMap)) {
      for (const keyword of values) {
        if (normalized.includes(keyword)) {
          found.add(keyword);
        }
      }
    }
    return Array.from(found);
  }

  /**
   * 生成组标题
   */
  private generateGroupTitle(root: any, companions: any[]): string {
    const rootTitle = root.title || root.content || '未知告警';

    // 提取公共关键词
    const allTitles = [rootTitle, ...companions.map(c => c.title || c.content || '')];
    const commonKeywords = this.extractKeywords(allTitles.join(' '));

    if (companions.length === 1) {
      const companionTitle = companions[0].title || companions[0].content || '';
      return `${rootTitle} → ${companionTitle}`;
    }

    let deviceName = '';
    const rawDeviceId = root.device_id || (companions.find(c => c.device_id)?.device_id) || '';
    if (rawDeviceId) {
      // 取设备友号名称
      const nd = db.prepare('SELECT name FROM network_devices WHERE id = ?').get(rawDeviceId) as any;
      const sv = !nd ? db.prepare('SELECT name FROM servers WHERE id = ?').get(rawDeviceId) as any : null;
      deviceName = (nd || sv)?.name || rawDeviceId.slice(0, 12);
    }
    const deviceLabel = deviceName ? ` [${deviceName}]` : '';

    if (commonKeywords.length > 0) {
      return `关联告警组${deviceLabel}: ${commonKeywords.slice(0, 3).join(', ')} (${allTitles.length}条)`;
    }

    return `关联告警组${deviceLabel} (${allTitles.length}条)`;
  }

  // ====================== API 方法 ======================

  /**
   * 获取所有关联组
   */
  getGroups(options: { status?: string; limit?: number; offset?: number }): { groups: any[]; total: number } {
    let sql = `
      SELECT g.*,
        (SELECT COUNT(*) FROM alert_correlation_members WHERE group_id = g.id) as member_count
      FROM alert_correlation_groups g
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.status && options.status !== 'all') {
      sql += ' AND g.status = ?';
      params.push(options.status);
    }

    const countResult = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/,.*?member_count/, '')).get(...params) as any;
    const total = countResult?.total || 0;

    sql += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);

    const groups = db.prepare(sql).all(...params) as any[];
    return { groups, total };
  }

  /**
   * 获取单个组详情（含成员）
   */
  getGroupDetail(groupId: string): { group: any; members: any[] } | null {
    const group = db.prepare('SELECT * FROM alert_correlation_groups WHERE id = ?').get(groupId) as any;
    if (!group) return null;

    const members = db.prepare(`
      SELECT acm.*, a.title, a.content, a.severity, a.source, a.status, a.created_at as alert_created_at
      FROM alert_correlation_members acm
      LEFT JOIN alerts a ON acm.alert_id = a.id
      WHERE acm.group_id = ?
      ORDER BY acm.is_root DESC, a.created_at ASC
    `).all(groupId) as any[];

    return { group, members };
  }

  /**
   * 手动创建关联组
   */
  createManualGroup(alertIds: string[], title?: string): CorrelationGroup {
    const groupId = randomUUID();
    const alerts = db.prepare(
      `SELECT * FROM alerts WHERE id IN (${alertIds.map(() => '?').join(',')})`
    ).all(...alertIds) as any[];

    if (alerts.length === 0) throw new Error('No valid alerts found');

    const severities = alerts.map(a => a.severity);
    const severityLevels: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const topSeverity = severities.reduce((a, b) =>
      (severityLevels[a] || 0) > (severityLevels[b] || 0) ? a : b
    );

    const deviceIds = alerts.map(a => a.device_id || '').filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(',');

    const group: CorrelationGroup = {
      id: groupId,
      title: title || `手动关联组 (${alerts.length}条告警)`,
      status: 'open',
      root_alert_id: alerts[0]?.id,
      alert_count: alerts.length,
      device_ids: deviceIds,
      severity: topSeverity,
      auto_detected: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO alert_correlation_groups (id, title, status, root_alert_id, alert_count, device_ids, severity, auto_detected, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(group.id, group.title, group.status, group.root_alert_id, group.alert_count, group.device_ids, group.severity, group.auto_detected, group.created_at, group.updated_at);

    alerts.forEach((alert, idx) => {
      this.addToGroup(groupId, alert, idx === 0);
    });

    return group;
  }

  /**
   * 将告警手动加入已有组
   */
  addAlertToGroup(groupId: string, alertId: string): void {
    const group = db.prepare('SELECT * FROM alert_correlation_groups WHERE id = ?').get(groupId) as any;
    if (!group) throw new Error('Group not found');

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;
    if (!alert) throw new Error('Alert not found');

    const member = db.prepare('SELECT id FROM alert_correlation_members WHERE group_id = ? AND alert_id = ?').get(groupId, alertId) as any;
    if (member) throw new Error('Alert already in group');

    this.addToGroup(groupId, alert, false);
  }

  /**
   * 从组中移除告警
   */
  removeAlertFromGroup(groupId: string, alertId: string): void {
    db.prepare('DELETE FROM alert_correlation_members WHERE group_id = ? AND alert_id = ?').run(groupId, alertId);
    const remaining = db.prepare('SELECT COUNT(*) as count FROM alert_correlation_members WHERE group_id = ?').get(groupId) as any;
    if (remaining?.count === 0) {
      db.prepare('DELETE FROM alert_correlation_groups WHERE id = ?').run(groupId);
    } else {
      db.prepare(`
        UPDATE alert_correlation_groups
        SET alert_count = ?, updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(remaining.count, groupId);
    }
  }

  /**
   * 解决/关闭关联组
   */
  resolveGroup(groupId: string, rootCause?: string): void {
    db.prepare(`
      UPDATE alert_correlation_groups
      SET status = 'resolved', root_cause = ?, resolved_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(rootCause || null, groupId);
  }

  /**
   * 删除关联组
   */
  deleteGroup(groupId: string): void {
    db.prepare('DELETE FROM alert_correlation_members WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM alert_correlation_groups WHERE id = ?').run(groupId);
  }

  /**
   * 获取告警所在的关联组
   */
  getAlertGroup(alertId: string): CorrelationGroup | null {
    const member = db.prepare(`
      SELECT g.* FROM alert_correlation_groups g
      JOIN alert_correlation_members m ON g.id = m.group_id
      WHERE m.alert_id = ?
    `).get(alertId) as any;
    return member || null;
  }

  /**
   * 获取关联统计
   */
  getStats(): any {
    const total = db.prepare('SELECT COUNT(*) as count FROM alert_correlation_groups').get() as any;
    const open = db.prepare("SELECT COUNT(*) as count FROM alert_correlation_groups WHERE status = 'open'").get() as any;
    const resolved = db.prepare("SELECT COUNT(*) as count FROM alert_correlation_groups WHERE status = 'resolved'").get() as any;
    const avgSize = db.prepare('SELECT AVG(alert_count) as avg FROM alert_correlation_groups').get() as any;
    const auto = db.prepare('SELECT COUNT(*) as count FROM alert_correlation_groups WHERE auto_detected = 1').get() as any;

    return {
      total_groups: total?.count || 0,
      open_groups: open?.count || 0,
      resolved_groups: resolved?.count || 0,
      avg_group_size: Math.round((avgSize?.avg || 0) * 10) / 10,
      auto_detected: auto?.count || 0,
    };
  }
}

export const alertCorrelationService = new AlertCorrelationService();
