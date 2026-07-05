import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireRole } from '../../../middleware/auth';
import { approvalService } from '../services/approvalService';
import { approvalsRepo } from '../../../repositories';
import { logger } from '../../../utils/logger';

const router = Router();

// 查询审批列表
router.get('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;
    const approvals = approvalsRepo.list({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, data: approvals });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to fetch approvals' });
  }
});

// 查询待审批数量（用于前端角标）
router.get('/pending/count', requireRole('admin', 'operator'), (_req: Request, res: Response) => {
  try {
    const count = approvalsRepo.countPending();
    res.json({ success: true, data: { count } });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to count pending approvals' });
  }
});

// 查询审批详情
router.get('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const approval = approvalsRepo.getById(req.params.id);
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }
    res.json({ success: true, data: approval });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to fetch approval' });
  }
});

// 审批通过
router.post('/:id/approve', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (req as any).user?.id || 'unknown';

    // 异步不阻塞响应
    res.json({ success: true, message: 'Approval granted, resuming workflow' });
    setImmediate(() => {
      approvalService.approve(id, userId, comment).catch(err =>
        logger.error('Failed to approve:', err)
      );
    });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to approve' });
  }
});

// 审批拒绝
router.post('/:id/reject', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (req as any).user?.id || 'unknown';

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Reject reason is required' });
    }

    // 异步不阻塞响应
    res.json({ success: true, message: 'Approval rejected, workflow terminated' });
    setImmediate(() => {
      approvalService.reject(id, userId, reason).catch(err =>
        logger.error('Failed to reject:', err)
      );
    });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to reject' });
  }
});

export default router;
