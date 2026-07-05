import type { Request, Response } from 'express';
import { Router } from 'express';
import { auditLogRepository } from '../../../repositories';
import type { AuditLogListFilters } from '../../../repositories';

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

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const filters: AuditLogListFilters = {
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
    };
    if (action) filters.action = action as string;
    if (resource_type) filters.resource_type = resource_type as string;
    if (user_id) filters.user_id = user_id as string;
    if (start_date) filters.start_date = start_date as string;
    if (end_date) filters.end_date = end_date as string;

    const logs = auditLogRepository.list(filters);
    const total = auditLogRepository.count(filters);

    res.json({
      success: true,
      data: {
        logs,
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

// 获取单个审计日志详情
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const log = auditLogRepository.getById(id);

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
    const actionStats = auditLogRepository.getActionStats();
    const resourceStats = auditLogRepository.getResourceStats();
    const todayCount = auditLogRepository.getTodayCount();
    const failureCount = 0;

    res.json({
      success: true,
      data: {
        actionStats,
        resourceStats,
        todayCount,
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
