import { logger } from '../../../utils/logger';
import { env } from '../../../utils/env';
import { alertConfigsRepo } from '../../../repositories';
import { credentialService } from '../../auth/services/credentialService';

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
  metadata?: unknown;
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
        const existing = alertConfigsRepo.getIdByName(alert.name);
        if (!existing) {
          const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          alertConfigsRepo.create({
            id,
            name: alert.name,
            level: alert.level,
            enabled: Number(alert.enabled),
            channels: JSON.stringify(alert.channels),
            rate_limit_minutes: alert.rateLimitMinutes,
          });
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
      const rows = alertConfigsRepo.list();

      return rows.map(row => {
        // Try to get webhook URL from credential service if not set in row
        let webhookUrl = row.webhook_url ?? undefined;
        if (!webhookUrl) {
          const credWebhook = credentialService.getCredential('alert_webhook');
          if (credWebhook) {
            webhookUrl = credWebhook;
          }
        }

        // Try to get email recipients from credential service if not set in row
        let emailRecipients = row.email_recipients ? JSON.parse(row.email_recipients) : undefined;
        if (!emailRecipients || emailRecipients.length === 0) {
          const emailCredStr = credentialService.getCredential('alert_email');
          if (emailCredStr) {
            try {
              const emailCred = JSON.parse(emailCredStr);
              if (emailCred.to) {
                emailRecipients = emailCred.to.split(',').map((s: string) => s.trim());
              }
            } catch {
              // Not JSON, use as plain string
              emailRecipients = [emailCredStr];
            }
          }
        }

        return {
          id: row.id,
          name: row.name,
          level: row.level as AlertLevel,
          enabled: Boolean(row.enabled),
          channels: JSON.parse(row.channels || '[]'),
          webhookUrl,
          emailRecipients,
          rateLimitMinutes: row.rate_limit_minutes
        };
      });
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

      // If webhook URL is provided, store it in credential service (encrypted)
      if (updates.webhookUrl) {
        credentialService.setCredential('alert_webhook', updates.webhookUrl);
      }

      // If email recipients are provided, store them in credential service (encrypted)
      if (updates.emailRecipients && updates.emailRecipients.length > 0) {
        const existingEmailCredStr = credentialService.getCredential('alert_email');
        let emailConfig: { host?: string; user?: string; pass?: string; to?: string } = {};
        if (existingEmailCredStr) {
          try {
            emailConfig = JSON.parse(existingEmailCredStr);
          } catch {
            // ignore
          }
        }
        emailConfig.to = updates.emailRecipients.join(',');
        credentialService.setCredential('alert_email', JSON.stringify(emailConfig));
      }

      alertConfigsRepo.update(id, {
        enabled: Number(updated.enabled),
        channels: JSON.stringify(updated.channels),
        webhook_url: updated.webhookUrl || null,
        email_recipients: updated.emailRecipients ? JSON.stringify(updated.emailRecipients) : null,
        rate_limit_minutes: updated.rateLimitMinutes,
      });

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
    metadata?: unknown
  ): Promise<AlertNotification | null> {
    try {
      const config = this.getConfigs().find(c => c.name === alertName);
      if (!config?.enabled) {
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

      case 'webhook': {
        // Use config.webhookUrl or fall back to credential service
        const webhookUrl = config.webhookUrl || credentialService.getCredential('alert_webhook');
        if (webhookUrl) {
          await this.sendWebhook(webhookUrl, notification);
        }
        break;
      }

      case 'email': {
        // Use config.emailRecipients or fall back to credential service
        let recipients = config.emailRecipients;
        if (!recipients || recipients.length === 0) {
          const emailCredStr = credentialService.getCredential('alert_email');
          if (emailCredStr) {
            try {
              const emailCred = JSON.parse(emailCredStr);
              if (emailCred.to) {
                recipients = emailCred.to.split(',').map((s: string) => s.trim());
              }
            } catch {
              recipients = [emailCredStr];
            }
          }
        }

        if (recipients && recipients.length > 0) {
          await this.sendEmail(recipients, notification);
        }
        break;
      }
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
    // Get SMTP credentials from credential service
    const emailCredStr = credentialService.getCredential('alert_email');
    let smtpHost = '';
    let smtpUser = '';
    let _smtpPass = '';

    if (emailCredStr) {
      try {
        const emailCred = JSON.parse(emailCredStr);
        smtpHost = emailCred.host || '';
        smtpUser = emailCred.user || '';
        _smtpPass = emailCred.pass || '';
      } catch {
        // Use env vars as fallback
        smtpHost = env.ALERT_EMAIL_HOST || '';
        smtpUser = env.ALERT_EMAIL_USER || '';
        _smtpPass = env.ALERT_EMAIL_PASS || '';
      }
    } else {
      // Fall back to environment variables
      smtpHost = env.ALERT_EMAIL_HOST || '';
      smtpUser = env.ALERT_EMAIL_USER || '';
      _smtpPass = env.ALERT_EMAIL_PASS || '';
    }

    if (smtpHost && smtpUser) {
      logger.info('Email notification prepared (SMTP credentials found)', {
        recipients,
        subject: `[${notification.level.toUpperCase()}] ${notification.title}`,
        smtpHost: smtpHost
      });
    } else {
      logger.info('Email notification prepared (SMTP not configured)', {
        recipients,
        subject: `[${notification.level.toUpperCase()}] ${notification.title}`,
        message: notification.message
      });
    }
  }

  private saveNotification(notification: AlertNotification): void {
    try {
      alertConfigsRepo.saveNotification({
        id: notification.id,
        config_id: notification.configId,
        level: notification.level,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata ? JSON.stringify(notification.metadata) : null,
        channels: JSON.stringify(notification.channels),
        status: notification.status,
        triggered_at: notification.triggeredAt,
      });
    } catch (error) {
      logger.error('Failed to save notification', error as Error);
    }
  }

  getNotifications(limit = 50): AlertNotification[] {
    try {
      const rows = alertConfigsRepo.listNotifications(limit);

      return rows.map(row => ({
        id: row.id,
        configId: row.config_id,
        level: row.level as AlertLevel,
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

  clearOldNotifications(olderThanDays = 30): number {
    try {
      const deleted = alertConfigsRepo.clearOldNotifications(olderThanDays);
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
