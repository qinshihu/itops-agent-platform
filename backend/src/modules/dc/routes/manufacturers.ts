import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

/**
 * GET /manufacturers — 获取全部制造商列表
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const list = dcCrudService.devices.listManufacturersOrdered();
    res.json({ success: true, data: list });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * GET /manufacturers/:id — 获取单个制造商（含设备型号数量）
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const mfg = dcCrudService.devices.getManufacturerById(req.params.id);
    if (!mfg) return res.status(404).json({ success: false, message: 'Manufacturer not found' });
    const typeCount = dcCrudService.devices.countDeviceTypesByManufacturer(req.params.id);
    res.json({ success: true, data: { ...mfg, device_type_count: typeCount } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * POST /manufacturers — 创建制造商
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, slug, description, logo_url, sort_order } = req.body;
    if (!name || !slug) return res.status(400).json({ success: false, message: 'name and slug required' });
    const id = crypto.randomUUID();
    dcCrudService.devices.createManufacturer({ id, name, slug, description, logo_url, sort_order });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * PUT /manufacturers/:id — 更新制造商
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, slug, description, logo_url, sort_order } = req.body;
    dcCrudService.devices.updateManufacturer(req.params.id, { id: req.params.id, name, slug, description, logo_url, sort_order });
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * DELETE /manufacturers/:id — 删除制造商（有关联设备型号时禁止删除）
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const typeCount = dcCrudService.devices.countDeviceTypesByManufacturer(req.params.id);
    if (typeCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete manufacturer with ${typeCount} associated device type(s)`
      });
    }
    dcCrudService.devices.deleteManufacturer(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
