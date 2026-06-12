/**
 * 通知渠道适配器 — ITOps Agent Platform
 *
 * 支持渠道：
 * - 企业微信机器人
 * - 飞书机器人
 * - 钉钉机器人
 * - Telegram Bot
 * - Email（委托给 notificationService 的已有 nodemailer）
 * - Webhook（通用）
 */

import axios from 'axios';
import { logger } from '../utils/logger';

// ================ 基础类型 ================

export interface NotificationMessage {
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';
  source?: string;
  timestamp?: string;
  details?: Record<string, unknown>;
}

// ================ 飞书机器人 ================

export async function sendFeishu(webhookUrl: string, message: NotificationMessage): Promise<boolean> {
  try {
    const colors: Record<string, string> = {
      info: 'blue',
      warning: 'yellow',
      critical: 'red',
    };

    const payload = {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: message.title },
          template: colors[message.severity] || 'blue',
        },
        elements: [
          { tag: 'markdown', content: message.content },
          ...(message.details
            ? [
                { tag: 'hr' },
                {
                  tag: 'markdown',
                  content: '**来源**: ' + (message.source || 'ITOps 平台') + '\n' +
                    '**时间**: ' + (message.timestamp || new Date().toISOString()),
                },
              ]
            : []),
        ],
      },
    };

    await axios.post(webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return true;
  } catch (error) {
    logger.error('❌ 飞书通知发送失败', error as Error);
    return false;
  }
}

// ================ 企业微信机器人 ================

export async function sendWeCom(webhookUrl: string, message: NotificationMessage): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {
      msgtype: 'markdown',
      markdown: {
        content: `## ${message.title}\n${message.content}\n> 来源: ${message.source || 'ITOps 平台'} | ${message.timestamp || new Date().toLocaleString()}`,
      },
    };

    await axios.post(webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return true;
  } catch (error) {
    logger.error('❌ 企业微信通知发送失败', error as Error);
    return false;
  }
}

// ================ 钉钉机器人 ================

export async function sendDingTalk(webhookUrl: string, message: NotificationMessage): Promise<boolean> {
  try {
    const severityMap: Record<string, string> = {
      info: '💡',
      warning: '⚠️',
      critical: '🚨',
    };
    const emoji = severityMap[message.severity] || '📢';

    const payload = {
      msgtype: 'markdown',
      markdown: {
        title: message.title,
        text: `# ${emoji} ${message.title}\n\n${message.content}\n\n---\n**来源**: ${message.source || 'ITOps 平台'} | **时间**: ${message.timestamp || new Date().toLocaleString()}`,
      },
    };

    await axios.post(webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return true;
  } catch (error) {
    logger.error('❌ 钉钉通知发送失败', error as Error);
    return false;
  }
}

// ================ Telegram Bot ================

export async function sendTelegram(botToken: string, chatId: string, message: NotificationMessage): Promise<boolean> {
  try {
    const severityIcons: Record<string, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    };
    const icon = severityIcons[message.severity] || '📢';

    const text = [
      `${icon} *${message.title}*`,
      '',
      message.content,
      '',
      `_来源: ${message.source || 'ITOps 平台'} | ${message.timestamp || new Date().toLocaleString()}_`,
    ].join('\n');

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }, {
      timeout: 10000,
    });
    return true;
  } catch (error) {
    logger.error('❌ Telegram 通知发送失败', error as Error);
    return false;
  }
}

// ================ 通用渠道发送器 ================

interface ChannelConfig {
  type: 'feishu' | 'wecom' | 'dingtalk' | 'telegram' | 'webhook';
  webhookUrl?: string;
  botToken?: string;
  chatId?: string;
}

export async function sendNotification(
  config: ChannelConfig,
  message: NotificationMessage
): Promise<boolean> {
  switch (config.type) {
    case 'feishu':
      if (!config.webhookUrl) return false;
      return sendFeishu(config.webhookUrl, message);

    case 'wecom':
      if (!config.webhookUrl) return false;
      return sendWeCom(config.webhookUrl, message);

    case 'dingtalk':
      if (!config.webhookUrl) return false;
      return sendDingTalk(config.webhookUrl, message);

    case 'telegram':
      if (!config.botToken || !config.chatId) return false;
      return sendTelegram(config.botToken, config.chatId, message);

    case 'webhook':
      if (!config.webhookUrl) return false;
      try {
        await axios.post(config.webhookUrl, message, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        });
        return true;
      } catch (error) {
        logger.error('❌ Webhook 通知发送失败', error as Error);
        return false;
      }

    default:
      logger.warn(`⚠️ 未知的通知渠道类型: ${(config as any).type}`);
      return false;
  }
}

export const CHANNEL_NAMES: Record<string, string> = {
  feishu: '飞书',
  wecom: '企业微信',
  dingtalk: '钉钉',
  telegram: 'Telegram',
  email: '邮件',
  webhook: 'Webhook',
};
