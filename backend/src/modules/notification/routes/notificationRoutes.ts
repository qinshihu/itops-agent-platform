import type { Request, Response } from 'express';
import { Router } from 'express';
import { notificationCrudService } from '../services/notificationCrudService';
import { createNotification as _createNotification } from '../services/notificationService';

const router = Router();

// 获取通知列表
router.get('/', (req: Request, res: Response) => {
  try {
    const { page, limit, type, status, start_date, end_date } = req.query;

    const result = notificationCrudService.listNotifications({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      type: type as string | undefined,
      status: status as string | undefined,
      start_date: start_date as string | undefined,
      end_date: end_date as string | undefined,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 标记通知为已发送
router.put('/:id/send', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ok = notificationCrudService.markNotificationSent(id);
    if (!ok) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

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

    const ok = notificationCrudService.deleteNotification(id);
    if (!ok) {
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
    const stats = notificationCrudService.getNotificationStats();

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