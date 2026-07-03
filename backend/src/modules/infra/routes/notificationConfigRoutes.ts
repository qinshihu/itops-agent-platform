import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import { settingsRepository } from '../../../repositories';
import { sendWeCom, sendDingTalk } from '../services/notificationChannels';
import nodemailer from 'nodemailer';

const router = Router();

// 获取通知配置
router.get('/', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const configs = settingsRepository.getByKeyPrefix('notification_');

    const config: Record<string, unknown> = {};
    configs.forEach((c) => {
      const key = c.key.replace('notification_', '');
      try {
        config[key] = JSON.parse(c.value ?? '');
      } catch {
        config[key] = c.value;
      }
    });

    res.json({
      success: true,
      data: {
        webhook_enabled: config.webhook_enabled ?? true,
        email_enabled: config.email_enabled ?? false,
        wechat_enabled: config.wechat_enabled ?? false,
        dingtalk_enabled: config.dingtalk_enabled ?? false,
        email_config: config.email_config ?? {},
        wechat_config: config.wechat_config ?? {},
        dingtalk_config: config.dingtalk_config ?? {},
        alert_notification: config.alert_notification ?? {
          critical: true,
          warning: true,
          info: false
        },
        task_notification: config.task_notification ?? {
          success: true,
          failed: true,
          running: false
        }
      }
    });
  } catch (error) {
    logger.error('获取通知配置失败:', error);
    res.status(500).json({ success: false, error: '获取通知配置失败' });
  }
});

// 测试通知渠道
router.post('/test/:channel', requireRole('admin'), async (req: Request, res: Response) => {
  const { channel } = req.params;

  try {
    switch (channel) {
      case 'email': {
        const { smtp_host, smtp_port, user, password, to } = req.body;
        if (!smtp_host || !user) {
          return res.status(400).json({ success: false, error: 'SMTP 服务器和邮箱账号不能为空' });
        }
        const transporter = nodemailer.createTransport({
          host: smtp_host,
          port: smtp_port || 465,
          secure: (smtp_port || 465) === 465,
          auth: { user, pass: password || '' },
        });
        await transporter.sendMail({
          from: `"ITOps Agent" <${user}>`,
          to: to || user,
          subject: '🔔 ITOps Agent Platform - 通知渠道测试',
          text: '这是一封测试邮件，证明邮件通知配置正确。\n\n如果您收到此邮件，说明 SMTP 配置已生效。',
          html: '<h2>✅ 通知配置测试</h2><p>这是一封测试邮件，证明邮件通知配置正确。</p><hr/><small>ITOps Agent Platform</small>',
        });
        return res.json({ success: true, message: '测试邮件发送成功' });
      }

      case 'wechat': {
        const { webhook_url } = req.body;
        if (!webhook_url) {
          return res.status(400).json({ success: false, error: '企业微信 Webhook URL 不能为空' });
        }
        await sendWeCom(webhook_url, {
          title: '🔔 ITOps Agent - 通知渠道测试',
          content: '这是一条测试消息，证明企业微信通知配置正确。\n> 时间: ' + new Date().toLocaleString(),
          severity: 'info',
          source: 'ITOps Platform',
        });
        return res.json({ success: true, message: '企业微信测试消息发送成功' });
      }

      case 'dingtalk': {
        const { webhook_url } = req.body;
        if (!webhook_url) {
          return res.status(400).json({ success: false, error: '钉钉 Webhook URL 不能为空' });
        }
        await sendDingTalk(webhook_url, {
          title: '🔔 ITOps Agent - 通知渠道测试',
          content: '这是一条测试消息，证明钉钉通知配置正确。',
          severity: 'info',
          source: 'ITOps Platform',
        });
        return res.json({ success: true, message: '钉钉测试消息发送成功' });
      }

      default:
        return res.status(400).json({ success: false, error: `未知的通知渠道: ${channel}` });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`通知渠道测试失败 [${channel}]:`, error as Error);
    return res.status(500).json({ success: false, error: `测试失败: ${msg}` });
  }
});

// 更新通知配置
router.put('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const {
      webhook_enabled,
      email_enabled,
      wechat_enabled,
      dingtalk_enabled,
      email_config,
      wechat_config,
      dingtalk_config,
      alert_notification,
      task_notification
    } = req.body;

    const updates: Record<string, string> = {
      'notification_webhook_enabled': JSON.stringify(webhook_enabled),
      'notification_email_enabled': JSON.stringify(email_enabled),
      'notification_wechat_enabled': JSON.stringify(wechat_enabled),
      'notification_dingtalk_enabled': JSON.stringify(dingtalk_enabled),
      'notification_email_config': JSON.stringify(email_config),
      'notification_wechat_config': JSON.stringify(wechat_config),
      'notification_dingtalk_config': JSON.stringify(dingtalk_config),
      'notification_alert_notification': JSON.stringify(alert_notification),
      'notification_task_notification': JSON.stringify(task_notification)
    };

    settingsRepository.upsertMany(updates);

    res.json({
      success: true,
      message: '通知配置已更新'
    });
  } catch (error) {
    logger.error('更新通知配置失败:', error);
    res.status(500).json({ success: false, error: '更新通知配置失败' });
  }
});

export default router;
