import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

// GET /racks — 机柜列表（可按机房/状态/搜索筛选）
router.get('/', (req: Request, res: Response) => {
  try {
    const roomId = (req.query.room_id as string) || '';
    const status = (req.query.status as string) || '';
    const search = (req.query.search as string) || '';
    const racks = dcCrudService.racks.list({ roomId, status, search });
    res.json({ success: true, data: racks });
  } catch (error: unknown) {
    logger.error('Failed to operate dc racks', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
    }
  });

// POST /racks — 创建机柜
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, room_id, row_number, total_u, sort_order, position_x, position_z } = req.body;
    const id = crypto.randomUUID();
    dcCrudService.racks.create({
      id, name, room_id,
      row_number, total_u, sort_order, position_x, position_z,
    });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    logger.error('Failed to operate dc racks', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// PUT /racks/:id — 更新机柜
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, room_id, row_number, total_u, status, sort_order, position_x, position_z } = req.body;
    dcCrudService.racks.update(req.params.id, {
      name, room_id, row_number, total_u, status, sort_order, position_x, position_z,
    });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc racks', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /racks/:id — 删除机柜
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    dcCrudService.racks.delete(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc racks', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
