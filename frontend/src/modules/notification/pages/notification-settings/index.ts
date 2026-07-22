/**
 * notification-settings 子模块 barrel export（2026-07-21 拆分）
 */
export type {
  ChannelName,
  ChannelTestStatus,
  SaveStatus,
  NotificationConfig,
} from './types';
export { DEFAULT_NOTIFICATION_CONFIG, CHANNEL_NAMES } from './types';
export { ToggleSwitch, type ToggleSwitchProps } from './ToggleSwitch';
export {
  useNotificationSettings,
  type UseNotificationSettingsResult,
} from './useNotificationSettings';
export { mergeNotificationConfig } from './helpers';
export {
  WebhookChannelSection,
  type WebhookChannelSectionProps,
} from './WebhookChannelSection';
export {
  EmailChannelSection,
  type EmailChannelSectionProps,
} from './EmailChannelSection';
export {
  WechatChannelSection,
  type WechatChannelSectionProps,
} from './WechatChannelSection';
export {
  DingtalkChannelSection,
  type DingtalkChannelSectionProps,
} from './DingtalkChannelSection';
export {
  NotificationRulesSection,
  type NotificationRulesSectionProps,
} from './NotificationRulesSection';
