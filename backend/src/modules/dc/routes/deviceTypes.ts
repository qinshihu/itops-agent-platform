import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

/**
 * GET /device-types — 获取设备型号列表（可附带 manufacturer 信息）
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const manufacturerId = req.query.manufacturer_id as string | undefined;
    const list = dcCrudService.devices.listDeviceTypesWithManufacturer({ manufacturerId });
    res.json({ success: true, data: list });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * GET /device-types/:id — 获取单个型号（含槽位定义和关联设备数量）
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const dt = dcCrudService.devices.getDeviceTypeById(req.params.id);
    if (!dt) return res.status(404).json({ success: false, message: 'Device type not found' });

    const slots = dcCrudService.devices.listSlotDefinitions(req.params.id);
    const instanceCount = dcCrudService.slots.countByDeviceTypeId(req.params.id);

    res.json({
      success: true,
      data: {
        ...dt,
        slot_definitions: slots,
        instance_count: instanceCount,
      }
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * POST /device-types — 创建设备型号
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { manufacturer_id, model, slug, part_number, u_height, is_full_depth,
            subdevice_role, airflow, weight_kg, max_power_w, description } = req.body;
    if (!manufacturer_id || !model || !slug) {
      return res.status(400).json({ success: false, message: 'manufacturer_id, model, slug required' });
    }
    const id = crypto.randomUUID();
    dcCrudService.devices.createDeviceType({
      id, manufacturer_id, model, slug, part_number, u_height, is_full_depth,
      subdevice_role, airflow, weight_kg, max_power_w, description,
    });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * PUT /device-types/:id — 更新设备型号
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { manufacturer_id, model, slug, part_number, u_height, is_full_depth,
            subdevice_role, airflow, weight_kg, max_power_w, description } = req.body;
    dcCrudService.devices.updateDeviceType(req.params.id, {
      id: req.params.id, manufacturer_id, model, slug, part_number, u_height, is_full_depth,
      subdevice_role, airflow, weight_kg, max_power_w, description,
    });
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * DELETE /device-types/:id — 删除设备型号
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const cnt = dcCrudService.slots.countByDeviceTypeId(req.params.id);
    if (cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: ${cnt} device instance(s) still reference this type`
      });
    }
    dcCrudService.devices.deleteDeviceType(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
