/**
 * Notification 模块 API 层
 * 封装通知记录和通知配置相关的 API 端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  content: string | null;
  recipient: string | null;
  status: string;
  related_alert_id: string | null;
  related_task_id: string | null;
  sent_at: string | null;
  error_message: string | null; // 失败原因（2026-07-06 增）
  created_at: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}

export interface NotificationStats {
  pendingCount?: number;
  todaySent?: number;
  typeStats?: Array<{ type: string; count: number }>;
  [key: string]: unknown;
}

export interface NotificationConfig {
  webhook_enabled?: boolean;
  webhook_url?: string;
  email_enabled?: boolean;
  email_config?: {
    smtp_host: string;
    smtp_port: number;
    user: string;
    password: string;
  };
  wechat_enabled?: boolean;
  wechat_config?: {
    webhook_url: string;
  };
  dingtalk_enabled?: boolean;
  dingtalk_config?: {
    webhook_url: string;
  };
  alert_notification?: {
    critical: boolean;
    warning: boolean;
    info: boolean;
  };
  task_notification?: {
    success: boolean;
    failed: boolean;
    running: boolean;
  };
  [key: string]: unknown;
}

// ============================================================
// notificationApi 对象
// ============================================================

export const notificationApi = {
  /** 获取通知列表 */
  async list(
    params?: NotificationListParams,
  ): Promise<{ notifications: NotificationRecord[]; total?: number }> {
    // axios 拦截器已把 response.data 解包，data 本身就是后端 result
    const { data } = await api.get('/notifications', { params });
    return data;
  },

  /** 获取通知统计 */
  async getStats(): Promise<NotificationStats> {
    const { data } = await api.get('/notifications/stats/summary');
    return data;
  },

  /** 标记通知为已发送 */
  async markAsSent(id: string): Promise<void> {
    await api.put(`/notifications/${id}/send`);
  },

  /** 删除通知 */
  async delete(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },

  /** 获取通知渠道配置 */
  async getConfig(): Promise<NotificationConfig> {
    const { data } = await api.get('/notification-config');
    return data;
  },

  /** 更新通知渠道配置 */
  async updateConfig(config: NotificationConfig): Promise<unknown> {
    const { data } = await api.put('/notification-config', config);
    return data;
  },

  /** 测试通知渠道 */
  async testChannel(
    channel: string,
    body?: Record<string, unknown>,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data } = await api.post(`/notification-config/test/${channel}`, body);
    return data;
  },
};
