// backend/src/repositories/types/notification.ts
// 来源: v001 + v015

/** 通知 — v001 notifications + v015 ALTER (4 个新列) */
export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string | null;
  status: string;
  recipient: string | null;
  metadata: string | null;
  related_alert_id: string | null;    // v015 ALTER
  related_task_id: string | null;     // v015 ALTER
  sent_at: string | null;             // v015 ALTER
  error_message: string | null;       // v015 ALTER
  created_at: string;
}

/** 通知配置 — v001 notification_configs */
export interface NotificationConfig {
  id: number;
  webhook_enabled: number;
  webhook_url: string | null;
  email_enabled: number;
  email_config: string | null;
  wechat_enabled: number;
  wechat_config: string | null;
  dingtalk_enabled: number;
  dingtalk_config: string | null;
  alert_notification: string | null;
  task_notification: string | null;
  updated_at: string;
}
