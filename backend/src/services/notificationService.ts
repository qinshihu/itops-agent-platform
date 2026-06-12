import db, { getIOInstance } from '../models/database';
import { logger } from '../utils/logger';
import axios from 'axios';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { credentialService } from './credentialService';

interface NotificationDB {
  id: string;
  type: string;
  title: string;
  content: string;
  recipient: string;
  related_alert_id: string | null;
  related_task_id: string | null;
}

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
  private initialized: boolean = false;
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
      const configs = db.prepare('SELECT * FROM settings WHERE key LIKE ?').all('notification_%') as Array<{
        key: string;
        value: string;
      }>;
      const configData: Record<string, unknown> = {};
      configs.forEach((c) => {
        const key = c.key.replace('notification_', '');
        try {
          configData[key] = JSON.parse(c.value);
        } catch {
          configData[key] = c.value;
        }
      });
      this.config = configData as NotificationConfig;
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to load notification config:', error);
    }
  }

  private loadConfig() {
    this.ensureInitialized();
    try {
      const configs = db.prepare('SELECT * FROM settings WHERE key LIKE ?').all('notification_%') as Array<{
        key: string;
        value: string;
      }>;
      const configData: Record<string, unknown> = {};
      configs.forEach((c) => {
        const key = c.key.replace('notification_', '');
        try {
          configData[key] = JSON.parse(c.value);
        } catch {
          configData[key] = c.value;
        }
      });
      this.config = configData as NotificationConfig;
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
    db.prepare(`
      INSERT INTO notifications (id, type, title, content, recipient, status, related_alert_id, related_task_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      notification.type,
      notification.title,
      notification.content,
      notification.recipient || 'default',
      'pending',
      notification.related_alert_id || null,
      notification.related_task_id || null,
      now
    );

    // 尝试发送
    try {
      await this.send(notification);
      db.prepare('UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?').run('sent', now, id);
      return { success: true, id };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      db.prepare('UPDATE notifications SET status = ?, error_message = ? WHERE id = ?').run('failed', errorMessage, id);
      return { success: false, error: errorMessage, id };
    }
  }

  private async send(notification: { type: string; title: string; content: string }) {
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
        content: notification.content,
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
  getNotificationHistory(limit: number = 50) {
    return db.prepare(`
      SELECT * FROM notifications 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
  }

  // 重新发送失败的通知
  async retryFailedNotifications() {
    const failed = db.prepare(`
      SELECT * FROM notifications 
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT 10
    `).all() as NotificationDB[];

    const results = [];
    for (const notification of failed) {
      const result = await this.sendNotification({
        type: notification.type,
        title: notification.title,
        content: notification.content,
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
