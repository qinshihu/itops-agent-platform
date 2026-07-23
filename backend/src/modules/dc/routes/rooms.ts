import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

// GET /rooms — 机房列表
router.get('/', (_req: Request, res: Response) => {
  try {
    const rooms = dcCrudService.rooms.list();
    res.json({ success: true, data: rooms });
  } catch (error: unknown) {
    logger.error('Failed to operate dc rooms', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /rooms — 创建机房
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, label, description, width_m, depth_m, sort_order } = req.body;
    const id = crypto.randomUUID();
    dcCrudService.rooms.create({ id, name, label, description, width_m, depth_m, sort_order });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    logger.error('Failed to operate dc rooms', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// PUT /rooms/:id — 更新机房
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, label, description, width_m, depth_m, layout_config, sort_order } = req.body;
    dcCrudService.rooms.update(req.params.id, { name, label, description, width_m, depth_m, layout_config, sort_order });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc rooms', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /rooms/:id — 删除机房（级联删除机柜 + U 位）
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    dcCrudService.rooms.delete(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc rooms', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
