import { settingsRepository, infraRepository } from '../../../repositories';
import { getIOInstance } from '../../../shared/websocket/io';
import { logger } from '../../../utils/logger';
import axios from 'axios';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { credentialService } from '../../auth/services/credentialService';

interface NotificationConfig {
  wechat_enabled?: boolean;
  wechat_config?: { webhook_url?: string };
  dingtalk_enabled?: boolean;
  dingtalk_config?: { webhook_url?: string };
  email_enabled?: boolean;
  email_config?: { smtp_host?: string; smtp_port?: number; user?: string; password?: string };
  webhook_enabled?: boolean;
}

interface AlertRecord {
  id: string;
  severity: string;
  title: string;
  content: string;
  source: string;
}

interface TaskRecord {
  id: string;
  name: string;
  workflow_id: string | null;
}

class NotificationService {
  private config: NotificationConfig | null = null;
  private initialized = false;
  private transporter: Transporter | null = null;

  constructor() {
    // 延迟初始化，等到数据库准备好后再调用 loadConfig
  }

  init() {
    this.ensureInitialized();
    this.initializeEmail();
  }

  private initializeEmail() {
    if (this.transporter) return;
    const emailConfig = this.config?.email_config;
    if (!emailConfig?.smtp_host) return;

    // Try to get the SMTP password from credential service (encrypted)
    const emailCredStr = credentialService.getCredential('alert_email');
    let smtpUser = emailConfig.user;
    let smtpPass = emailConfig.password;

    if (emailCredStr) {
      try {
        const emailCred = JSON.parse(emailCredStr);
        if (emailCred.user) smtpUser = emailCred.user;
        if (emailCred.pass) smtpPass = emailCred.pass;
      } catch {
        // Not a valid JSON, use the config values as-is
      }
    }

    this.transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port || 465,
      secure: (emailConfig.smtp_port || 465) === 465,
      auth: {
        user: smtpUser || emailConfig.user || '',
        pass: smtpPass || emailConfig.password || ''
      }
    });
  }

  private ensureInitialized() {
    if (this.initialized) return;
    try {
      const configs = settingsRepository.getByKeyPrefix('notification_');
      const configData: Record<string, string | number | boolean | null> = {};
      configs.forEach((c) => {
        const key = c.key.replace('notification_', '');
        try {
          configData[key] = JSON.parse(c.value ?? '') as string | number | boolean | null;
        } catch {
          configData[key] = c.value;
        }
      });
      this.config = configData as unknown as NotificationConfig;
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to load notification config:', error);
    }
  }

  private loadConfig() {
    this.ensureInitialized();
    try {
      const configs = settingsRepository.getByKeyPrefix('notification_');
      const configData: Record<string, string | number | boolean | null> = {};
      configs.forEach((c) => {
        const key = c.key.replace('notification_', '');
        try {
          configData[key] = JSON.parse(c.value ?? '') as string | number | boolean | null;
        } catch {
          configData[key] = c.value;
        }
      });
      this.config = configData as unknown as NotificationConfig;
    } catch (error) {
      logger.error('Failed to load notification config:', error);
    }
  }

  async sendNotification(notification: {
    type: string;
    title: string;
    content: string;
    recipient?: string;
    related_alert_id?: string;
    related_task_id?: string;
  }) {
    this.ensureInitialized();
    const id = randomUUID();
    const now = new Date().toISOString();

    // 保存到数据库
    infraRepository.notifications.create({
      id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      recipient: notification.recipient || 'default',
      status: 'pending',
      related_alert_id: notification.related_alert_id || null,
      related_task_id: notification.related_task_id || null,
      created_at: now,
    });

    // 尝试发送
    try {
      await this.send(notification);
      infraRepository.notifications.markSent(id);
      return { success: true, id };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      infraRepository.notifications.markFailed(id, errorMessage);
      return { success: false, error: errorMessage, id };
    }
  }

  public async send(notification: { type: string; title: string; content: string }) {
    this.loadConfig(); // 重新加载最新配置

    const promises: Promise<void>[] = [];

    // 企业微信通知
    if (this.config?.wechat_enabled) {
      promises.push(this.sendWeChat(notification));
    }

    // 钉钉通知
    if (this.config?.dingtalk_enabled) {
      promises.push(this.sendDingTalk(notification));
    }

    // 邮件通知
    if (this.config?.email_enabled) {
      promises.push(this.sendEmail(notification));
    }

    // Webhook通知（默认启用）
    if (this.config?.webhook_enabled !== false) {
      promises.push(this.sendWebhook(notification));
    }

    await Promise.allSettled(promises);
  }

  private async sendWeChat(notification: { type: string; title: string; content: string }) {
    const wechatConfig = this.config?.wechat_config;
    if (!wechatConfig?.webhook_url) {
      throw new Error('WeChat webhook URL not configured');
    }

    const message = {
      msgtype: 'markdown',
      markdown: {
        content: `## ${notification.title}\n\n${notification.content}\n\n> 来源: ITOps Agent Platform\n> 时间: ${new Date().toLocaleString()}`
      }
    };

    await axios.post(wechatConfig.webhook_url, message, {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async sendDingTalk(notification: { type: string; title: string; content: string }) {
    const dingtalkConfig = this.config?.dingtalk_config;
    if (!dingtalkConfig?.webhook_url) {
      throw new Error('DingTalk webhook URL not configured');
    }

    const message = {
      msgtype: 'markdown',
      markdown: {
        title: notification.title,
        text: `## ${notification.title}\n\n${notification.content}\n\n> 来源: ITOps Agent Platform\n> 时间: ${new Date().toLocaleString()}`
      }
    };

    await axios.post(dingtalkConfig.webhook_url, message, {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async sendEmail(notification: { type: string; title: string; content: string }) {
    const emailConfig = this.config?.email_config;
    if (!emailConfig?.smtp_host) {
      throw new Error('Email SMTP not configured');
    }

    // Try to get SMTP credentials from credential service (encrypted)
    const emailCredStr = credentialService.getCredential('alert_email');
    let smtpUser = emailConfig.user;
    let smtpPass = emailConfig.password;

    if (emailCredStr) {
      try {
        const emailCred = JSON.parse(emailCredStr);
        if (emailCred.user) smtpUser = emailCred.user;
        if (emailCred.pass) smtpPass = emailCred.pass;
      } catch {
        // Use config values as-is
      }
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp_host,
        port: emailConfig.smtp_port || 465,
        secure: (emailConfig.smtp_port || 465) === 465,
        auth: {
          user: smtpUser || '',
          pass: smtpPass || ''
        }
      });
    }

    if (!this.transporter) {
      throw new Error('Failed to initialize email transporter');
    }

    const info = await this.transporter.sendMail({
      from: `"ITOps Agent Platform" <${smtpUser}>`,
      to: smtpUser,
      subject: notification.title,
      text: notification.content,
      html: `<h2>${notification.title}</h2><pre>${notification.content}</pre><hr/><small>ITOps Agent Platform - ${new Date().toLocaleString()}</small>`
    });

    logger.info('Email sent successfully', { messageId: info.messageId });
  }

  private async sendWebhook(notification: { type: string; title: string; content: string }) {
    const io = getIOInstance();
    if (io) {
      io.emit('notification', {
        id: randomUUID(),
        type: notification.type,
        title: notification.title,
        content: notification.content || '',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 快捷方法：发送告警通知
  async sendAlertNotification(alert: AlertRecord) {
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };

    return this.sendNotification({
      type: 'alert',
      title: `${severityEmoji[alert.severity as keyof typeof severityEmoji] || '⚪'} [${alert.severity?.toUpperCase()}] 新告警: ${alert.title}`,
      content: `
        **告警来源**: ${alert.source || 'unknown'}
        **告警级别**: ${alert.severity}
        **告警描述**: ${alert.content || 'No description'}
        **告警时间**: ${new Date().toLocaleString()}
      `,
      related_alert_id: alert.id
    });
  }

  // 快捷方法：发送任务状态通知
  async sendTaskNotification(task: TaskRecord, status: string) {
    const statusEmoji = {
      completed: '✅',
      failed: '❌',
      running: '▶️',
      pending: '⏳'
    };

    return this.sendNotification({
      type: 'task',
      title: `${statusEmoji[status as keyof typeof statusEmoji] || '⚪'} 任务状态变更: ${task.name}`,
      content: `
        **任务名称**: ${task.name}
        **当前状态**: ${status}
        **工作流ID**: ${task.workflow_id || 'N/A'}
        **更新时间**: ${new Date().toLocaleString()}
      `,
      related_task_id: task.id
    });
  }

  // 发送系统通知
  async sendSystemNotification(title: string, content: string) {
    return this.sendNotification({
      type: 'system',
      title: `🔧 ${title}`,
      content
    });
  }

  // 获取通知历史
  getNotificationHistory(limit = 50) {
    return infraRepository.notifications.getHistory(limit);
  }

  // 重新发送失败的通知
  async retryFailedNotifications() {
    const failed = infraRepository.notifications.list({ status: 'failed', limit: 10 });

    const results = [];
    for (const notification of failed) {
      const result = await this.sendNotification({
        type: notification.type,
        title: notification.title,
        content: notification.content || '',
        recipient: notification.recipient || undefined,
        related_alert_id: notification.related_alert_id || undefined,
        related_task_id: notification.related_task_id || undefined
      });
      results.push(result);
    }

    return results;
  }
}

export const notificationService = new NotificationService();

// 创建通知（内部使用，供其他模块调用）
export function createNotification(data: {
  type: string;
  title: string;
  content?: string;
  recipient?: string;
  related_alert_id?: string;
  related_task_id?: string;
}) {
  try {
    const id = randomUUID();
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { notificationsRepo } = require('../../../repositories');

    notificationsRepo.create({
      id,
      type: data.type,
      title: data.title,
      content: data.content || null,
      recipient: data.recipient || null,
      status: 'pending',
      related_alert_id: data.related_alert_id || null,
      related_task_id: data.related_task_id || null,
      created_at: now,
    });

    return id;
  } catch (error) {
    logger.error('Failed to create notification:', error);
    return null;
  }
}
