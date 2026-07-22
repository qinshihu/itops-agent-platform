/**
 * NotificationSettings 工具函数（2026-07-21 拆分）
 *
 * 提供深合并函数（main 用于处理 widget 的 Partial<NotificationConfig> onChange）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

import type { NotificationConfig } from './types';

/**
 * 深合并：widget 给出 Partial，可能含嵌套对象（email_config 等）
 * 正确 merge 而不是 overwrite
 */
export function mergeNotificationConfig(
  prev: NotificationConfig,
  updater: Partial<NotificationConfig>,
): NotificationConfig {
  return {
    ...prev,
    ...updater,
    email_config: {
      ...prev.email_config,
      ...(updater.email_config || {}),
    },
    wechat_config: {
      ...prev.wechat_config,
      ...(updater.wechat_config || {}),
    },
    dingtalk_config: {
      ...prev.dingtalk_config,
      ...(updater.dingtalk_config || {}),
    },
    alert_notification: {
      ...prev.alert_notification,
      ...(updater.alert_notification || {}),
    },
    task_notification: {
      ...prev.task_notification,
      ...(updater.task_notification || {}),
    },
  };
}
