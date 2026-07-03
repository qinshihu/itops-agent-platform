// ── alertConfigs 子 repository ──
// 覆盖 alert_configs + alert_notifications 两张表

import db from '../../models/database';
import type {
  AlertConfigCreateInput,
  AlertConfigRecord,
  AlertConfigUpdateInput,
  AlertNotificationInsertInput,
  AlertNotificationRecord,
} from './types';

export const alertConfigsRepo = {
  // ── alert_configs 表 ──

  /**
   * 按名称查询配置 ID（初始化去重用）
   * 对应：alertNotificationService.init
   */
  getIdByName(name: string): { id: string } | undefined {
    return db.prepare('SELECT id FROM alert_configs WHERE name = ?').get(name) as { id: string } | undefined;
  },

  /**
   * 创建告警配置
   * 对应：alertNotificationService.init
   */
  create(input: AlertConfigCreateInput): void {
    db.prepare(`
      INSERT INTO alert_configs (id, name, level, enabled, channels, rate_limit_minutes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(input.id, input.name, input.level, input.enabled, input.channels, input.rate_limit_minutes);
  },

  /**
   * 列出全部告警配置（按创建时间倒序）
   * 对应：alertNotificationService.getConfigs
   */
  list(): AlertConfigRecord[] {
    return db.prepare('SELECT * FROM alert_configs ORDER BY created_at DESC').all() as AlertConfigRecord[];
  },

  /**
   * 更新告警配置
   * 对应：alertNotificationService.updateConfig
   */
  update(id: string, input: AlertConfigUpdateInput): void {
    db.prepare(`
      UPDATE alert_configs
      SET enabled = ?, channels = ?, webhook_url = ?, email_recipients = ?, rate_limit_minutes = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(input.enabled, input.channels, input.webhook_url, input.email_recipients, input.rate_limit_minutes, id);
  },

  // ── alert_notifications 表 ──

  /**
   * 保存通知记录（INSERT）
   * 对应：alertNotificationService.saveNotification
   */
  saveNotification(input: AlertNotificationInsertInput): void {
    db.prepare(`
      INSERT INTO alert_notifications (id, config_id, level, title, message, metadata, channels, status, triggered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.config_id, input.level, input.title, input.message, input.metadata, input.channels, input.status, input.triggered_at);
  },

  /**
   * 列出通知记录（按触发时间倒序，LIMIT）
   * 对应：alertNotificationService.getNotifications
   */
  listNotifications(limit = 50): AlertNotificationRecord[] {
    return db.prepare(`
      SELECT * FROM alert_notifications
      ORDER BY triggered_at DESC
      LIMIT ?
    `).all(limit) as AlertNotificationRecord[];
  },

  /**
   * 清理旧通知记录（按天数）
   * 对应：alertNotificationService.clearOldNotifications
   */
  clearOldNotifications(olderThanDays = 30): number {
    return db.prepare(`
      DELETE FROM alert_notifications
      WHERE triggered_at < datetime('now', '-' || ? || ' days')
    `).run(olderThanDays).changes;
  },
};
