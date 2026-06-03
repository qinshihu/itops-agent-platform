import db from '../models/database';
import { logger } from '../utils/logger';

export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertChannel = 'email' | 'webhook' | 'database';

export interface AlertConfig {
  id: string;
  name: string;
  level: AlertLevel;
  enabled: boolean;
  channels: AlertChannel[];
  webhookUrl?: string;
  emailRecipients?: string[];
  rateLimitMinutes: number;
}

export interface AlertNotification {
  id: string;
  configId: string;
  level: AlertLevel;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  triggeredAt: string;
  channels: AlertChannel[];
  status: 'sent' | 'failed' | 'pending';
}

const DEFAULT_ALERTS: Array<Omit<AlertConfig, 'id'>> = [
  {
    name: '系统健康状态异常',
    level: 'critical',
    enabled: true,
    channels: ['database'],
    rateLimitMinutes: 30
  },
  {
    name: '备份失败告警',
    level: 'critical',
    enabled: true,
    channels: ['database'],
    rateLimitMinutes: 60
  },
  {
    name: '高内存使用率',
    level: 'warning',
    enabled: true,
    channels: ['database'],
    rateLimitMinutes: 15
  },
  {
    name: '高CPU使用率',
    level: 'warning',
    enabled: true,
    channels: ['database'],
    rateLimitMinutes: 15
  },
  {
    name: 'SSH连接失败',
    level: 'warning',
    enabled: true,
    channels: ['database'],
    rateLimitMinutes: 10
  },
  {
    name: '任务执行失败',
    level: 'warning',
    enabled: true,
    channels: ['database'],
    rateLimitMinutes: 5
  }
];

export class AlertNotificationService {
  private lastTriggered = new Map<string, number>();
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      for (const alert of DEFAULT_ALERTS) {
        const existing = db.prepare('SELECT id FROM alert_configs WHERE name = ?').get(alert.name);
        if (!existing) {
          const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          db.prepare(`
            INSERT INTO alert_configs (id, name, level, enabled, channels, rate_limit_minutes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(id, alert.name, alert.level, Number(alert.enabled), JSON.stringify(alert.channels), alert.rateLimitMinutes);
        }
      }
      this.isInitialized = true;
      logger.info('Alert notification service initialized');
    } catch (error) {
      logger.error('Failed to initialize alert notification service', error as Error);
    }
  }

  getConfigs(): AlertConfig[] {
    try {
      const rows = db.prepare('SELECT * FROM alert_configs ORDER BY created_at DESC').all() as Array<{
        id: string;
        name: string;
        level: AlertLevel;
        enabled: number;
        channels: string;
        webhook_url?: string;
        email_recipients?: string;
        rate_limit_minutes: number;
      }>;

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        level: row.level,
        enabled: Boolean(row.enabled),
        channels: JSON.parse(row.channels || '[]'),
        webhookUrl: row.webhook_url,
        emailRecipients: row.email_recipients ? JSON.parse(row.email_recipients) : undefined,
        rateLimitMinutes: row.rate_limit_minutes
      }));
    } catch (error) {
      logger.error('Failed to get alert configs', error as Error);
      return [];
    }
  }

  updateConfig(id: string, updates: Partial<AlertConfig>): AlertConfig | null {
    try {
      const config = this.getConfigs().find(c => c.id === id);
      if (!config) return null;

      const updated = { ...config, ...updates };
      
      db.prepare(`
        UPDATE alert_configs
        SET enabled = ?, channels = ?, webhook_url = ?, email_recipients = ?, rate_limit_minutes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        Number(updated.enabled),
        JSON.stringify(updated.channels),
        updated.webhookUrl || null,
        updated.emailRecipients ? JSON.stringify(updated.emailRecipients) : null,
        updated.rateLimitMinutes,
        id
      );

      logger.info('Alert config updated', { id, name: updated.name });
      return updated;
    } catch (error) {
      logger.error('Failed to update alert config', error as Error);
      return null;
    }
  }

  async trigger(
    alertName: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<AlertNotification | null> {
    try {
      const config = this.getConfigs().find(c => c.name === alertName);
      if (!config || !config.enabled) {
        return null;
      }

      const lastTriggered = this.lastTriggered.get(config.id) || 0;
      const rateLimitMs = config.rateLimitMinutes * 60 * 1000;
      
      if (Date.now() - lastTriggered < rateLimitMs) {
        logger.debug('Alert rate limited', { alertName });
        return null;
      }

      this.lastTriggered.set(config.id, Date.now());

      const notification: AlertNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        configId: config.id,
        level: config.level,
        title,
        message,
        metadata,
        triggeredAt: new Date().toISOString(),
        channels: config.channels,
        status: 'pending'
      };

      for (const channel of config.channels) {
        try {
          await this.sendToChannel(channel, notification, config);
        } catch (channelError) {
          logger.error(`Failed to send alert to ${channel}`, channelError as Error);
        }
      }

      notification.status = 'sent';
      this.saveNotification(notification);

      logger.warn(`Alert triggered: ${title}`, {
        level: config.level,
        alertName,
        message
      });

      return notification;
    } catch (error) {
      logger.error('Failed to trigger alert', error as Error);
      return null;
    }
  }

  private async sendToChannel(
    channel: AlertChannel,
    notification: AlertNotification,
    config: AlertConfig
  ): Promise<void> {
    switch (channel) {
      case 'database':
        this.saveNotification(notification);
        break;

      case 'webhook':
        if (config.webhookUrl) {
          await this.sendWebhook(config.webhookUrl, notification);
        }
        break;

      case 'email':
        if (config.emailRecipients && config.emailRecipients.length > 0) {
          await this.sendEmail(config.emailRecipients, notification);
        }
        break;
    }
  }

  private async sendWebhook(webhookUrl: string, notification: AlertNotification): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: notification.triggeredAt,
          level: notification.level,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
      logger.debug('Webhook alert sent successfully');
    } catch (error) {
      logger.error('Failed to send webhook alert', error as Error);
      throw error;
    }
  }

  private async sendEmail(recipients: string[], notification: AlertNotification): Promise<void> {
    logger.info('Email notification prepared (SMTP not configured)', {
      recipients,
      subject: `[${notification.level.toUpperCase()}] ${notification.title}`,
      message: notification.message
    });
  }

  private saveNotification(notification: AlertNotification): void {
    try {
      db.prepare(`
        INSERT INTO alert_notifications (id, config_id, level, title, message, metadata, channels, status, triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        notification.id,
        notification.configId,
        notification.level,
        notification.title,
        notification.message,
        notification.metadata ? JSON.stringify(notification.metadata) : null,
        JSON.stringify(notification.channels),
        notification.status,
        notification.triggeredAt
      );
    } catch (error) {
      logger.error('Failed to save notification', error as Error);
    }
  }

  getNotifications(limit: number = 50): AlertNotification[] {
    try {
      const rows = db.prepare(`
        SELECT * FROM alert_notifications
        ORDER BY triggered_at DESC
        LIMIT ?
      `).all(limit) as Array<{
        id: string;
        config_id: string;
        level: AlertLevel;
        title: string;
        message: string;
        metadata?: string;
        channels: string;
        status: string;
        triggered_at: string;
      }>;

      return rows.map(row => ({
        id: row.id,
        configId: row.config_id,
        level: row.level,
        title: row.title,
        message: row.message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        channels: JSON.parse(row.channels),
        status: row.status as 'sent' | 'failed' | 'pending',
        triggeredAt: row.triggered_at
      }));
    } catch (error) {
      logger.error('Failed to get notifications', error as Error);
      return [];
    }
  }

  clearOldNotifications(olderThanDays: number = 30): number {
    try {
      const result = db.prepare(`
        DELETE FROM alert_notifications
        WHERE triggered_at < datetime('now', '-' || ? || ' days')
      `).run(olderThanDays);
      
      const deleted = Number(result.changes || 0);
      if (deleted > 0) {
        logger.info(`Cleared ${deleted} old notifications`);
      }
      return deleted;
    } catch (error) {
      logger.error('Failed to clear old notifications', error as Error);
      return 0;
    }
  }
}

export const alertNotificationService = new AlertNotificationService();
