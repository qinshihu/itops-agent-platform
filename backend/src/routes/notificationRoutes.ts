import { Router, Request, Response } from 'express';
import db from '../models/database';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

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
    
    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params: unknown[] = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string));
    params.push((parseInt(page as string) - 1) * parseInt(limit as string));
    
    const notifications = db.prepare(query).all(...params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE 1=1';
    const countParams = params.slice(0, -2);
    
    if (type) countQuery += ' AND type = ?';
    if (status) countQuery += ' AND status = ?';
    if (start_date) countQuery += ' AND created_at >= ?';
    if (end_date) countQuery += ' AND created_at <= ?';
    
    const countResult = db.prepare(countQuery).get(...countParams) as { total: number };
    
    res.json({
      success: true,
      data: {
        notifications,
        total: countResult.total,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
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
    
    db.prepare(`
      INSERT INTO notifications (id, type, title, content, recipient, status, related_alert_id, related_task_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.type,
      data.title,
      data.content || null,
      data.recipient || null,
      'pending',
      data.related_alert_id || null,
      data.related_task_id || null,
      now
    );
    
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
    
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    db.prepare(`
      UPDATE notifications 
      SET status = 'sent' 
      WHERE id = ?
    `).run(id);
    
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
    
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    
    if (result.changes === 0) {
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
    // 按类型统计
    const typeStats = db.prepare(`
      SELECT type, status, COUNT(*) as count 
      FROM notifications 
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY type, status
    `).all();
    
    // 待发送通知数
    const pendingCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE status = 'pending'
    `).get() as { count: number };
    
    // 今日发送数
    const todaySent = db.prepare(`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE status = 'sent' AND created_at >= datetime('now', 'start of day')
    `).get() as { count: number };
    
    res.json({
      success: true,
      data: {
        typeStats,
        pendingCount: pendingCount.count,
        todaySent: todaySent.count
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
