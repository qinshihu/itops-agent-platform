import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { notificationsRepo } from '../../../repositories';

const router = Router();

// 获取通知列表
router.get('/', (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      status,
      start_date,
      end_date
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const notifications = notificationsRepo.list({
      type: type as string | undefined,
      status: status as string | undefined,
      start_date: start_date as string | undefined,
      end_date: end_date as string | undefined,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
    });

    // 获取总数
    const total = notificationsRepo.count({
      type: type as string | undefined,
      status: status as string | undefined,
      start_date: start_date as string | undefined,
      end_date: end_date as string | undefined,
    });

    res.json({
      success: true,
      data: {
        notifications,
        total,
        page: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 创建通知（内部使用）
export const createNotification = (data: {
  type: string;
  title: string;
  content?: string;
  recipient?: string;
  related_alert_id?: string;
  related_task_id?: string;
}) => {
  try {
    const id = randomUUID();
    const now = new Date().toISOString();

    notificationsRepo.create({
      id,
      type: data.type,
      title: data.title,
      content: data.content || null,
      recipient: data.recipient || null,
      status: 'pending',
      related_alert_id: data.related_alert_id || null,
      related_task_id: data.related_task_id || null,
      created_at: now,
    });

    return id;
  } catch (error) {
    logger.error('Failed to create notification:', error);
    return null;
  }
};

// 标记通知为已发送
router.put('/:id/send', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notification = notificationsRepo.getById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    notificationsRepo.markSent(id);

    res.json({
      success: true,
      message: 'Notification marked as sent'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 删除通知
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const changes = notificationsRepo.delete(id);

    if (changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 获取通知统计
router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const stats = notificationsRepo.getStats();

    res.json({
      success: true,
      data: {
        typeStats: stats.typeStats,
        pendingCount: stats.pendingCount,
        todaySent: stats.todaySent
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export default router;
