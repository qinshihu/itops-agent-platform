import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { DcSlotBusinessError } from '../services/dcSlotService';
import { Router } from 'express';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

// GET /slots — 所有U位数据（DataRoom 3D调用）
router.get('/', (_req: Request, res: Response) => {
  try {
    const slots = dcCrudService.slots.listWithDeviceInfo();
    res.json({ success: true, data: slots });
  } catch (error: unknown) {
    logger.error('Failed to operate dc slots', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /slots/batch — DataRoom 3D 聚合接口：一次性返回 slots + racks + rooms
// 前端 useDataRoom.ts L92 消费；必须在 /:rackId 之前声明（Express 路由按声明顺序匹配）
router.get('/batch', (_req: Request, res: Response) => {
  try {
    const slots = dcCrudService.slots.listWithDeviceInfo();
    const racks = dcCrudService.racks.list();
    const rooms = dcCrudService.rooms.list();
    res.json({ success: true, data: { slots, racks, rooms } });
  } catch (error: unknown) {
    logger.error('Failed to operate dc slots', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /slots/:rackId — 按机柜获取U位
router.get('/:rackId', (req: Request, res: Response) => {
  try {
    const slots = dcCrudService.slots.listByRackWithDeviceInfo(req.params.rackId);
    res.json({ success: true, data: slots });
  } catch (error: unknown) {
    logger.error('Failed to operate dc slots', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /slots — 分配U位（2026-07-23 改调 dcSlotService.assignSlot，业务规则下沉到 service）
router.post('/', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const result = await dcCrudService.slotsBusiness.assignSlot({
      rack_id: req.body.rack_id,
      device_id: req.body.device_id,
      device_type: req.body.device_type,
      device_type_id: req.body.device_type_id,
      start_u: req.body.start_u,
      end_u: req.body.end_u,
      position_face: req.body.position_face,
      lifecycle_notes: req.body.lifecycle_notes,
    });
    res.json({ success: true, data: { id: result.id, end_u: result.end_u } });
  } catch (error: unknown) {
    if (error instanceof DcSlotBusinessError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logger.error('Failed to assign slot:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// PUT /slots/:id — 更新/移位U位（2026-07-23 改调 dcSlotService.moveSlot）
router.put('/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    await dcCrudService.slotsBusiness.moveSlot({
      id: req.params.id,
      rack_id: req.body.rack_id,
      start_u: req.body.start_u,
      end_u: req.body.end_u,
      position_face: req.body.position_face,
      lifecycle_notes: req.body.lifecycle_notes,
    });
    res.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof DcSlotBusinessError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logger.error('Failed to move slot:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /slots/:id — 移除U位（2026-07-23 改调 dcSlotService.removeSlot）
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await dcCrudService.slotsBusiness.removeSlot(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof DcSlotBusinessError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logger.error('Failed to remove slot:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
