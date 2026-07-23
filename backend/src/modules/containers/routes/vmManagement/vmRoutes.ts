/**
 * =============================================================================
 * 虚拟机管理 - 虚拟机 CRUD 与电源操作路由
 * =============================================================================
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { requireRole } from '../../../../middleware/auth';
import { vmManagementService } from '../../services/vmManagement';
import type { CreateVMRequest, CloneVMRequest } from '../../../../types/vmManagement';

const router = Router();

// 获取虚拟机列表（viewer 可读）
router.get('/platforms/:platformId/vms', async (req: Request, res: Response) => {
  try {
    const vms = await vmManagementService.listVMs(req.params.platformId);
    res.json({ success: true, data: vms });
  } catch (error) {
    logger.error('❌ 获取虚拟机列表失败:', error);
    res.status(500).json({ success: false, error: '获取虚拟机列表失败' });
  }
});

// 获取单个虚拟机
router.get('/platforms/:platformId/vms/:vmId', async (req: Request, res: Response) => {
  try {
    const vm = await vmManagementService.getVM(req.params.platformId, req.params.vmId);
    if (!vm) {
      return res.status(404).json({ success: false, error: '虚拟机不存在' });
    }
    res.json({ success: true, data: vm });
  } catch (error) {
    logger.error('❌ 获取虚拟机详情失败:', error);
    res.status(500).json({ success: false, error: '获取虚拟机详情失败' });
  }
});

// 创建虚拟机
router.post(
  '/platforms/:platformId/vms',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      const vm = await vmManagementService.createVM(
        req.params.platformId,
        req.body as CreateVMRequest,
      );
      res.json({ success: true, data: vm, message: '虚拟机创建成功' });
    } catch (error) {
      logger.error('❌ 创建虚拟机失败:', error);
      res.status(500).json({ success: false, error: '创建虚拟机失败' });
    }
  },
);

// 克隆虚拟机
router.post(
  '/platforms/:platformId/vms/:vmId/clone',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      const cloneRequest: CloneVMRequest = {
        ...req.body,
        vmId: req.params.vmId,
      };
      const vm = await vmManagementService.cloneVM(req.params.platformId, cloneRequest);
      res.json({ success: true, data: vm, message: '虚拟机克隆成功' });
    } catch (error) {
      logger.error('❌ 克隆虚拟机失败:', error);
      res.status(500).json({ success: false, error: '克隆虚拟机失败' });
    }
  },
);

// 删除虚拟机
router.delete(
  '/platforms/:platformId/vms/:vmId',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      await vmManagementService.deleteVM(req.params.platformId, req.params.vmId);
      res.json({ success: true, message: '虚拟机删除成功' });
    } catch (error) {
      logger.error('❌ 删除虚拟机失败:', error);
      res.status(500).json({ success: false, error: '删除虚拟机失败' });
    }
  },
);

// 启动虚拟机
router.post(
  '/platforms/:platformId/vms/:vmId/start',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      await vmManagementService.powerOnVM(req.params.platformId, req.params.vmId);
      res.json({ success: true, message: '虚拟机启动成功' });
    } catch (error) {
      logger.error('❌ 启动虚拟机失败:', error);
      res.status(500).json({ success: false, error: '启动虚拟机失败' });
    }
  },
);

// 关闭虚拟机
router.post(
  '/platforms/:platformId/vms/:vmId/stop',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      await vmManagementService.powerOffVM(req.params.platformId, req.params.vmId);
      res.json({ success: true, message: '虚拟机关闭成功' });
    } catch (error) {
      logger.error('❌ 关闭虚拟机失败:', error);
      res.status(500).json({ success: false, error: '关闭虚拟机失败' });
    }
  },
);

// 重启虚拟机
router.post(
  '/platforms/:platformId/vms/:vmId/restart',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      await vmManagementService.restartVM(req.params.platformId, req.params.vmId);
      res.json({ success: true, message: '虚拟机重启成功' });
    } catch (error) {
      logger.error('❌ 重启虚拟机失败:', error);
      res.status(500).json({ success: false, error: '重启虚拟机失败' });
    }
  },
);

export default router;
