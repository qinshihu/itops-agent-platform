/**
 * =============================================================================
 * 虚拟机管理 - 快照管理路由
 * =============================================================================
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { requireRole } from '../../../../middleware/auth';
import { vmManagementService } from '../../services/vmManagement';
import type { CreateSnapshotRequest, RestoreSnapshotRequest } from '../../../../types/vmManagement';

const router = Router();

// 获取快照列表（viewer 可读）
router.get('/platforms/:platformId/vms/:vmId/snapshots', async (req: Request, res: Response) => {
  try {
    const snapshots = await vmManagementService.listSnapshots(
      req.params.platformId,
      req.params.vmId,
    );
    res.json({ success: true, data: snapshots });
  } catch (error) {
    logger.error('❌ 获取快照列表失败:', error);
    res.status(500).json({ success: false, error: '获取快照列表失败' });
  }
});

// 创建快照
router.post(
  '/platforms/:platformId/vms/:vmId/snapshots',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      const snapshotRequest: CreateSnapshotRequest = {
        ...req.body,
        vmId: req.params.vmId,
      };
      const snapshot = await vmManagementService.createSnapshot(
        req.params.platformId,
        snapshotRequest,
      );
      res.json({ success: true, data: snapshot, message: '快照创建成功' });
    } catch (error) {
      logger.error('❌ 创建快照失败:', error);
      res.status(500).json({ success: false, error: '创建快照失败' });
    }
  },
);

// 恢复快照
router.post('/platforms/:platformId/vms/:vmId/snapshots/:snapshotId/restore', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
    try {
      const restoreRequest: RestoreSnapshotRequest = {
        ...req.body,
        vmId: req.params.vmId,
        snapshotId: req.params.snapshotId,
      };
      await vmManagementService.restoreSnapshot(req.params.platformId, restoreRequest);
      res.json({ success: true, message: '快照恢复成功' });
    } catch (error) {
      logger.error('❌ 恢复快照失败:', error);
      res.status(500).json({ success: false, error: '恢复快照失败' });
    }
  },
);

// 删除快照
router.delete(
  '/platforms/:platformId/vms/:vmId/snapshots/:snapshotId',
  async (req: Request, res: Response) => {
    try {
      await vmManagementService.deleteSnapshot(
        req.params.platformId,
        req.params.snapshotId,
        req.params.vmId,
      );
      res.json({ success: true, message: '快照删除成功' });
    } catch (error) {
      logger.error('❌ 删除快照失败:', error);
      res.status(500).json({ success: false, error: '删除快照失败' });
    }
  },
);

export default router;
