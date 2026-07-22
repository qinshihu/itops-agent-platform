import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// GET /pdus — PDU/UPS列表
router.get('/', (_req: Request, res: Response) => {
  try {
    const pdus = dcCrudService.pdus.listWithRack();
    res.json({ success: true, data: pdus });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /pdus — 创建PDU/UPS
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, type, status, rack_id, power_capacity_w, current_load_w, input_voltage, output_sockets, model, ip_address, snmp_community, notes } = req.body;
    const id = crypto.randomUUID();
    dcCrudService.pdus.create({
      id, name, type, status, rack_id, power_capacity_w, current_load_w,
      input_voltage, output_sockets, model, ip_address, snmp_community, notes,
    });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// PUT /pdus/:id — 更新PDU/UPS
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, type, status, rack_id, power_capacity_w, current_load_w, input_voltage, output_sockets, model, ip_address, snmp_community, notes } = req.body;
    dcCrudService.pdus.update(req.params.id, {
      id: req.params.id, name, type, status, rack_id, power_capacity_w, current_load_w,
      input_voltage, output_sockets, model, ip_address, snmp_community, notes,
    });
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /pdus/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    dcCrudService.pdus.delete(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
