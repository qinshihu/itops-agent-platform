/**
 * notificationConfigService — 通知配置 service
 *
 * 把 routes 直接读写 settingsRepository（notification_ 前缀）的逻辑集中到 service。
 * 对应前端 /settings 页面通知子模块的"获取/更新通知配置"接口。
 *
 * 配置字段：
 *   webhook_enabled / email_enabled / wechat_enabled / dingtalk_enabled
 *   email_config / wechat_config / dingtalk_config
 *   alert_notification / task_notification
 *
 * 调用方：
 *   - modules/notification/routes/notificationConfigRoutes.ts
 *   - modules/notification/services/notificationService.ts（运行时读取最新配置）
 */

import { settingsRepository } from '../../../repositories';

export interface NotificationConfigPayload {
  webhook_enabled?: boolean;
  email_enabled?: boolean;
  wechat_enabled?: boolean;
  dingtalk_enabled?: boolean;
  email_config?: Record<string, unknown>;
  wechat_config?: Record<string, unknown>;
  dingtalk_config?: Record<string, unknown>;
  alert_notification?: { critical?: boolean; warning?: boolean; info?: boolean };
  task_notification?: { success?: boolean; failed?: boolean; running?: boolean };
}

const KEY_PREFIX = 'notification_';

const DEFAULTS: NotificationConfigPayload = {
  webhook_enabled: true,
  email_enabled: false,
  wechat_enabled: false,
  dingtalk_enabled: false,
  email_config: {},
  wechat_config: {},
  dingtalk_config: {},
  alert_notification: { critical: true, warning: true, info: false },
  task_notification: { success: true, failed: true, running: false },
};

/**
 * 从 settings 表读取所有 notification_ 前缀配置，合并默认值后返回。
 */
export function getNotificationConfig(): NotificationConfigPayload {
  const configs = settingsRepository.getByKeyPrefix(KEY_PREFIX);
  const parsed: Record<string, unknown> = {};
  for (const c of configs) {
    const key = c.key.replace(KEY_PREFIX, '');
    try {
      parsed[key] = JSON.parse(c.value ?? '');
    } catch {
      parsed[key] = c.value;
    }
  }

  return {
    ...DEFAULTS,
    ...parsed,
  } as NotificationConfigPayload;
}

/**
 * 把前端传入的更新写入 settings 表（notification_ 前缀）。
 * 仅持久化有意义的字段，未提供的字段保留原值。
 */
export function updateNotificationConfig(payload: NotificationConfigPayload): void {
  const updates: Record<string, string> = {};
  const setIfDefined = (key: string, value: unknown) => {
    if (value !== undefined) {
      updates[`${KEY_PREFIX}${key}`] = JSON.stringify(value);
    }
  };

  setIfDefined('webhook_enabled', payload.webhook_enabled);
  setIfDefined('email_enabled', payload.email_enabled);
  setIfDefined('wechat_enabled', payload.wechat_enabled);
  setIfDefined('dingtalk_enabled', payload.dingtalk_enabled);
  setIfDefined('email_config', payload.email_config);
  setIfDefined('wechat_config', payload.wechat_config);
  setIfDefined('dingtalk_config', payload.dingtalk_config);
  setIfDefined('alert_notification', payload.alert_notification);
  setIfDefined('task_notification', payload.task_notification);

  if (Object.keys(updates).length > 0) {
    settingsRepository.upsertMany(updates);
  }
}

export const notificationConfigService = {
  getNotificationConfig,
  updateNotificationConfig,
};

export default notificationConfigService;