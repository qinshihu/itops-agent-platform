/**
 * =============================================================================
 * 虚拟机管理 - 平台管理路由
 * =============================================================================
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { vmManagementService } from '../../services/vmManagement';
import type { HypervisorType, VMPlatformConfig } from '../../../../types/vmManagement';

const router = Router();

// 获取平台列表
router.get('/platforms', (req: Request, res: Response) => {
  try {
    const platforms = vmManagementService.listPlatformConfigs();
    res.json({ success: true, data: platforms });
  } catch (error) {
    logger.error('❌ 获取平台列表失败:', error);
    res.status(500).json({ success: false, error: '获取平台列表失败' });
  }
});

// 获取单个平台
router.get('/platforms/:platformId', (req: Request, res: Response) => {
  try {
    const platform = vmManagementService.getPlatformConfig(req.params.platformId);
    if (!platform) {
      return res.status(404).json({ success: false, error: '平台不存在' });
    }
    res.json({ success: true, data: platform });
  } catch (error) {
    logger.error('❌ 获取平台详情失败:', error);
    res.status(500).json({ success: false, error: '获取平台详情失败' });
  }
});

// 添加平台
router.post('/platforms', async (req: Request, res: Response) => {
  try {
    const { name, hypervisorType, host, port, username, password, config, tags } = req.body;
    
    if (!name || !hypervisorType || !host) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const platformData: Omit<VMPlatformConfig, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      hypervisorType: hypervisorType as HypervisorType,
      host,
      port: port ? parseInt(port) : undefined,
      username,
      encryptedPassword: password,
      config,
      status: 'inactive',
      tags
    };
    
    const platform = await vmManagementService.addPlatform(platformData);
    res.json({ success: true, data: platform, message: '平台添加成功' });
  } catch (error) {
    logger.error('❌ 添加平台失败:', error);
    res.status(500).json({ success: false, error: '添加平台失败' });
  }
});

// 更新平台
router.put('/platforms/:platformId', async (req: Request, res: Response) => {
  try {
    const { platformId } = req.params;
    const platform = await vmManagementService.updatePlatform(platformId, req.body);
    res.json({ success: true, data: platform, message: '平台更新成功' });
  } catch (error) {
    logger.error('❌ 更新平台失败:', error);
    res.status(500).json({ success: false, error: '更新平台失败' });
  }
});

// 删除平台
router.delete('/platforms/:platformId', async (req: Request, res: Response) => {
  try {
    await vmManagementService.deletePlatform(req.params.platformId);
    res.json({ success: true, message: '平台删除成功' });
  } catch (error) {
    logger.error('❌ 删除平台失败:', error);
    res.status(500).json({ success: false, error: '删除平台失败' });
  }
});

// 测试平台连接
router.post('/platforms/:platformId/test', async (req: Request, res: Response) => {
  try {
    const result = await vmManagementService.testPlatformConnection(req.params.platformId);
    res.json({ success: result.success, message: result.message });
  } catch (error) {
    logger.error('❌ 测试平台连接失败:', error);
    res.status(500).json({ success: false, error: '测试平台连接失败' });
  }
});

export default router;