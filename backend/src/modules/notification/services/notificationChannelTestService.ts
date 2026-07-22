/**
 * notificationChannelTestService — 通知渠道测试 service
 *
 * 把 notificationConfigRoutes 中"测试通知渠道"的 switch 业务逻辑集中到 service：
 *   - email    : 使用入参 SMTP 配置发测试邮件
 *   - wechat   : 调用 sendWeCom 推 webhook
 *   - dingtalk : 调用 sendDingTalk 推 webhook
 *
 * 调用方：
 *   - modules/notification/routes/notificationConfigRoutes.ts
 */

import nodemailer from 'nodemailer';
import { sendWeCom, sendDingTalk } from './notificationChannels';

export type ChannelName = 'email' | 'wechat' | 'dingtalk';

export interface EmailTestInput {
  smtp_host?: string;
  smtp_port?: number;
  user?: string;
  password?: string;
  to?: string;
}

export interface WebhookTestInput {
  webhook_url?: string;
}

export interface ChannelTestResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 测试邮件渠道（不入 settings，纯粹用入参 SMTP 配置发测试邮件）。
 */
export async function testEmailChannel(input: EmailTestInput): Promise<ChannelTestResult> {
  if (!input.smtp_host || !input.user) {
    return { success: false, error: 'SMTP 服务器和邮箱账号不能为空' };
  }

  const port = input.smtp_port || 465;
  const transporter = nodemailer.createTransport({
    host: input.smtp_host,
    port,
    secure: port === 465,
    auth: { user: input.user, pass: input.password || '' },
  });

  await transporter.sendMail({
    from: `"ITOps Agent" <${input.user}>`,
    to: input.to || input.user,
    subject: '🔔 ITOps Agent Platform - 通知渠道测试',
    text: '这是一封测试邮件，证明邮件通知配置正确。\n\n如果您收到此邮件，说明 SMTP 配置已生效。',
    html: '<h2>✅ 通知配置测试</h2><p>这是一封测试邮件，证明邮件通知配置正确。</p><hr/><small>ITOps Agent Platform</small>',
  });

  return { success: true, message: '测试邮件发送成功' };
}

/**
 * 测试企业微信渠道。
 */
export async function testWechatChannel(input: WebhookTestInput): Promise<ChannelTestResult> {
  if (!input.webhook_url) {
    return { success: false, error: '企业微信 Webhook URL 不能为空' };
  }
  await sendWeCom(input.webhook_url, {
    title: '🔔 ITOps Agent - 通知渠道测试',
    content: '这是一条测试消息，证明企业微信通知配置正确。\n> 时间: ' + new Date().toLocaleString(),
    severity: 'info',
    source: 'ITOps Platform',
  });
  return { success: true, message: '企业微信测试消息发送成功' };
}

/**
 * 测试钉钉渠道。
 */
export async function testDingtalkChannel(input: WebhookTestInput): Promise<ChannelTestResult> {
  if (!input.webhook_url) {
    return { success: false, error: '钉钉 Webhook URL 不能为空' };
  }
  await sendDingTalk(input.webhook_url, {
    title: '🔔 ITOps Agent - 通知渠道测试',
    content: '这是一条测试消息，证明钉钉通知配置正确。',
    severity: 'info',
    source: 'ITOps Platform',
  });
  return { success: true, message: '钉钉测试消息发送成功' };
}

/**
 * 渠道测试统一入口。
 */
export async function testNotificationChannel(
  channel: string,
  body: Record<string, unknown>
): Promise<ChannelTestResult & { unknown?: true }> {
  switch (channel) {
    case 'email':
      return testEmailChannel(body as EmailTestInput);
    case 'wechat':
      return testWechatChannel(body as WebhookTestInput);
    case 'dingtalk':
      return testDingtalkChannel(body as WebhookTestInput);
    default:
      return { success: false, error: `未知的通知渠道: ${channel}`, unknown: true };
  }
}

export const notificationChannelTestService = {
  testEmailChannel,
  testWechatChannel,
  testDingtalkChannel,
  testNotificationChannel,
};

export default notificationChannelTestService;