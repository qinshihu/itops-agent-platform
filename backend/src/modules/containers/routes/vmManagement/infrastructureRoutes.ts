/**
 * =============================================================================
 * 虚拟机管理 - 监控与基础设施资源路由
 * =============================================================================
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { vmManagementService } from '../../services/vmManagement';

const router = Router();

// 获取虚拟机状态
router.get('/platforms/:platformId/vms/:vmId/stats', async (req: Request, res: Response) => {
  try {
    const stats = await vmManagementService.getVMStats(req.params.platformId, req.params.vmId);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('❌ 获取虚拟机状态失败:', error);
    res.status(500).json({ success: false, error: '获取虚拟机状态失败' });
  }
});

// 获取主机列表
router.get('/platforms/:platformId/hosts', async (req: Request, res: Response) => {
  try {
    const hosts = await vmManagementService.listHosts(req.params.platformId);
    res.json({ success: true, data: hosts });
  } catch (error) {
    logger.error('❌ 获取主机列表失败:', error);
    res.status(500).json({ success: false, error: '获取主机列表失败' });
  }
});

// 获取数据存储列表
router.get('/platforms/:platformId/datastores', async (req: Request, res: Response) => {
  try {
    const datastores = await vmManagementService.listDatastores(req.params.platformId);
    res.json({ success: true, data: datastores });
  } catch (error) {
    logger.error('❌ 获取数据存储列表失败:', error);
    res.status(500).json({ success: false, error: '获取数据存储列表失败' });
  }
});

// 获取网络列表
router.get('/platforms/:platformId/networks', async (req: Request, res: Response) => {
  try {
    const networks = await vmManagementService.listNetworks(req.params.platformId);
    res.json({ success: true, data: networks });
  } catch (error) {
    logger.error('❌ 获取网络列表失败:', error);
    res.status(500).json({ success: false, error: '获取网络列表失败' });
  }
});

export default router;