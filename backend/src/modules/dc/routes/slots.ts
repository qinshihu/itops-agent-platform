import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// GET /slots — 所有U位数据（DataRoom 3D调用）
router.get('/', (_req: Request, res: Response) => {
  try {
    const slots = dcCrudService.slots.listWithDeviceInfo();
    res.json({ success: true, data: slots });
  } catch (error: unknown) {
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
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /slots/:rackId — 按机柜获取U位
router.get('/:rackId', (req: Request, res: Response) => {
  try {
    const slots = dcCrudService.slots.listByRackWithDeviceInfo(req.params.rackId);
    res.json({ success: true, data: slots });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /slots — 分配U位
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      rack_id,
      device_id,
      device_type,
      device_type_id,
      start_u,
      end_u,
      position_face,
      lifecycle_notes,
    } = req.body;

    // 检查冲突
    const conflict = dcCrudService.slots.findConflict(rack_id, start_u, end_u);
    if (conflict) {
      return res.status(409).json({ success: false, message: 'U位冲突：该U位已被占用' });
    }

    // 检查总U数
    const rack = dcCrudService.racks.getById(rack_id);
    if (rack && end_u > (rack.total_u ?? 42)) {
      return res
        .status(400)
        .json({ success: false, message: `超出机柜容量(最大${rack.total_u}U)` });
    }

    // 如果有 device_type_id，自动从型号继承 u_height
    let resolvedEndU = end_u;
    if (device_type_id) {
      const uHeight = dcCrudService.devices.getDeviceTypeUHeight(device_type_id);
      if (uHeight && uHeight > 0) {
        resolvedEndU = start_u + Math.ceil(uHeight) - 1;
      }
    }

    const id = crypto.randomUUID();
    dcCrudService.slots.create({
      id,
      rack_id,
      device_id,
      device_type,
      device_type_id,
      start_u,
      end_u: resolvedEndU,
      position_face,
    });

    // 生命周期记录
    dcCrudService.devices.createLifecycle({
      id: crypto.randomUUID(),
      device_id,
      device_type,
      action: 'mounted',
      to_rack_id: rack_id,
      to_slot_start: start_u,
      to_slot_end: end_u,
      notes: lifecycle_notes || '',
    });

    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// PUT /slots/:id — 更新/移位U位
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { rack_id, start_u, end_u, position_face, lifecycle_notes } = req.body;
    const oldSlot = dcCrudService.slots.getById(req.params.id);
    if (!oldSlot) return res.status(404).json({ success: false, message: 'U位记录不存在' });

    // 检查冲突（排除自身）
    const effectiveRackId = rack_id || oldSlot.rack_id;
    const conflict = dcCrudService.slots.findConflict(
      effectiveRackId,
      start_u,
      end_u,
      req.params.id,
    );
    if (conflict) {
      return res.status(409).json({ success: false, message: 'U位冲突' });
    }

    dcCrudService.slots.update(req.params.id, {
      rack_id: effectiveRackId,
      start_u,
      end_u,
      position_face,
    });

    // 记录生命周期
    if (rack_id && rack_id !== oldSlot.rack_id) {
      dcCrudService.devices.createLifecycle({
        id: crypto.randomUUID(),
        device_id: String(oldSlot.device_id ?? ''),
        device_type: String(oldSlot.device_type_id ?? ''),
        action: 'moved',
        from_rack_id: oldSlot.rack_id,
        to_rack_id: rack_id,
        from_slot_start: Number(oldSlot.start_u),
        from_slot_end: Number(oldSlot.end_u),
        to_slot_start: start_u,
        to_slot_end: end_u,
        notes: lifecycle_notes || '',
      });
    }

    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /slots/:id — 移除U位（下架设备）
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const slot = dcCrudService.slots.getById(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'U位记录不存在' });

    // 生命周期记录
    dcCrudService.devices.createLifecycle({
      id: crypto.randomUUID(),
      device_id: String(slot.device_id ?? ''),
      device_type: String(slot.device_type_id ?? ''),
      action: 'unmounted',
      from_rack_id: slot.rack_id,
      from_slot_start: Number(slot.start_u),
      from_slot_end: Number(slot.end_u),
      notes: '',
    });

    dcCrudService.slots.delete(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
