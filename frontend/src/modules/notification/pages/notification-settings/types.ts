/**
 * NotificationSettings 类型定义（2026-07-21 拆分）
 *
 * 把原 NotificationSettings.tsx L16-62 的 notificationConfig 类型抽出
 * 包含：4 channel (webhook/email/wechat/dingtalk) + 2 notification rule (alert/task)
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

export type ChannelName = 'email' | 'wechat' | 'dingtalk';

export type ChannelTestStatus = 'idle' | 'testing' | 'success' | 'error';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface NotificationConfig {
  webhook_enabled: boolean;
  webhook_url: string;
  email_enabled: boolean;
  email_config: {
    smtp_host: string;
    smtp_port: number;
    user: string;
    password: string;
    password_set: boolean;
  };
  wechat_enabled: boolean;
  wechat_config: { webhook_url: string };
  dingtalk_enabled: boolean;
  dingtalk_config: { webhook_url: string };
  alert_notification: { critical: boolean; warning: boolean; info: boolean };
  task_notification: { success: boolean; failed: boolean; running: boolean };
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  webhook_enabled: true,
  webhook_url: '',
  email_enabled: false,
  email_config: {
    smtp_host: '',
    smtp_port: 465,
    user: '',
    password: '',
    password_set: false,
  },
  wechat_enabled: false,
  wechat_config: {
    webhook_url: '',
  },
  dingtalk_enabled: false,
  dingtalk_config: {
    webhook_url: '',
  },
  alert_notification: {
    critical: true,
    warning: true,
    info: false,
  },
  task_notification: {
    success: true,
    failed: true,
    running: false,
  },
};

/** channel 列表（用于 channel section widget 测试） */
export const CHANNEL_NAMES: ReadonlyArray<ChannelName> = ['email', 'wechat', 'dingtalk'];
