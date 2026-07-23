/**
 * Alert Provider Config CRUD 路由（修复 /alerts/providers/configs 缺端点）
 *
 * 端点：
 *   GET    /alerts/providers/configs          列出所有配置
 *   POST   /alerts/providers/configs          新建配置
 *   PUT    /alerts/providers/configs/:id      更新配置
 *   DELETE /alerts/providers/configs/:id      删除配置
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../../../middleware/validation';
import { logger } from '../../../utils/logger';
import { alertProviderConfigService } from '../services/alertProviderConfigService';

const router = Router();

const createSchema = z.object({
  provider_id: z.string().min(1),
  name: z.string().min(1),
  config: z.record(z.unknown()),
  enabled: z.boolean(),
});

router.get('/configs', (_req: Request, res: Response) => {
  try {
    const configs = alertProviderConfigService.listConfigs();
    res.json({ success: true, data: configs });
  } catch (error) {
    logger.error('Failed to list alert provider configs', error);
    res.status(500).json({ success: false, error: 'Failed to list alert provider configs' });
  }
});

router.post('/configs', validateBody(createSchema), (req: Request, res: Response) => {
  try {
    const created = alertProviderConfigService.createConfig(req.body);
    res.json({ success: true, data: created });
  } catch (error) {
    logger.error('Failed to create alert provider config', error);
    res.status(500).json({ success: false, error: 'Failed to create alert provider config' });
  }
});

router.put(
  '/configs/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(createSchema),
  (req: Request, res: Response) => {
    try {
      const updated = alertProviderConfigService.updateConfig(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Alert provider config not found' });
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update alert provider config', error);
      res.status(500).json({ success: false, error: 'Failed to update alert provider config' });
    }
  },
);

router.delete(
  '/configs/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  (req: Request, res: Response) => {
    try {
      const ok = alertProviderConfigService.deleteConfig(req.params.id);
      if (!ok) {
        return res.status(404).json({ success: false, error: 'Alert provider config not found' });
      }
      res.json({ success: true, message: 'Alert provider config deleted' });
    } catch (error) {
      logger.error('Failed to delete alert provider config', error);
      res.status(500).json({ success: false, error: 'Failed to delete alert provider config' });
    }
  },
);

export default router;