import type { Request, Response } from 'express';
import { Router } from 'express';
import crypto from 'crypto';
import { dcRepository } from '../../repositories';
import { getErrorMessage } from '../../utils/errorHelpers';

const router = Router();

// GET /slots — 所有U位数据（DataRoom 3D调用）
router.get('/', (_req: Request, res: Response) => {
  try {
    const slots = dcRepository.slots.listWithDeviceInfo();
    res.json({ success: true, data: slots });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /slots/:rackId — 按机柜获取U位
router.get('/:rackId', (req: Request, res: Response) => {
  try {
    const slots = dcRepository.slots.listByRackWithDeviceInfo(req.params.rackId);
    res.json({ success: true, data: slots });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /slots — 分配U位
router.post('/', (req: Request, res: Response) => {
  try {
    const { rack_id, device_id, device_type, device_type_id, start_u, end_u, position_face, lifecycle_notes } = req.body;

    // 检查冲突
    const conflict = dcRepository.slots.findConflict(rack_id, start_u, end_u);
    if (conflict) {
      return res.status(409).json({ success: false, message: 'U位冲突：该U位已被占用' });
    }

    // 检查总U数
    const rack = dcRepository.racks.getById(rack_id);
    if (rack && end_u > (rack.total_u ?? 42)) {
      return res.status(400).json({ success: false, message: `超出机柜容量(最大${rack.total_u}U)` });
    }

    // 如果有 device_type_id，自动从型号继承 u_height
    let resolvedEndU = end_u;
    if (device_type_id) {
      const uHeight = dcRepository.devices.getDeviceTypeUHeight(device_type_id);
      if (uHeight && uHeight > 0) {
        resolvedEndU = start_u + Math.ceil(uHeight) - 1;
      }
    }

    const id = crypto.randomUUID();
    dcRepository.slots.create({
      id, rack_id, device_id, device_type, device_type_id, start_u, end_u: resolvedEndU, position_face,
    });

    // 生命周期记录
    dcRepository.devices.createLifecycle({
      id: crypto.randomUUID(), device_id, device_type, action: 'mounted',
      to_rack_id: rack_id, to_slot_start: start_u, to_slot_end: end_u, notes: lifecycle_notes || '',
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
    const oldSlot = dcRepository.slots.getById(req.params.id);
    if (!oldSlot) return res.status(404).json({ success: false, message: 'U位记录不存在' });

    // 检查冲突（排除自身）
    const effectiveRackId = rack_id || oldSlot.rack_id;
    const conflict = dcRepository.slots.findConflict(effectiveRackId, start_u, end_u, req.params.id);
    if (conflict) {
      return res.status(409).json({ success: false, message: 'U位冲突' });
    }

    dcRepository.slots.update(req.params.id, { rack_id: effectiveRackId, start_u, end_u, position_face });

    // 记录生命周期
    if (rack_id && rack_id !== oldSlot.rack_id) {
      dcRepository.devices.createLifecycle({
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
    const slot = dcRepository.slots.getById(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'U位记录不存在' });

    // 生命周期记录
    dcRepository.devices.createLifecycle({
      id: crypto.randomUUID(),
      device_id: String(slot.device_id ?? ''),
      device_type: String(slot.device_type_id ?? ''),
      action: 'unmounted',
      from_rack_id: slot.rack_id,
      from_slot_start: Number(slot.start_u),
      from_slot_end: Number(slot.end_u),
      notes: '',
    });

    dcRepository.slots.delete(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
