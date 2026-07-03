import type { Request, Response } from 'express';
import { Router } from 'express';
import crypto from 'crypto';
import { dcRepository } from '../../repositories';
import { getErrorMessage } from '../../utils/errorHelpers';

const router = Router();

// GET /rooms — 机房列表
router.get('/', (_req: Request, res: Response) => {
  try {
    const rooms = dcRepository.rooms.list();
    res.json({ success: true, data: rooms });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /rooms — 创建机房
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, label, description, width_m, depth_m, sort_order } = req.body;
    const id = crypto.randomUUID();
    dcRepository.rooms.create({ id, name, label, description, width_m, depth_m, sort_order });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// PUT /rooms/:id — 更新机房
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, label, description, width_m, depth_m, layout_config, sort_order } = req.body;
    dcRepository.rooms.update(req.params.id, { name, label, description, width_m, depth_m, layout_config, sort_order });
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /rooms/:id — 删除机房（级联删除机柜 + U 位）
router.delete('/:id', (req: Request, res: Response) => {
  try {
    dcRepository.rooms.delete(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
