import { Router, Request, Response } from 'express';
import db from '../models/database';
export { createAuditLog } from '../services/auditService';

const router = Router();

// 获取审计日志列表
router.get('/', (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      resource_type, 
      user_id, 
      start_date, 
      end_date 
    } = req.query;
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];
    
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    if (resource_type) {
      query += ' AND resource_type = ?';
      params.push(resource_type);
    }
    
    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
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
    
    const logs = db.prepare(query).all(...params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = params.slice(0, -2);
    
    if (action) countQuery += ' AND action = ?';
    if (resource_type) countQuery += ' AND resource_type = ?';
    if (user_id) countQuery += ' AND user_id = ?';
    if (start_date) countQuery += ' AND created_at >= ?';
    if (end_date) countQuery += ' AND created_at <= ?';
    
    const countResult = db.prepare(countQuery).get(...countParams) as { total: number };
    
    res.json({
      success: true,
      data: {
        logs,
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

// 获取单个审计日志详情
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const log = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }
    
    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});



// 获取审计统计信息
router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    // 按动作类型统计
    const actionStats = db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY action
      ORDER BY count DESC
    `).all();
    
    // 按资源类型统计
    const resourceStats = db.prepare(`
      SELECT resource_type, COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY resource_type
      ORDER BY count DESC
    `).all();
    
    // 今日操作数
    const todayStats = db.prepare(`
      SELECT COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= datetime('now', 'start of day')
    `).get() as { count: number };
    
    // 失败操作数（audit_logs 暂无 status 字段，固定返回 0）
    const failureCount = 0;
    
    res.json({
      success: true,
      data: {
        actionStats,
        resourceStats,
        todayCount: todayStats.count,
        failureCount
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
