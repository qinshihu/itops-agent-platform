/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { auditLogCrudService } from '../services/auditLogCrudService';

const router = Router();

// 列表（分页 + 过滤）
router.get('/', (req: Request, res: Response) => {
  try {
    const data = auditLogCrudService.listLogs(req.query as Record<string, string | undefined>);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 详情（用 /logs/:id 而非 /:id，避免与外层 router 通配冲突）
router.get('/logs/:id', (req: Request, res: Response) => {
  try {
    const log = auditLogCrudService.getLogById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Audit log not found' });
    }
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 统计
router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const data = auditLogCrudService.getStatsSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
