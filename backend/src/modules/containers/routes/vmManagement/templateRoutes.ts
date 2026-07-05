/**
 * =============================================================================
 * 虚拟机管理 - 模板管理路由
 * =============================================================================
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { vmManagementService } from '../../services/vmManagement';

const router = Router();

// 获取模板列表
router.get('/platforms/:platformId/templates', async (req: Request, res: Response) => {
  try {
    const templates = await vmManagementService.listTemplates(req.params.platformId);
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('❌ 获取模板列表失败:', error);
    res.status(500).json({ success: false, error: '获取模板列表失败' });
  }
});

// 创建模板
router.post('/platforms/:platformId/vms/:vmId/template', async (req: Request, res: Response) => {
  try {
    const template = await vmManagementService.createTemplate(req.params.platformId, req.params.vmId, req.body.name, req.body.description);
    res.json({ success: true, data: template, message: '模板创建成功' });
  } catch (error) {
    logger.error('❌ 创建模板失败:', error);
    res.status(500).json({ success: false, error: '创建模板失败' });
  }
});

// 删除模板
router.delete('/platforms/:platformId/templates/:templateId', async (req: Request, res: Response) => {
  try {
    await vmManagementService.deleteTemplate(req.params.platformId, req.params.templateId);
    res.json({ success: true, message: '模板删除成功' });
  } catch (error) {
    logger.error('❌ 删除模板失败:', error);
    res.status(500).json({ success: false, error: '删除模板失败' });
  }
});

export default router;