/**
 * notificationCrudService — 通知 CRUD service
 *
 * 提供通知列表、标记发送、删除、统计等 CRUD 操作。
 * 把 routes 直接调用 notificationsRepo 的模式改为 routes → service → repository。
 *
 * 调用方：
 *   - modules/notification/routes/notificationRoutes.ts
 */

import { notificationsRepo } from '../../../repositories';
import type {
  NotificationRecord,
  NotificationStats,
} from '../../../repositories/infraRepository/types';

export interface ListNotificationsParams {
  type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface ListNotificationsResult {
  notifications: NotificationRecord[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 分页查询通知列表。
 */
export function listNotifications(params: ListNotificationsParams = {}): ListNotificationsResult {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const filters = {
    type: params.type,
    status: params.status,
    start_date: params.start_date,
    end_date: params.end_date,
    limit,
    offset: (page - 1) * limit,
  };

  const notifications = notificationsRepo.list(filters);
  const total = notificationsRepo.count({
    type: params.type,
    status: params.status,
    start_date: params.start_date,
    end_date: params.end_date,
  });

  return { notifications, total, page, limit };
}

/**
 * 获取单条通知。
 */
export function getNotificationById(id: string): NotificationRecord | undefined {
  return notificationsRepo.getById(id);
}

/**
 * 标记通知为已发送。
 */
export function markNotificationSent(id: string): boolean {
  const existing = notificationsRepo.getById(id);
  if (!existing) return false;
  notificationsRepo.markSent(id);
  return true;
}

/**
 * 删除通知。返回是否实际删除（false = 不存在）。
 */
export function deleteNotification(id: string): boolean {
  const changes = notificationsRepo.delete(id);
  return changes > 0;
}

/**
 * 重发通知：复制原通知字段重新走 sendNotification（不修改原记录）。
 * 返回重发结果（success + message）或 null 表示原通知不存在。
 */
export async function retryNotification(
  id: string,
): Promise<{ success: boolean; message: string } | null> {
  const existing = notificationsRepo.getById(id);
  if (!existing) return null;
  const { notificationService } = await import('./notificationService');
  try {
    const result = await notificationService.sendNotification({
      type: existing.type,
      title: existing.title,
      content: existing.content || '',
      recipient: existing.recipient || undefined,
      related_alert_id: existing.related_alert_id || undefined,
      related_task_id: existing.related_task_id || undefined,
    });
    // sendNotification 返回 boolean 表示成功/失败
    return {
      success: Boolean(result),
      message: result ? '通知已重新发送' : '通知重新发送失败',
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : '未知错误',
    };
  }
}

/**
 * 获取通知统计（按 type/status 分组 + 待发送数 + 今日已发送数）。
 */
export function getNotificationStats(): NotificationStats {
  return notificationsRepo.getStats();
}

export const notificationCrudService = {
  listNotifications,
  getNotificationById,
  markNotificationSent,
  deleteNotification,
  retryNotification,
  getNotificationStats,
};

export default notificationCrudService;
