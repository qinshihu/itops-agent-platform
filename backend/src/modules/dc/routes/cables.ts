/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /cables — 获取线缆列表
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const deviceId = req.query.device_id as string | undefined;
    const status = req.query.status as string | undefined;
    const list = dcCrudService.cables.list({ deviceId, status });
    res.json({ success: true, data: list });
  } catch (error: unknown) {
    logger.error('Failed to operate dc cables', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
    }
  });

/**
 * GET /cables/scene — 获取带 3D 坐标的全部线缆（供 DataRoom3D Scene 使用）
 * 每条线缆的 a_position 和 b_position 基于机柜位置+U位计算
 */
router.get('/scene', (_req: Request, res: Response) => {
  try {
    const PER_U = 0.04445;
    const RACK_W = 2.3;

    const racks = dcCrudService.racks.listForTopology();
    const rackPosMap: Record<string, { x: number; z: number; baseY: number }> = {};
    for (const r of racks) {
      rackPosMap[r.id] = { x: r.position_x || 0, z: r.position_z || 0, baseY: 0 };
    }

    const slots = dcCrudService.slots.listAssignedWithPosition();
    const deviceRackMap: Record<string, { rackId: string; startU: number; endU: number }> = {};
    for (const sl of slots) {
      const s = sl as { device_id: string; rack_id: string; start_u: number; end_u: number };
      deviceRackMap[s.device_id] = { rackId: s.rack_id, startU: s.start_u, endU: s.end_u };
    }

    const cables = dcCrudService.cables.listForScene();

    const result = cables.map(c => {
      const cRec = c as { a_device_id: string; b_device_id: string; name?: string; cable_type?: string;
        cable_color?: string; status?: string; a_port_name?: string; b_port_name?: string;
        a_device_name?: string; b_device_name?: string; id: string };
      const aDev = deviceRackMap[cRec.a_device_id];
      const bDev = deviceRackMap[cRec.b_device_id];
      const aRack = aDev ? rackPosMap[aDev.rackId] : null;
      const bRack = bDev ? rackPosMap[bDev.rackId] : null;

      const aPos: [number, number, number] = aRack
        ? [aRack.x + RACK_W / 2 + 0.3, aDev.startU * PER_U, aRack.z]
        : [0, 0, 0];
      const bPos: [number, number, number] = bRack
        ? [bRack.x + RACK_W / 2 + 0.3, bDev.startU * PER_U, bRack.z]
        : [0, 0, 0];

      return {
        id: cRec.id,
        name: cRec.name || '',
        cable_type: cRec.cable_type || 'cat6',
        cable_color: cRec.cable_color || '',
        status: cRec.status || 'connected',
        a_device_id: cRec.a_device_id,
        a_device_name: cRec.a_device_name || cRec.a_device_id,
        a_port_name: cRec.a_port_name || '',
        b_device_id: cRec.b_device_id,
        b_device_name: cRec.b_device_name || cRec.b_device_id,
        b_port_name: cRec.b_port_name || '',
        a_position: aPos,
        b_position: bPos,
      };
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error('Failed to operate dc cables', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * GET /cables/topology/:rackId — 获取某个机柜内所有设备的连接拓扑
 * 用于 3D 场景中的线缆渲染
 */
router.get('/topology/:rackId', (req: Request, res: Response) => {
  try {
    const rackId = req.params.rackId;
    const devices = dcCrudService.slots.listDevicesByRack(rackId);
    const deviceIds = devices.map(d => (d as { device_id: string }).device_id);
    let cables: any[] = [];
    if (deviceIds.length > 0) {
      cables = dcCrudService.cables.listConnectedByDeviceIds(deviceIds);
    }
    res.json({ success: true, data: { devices, cables } });
  } catch (error: unknown) {
    logger.error('Failed to operate dc cables', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * POST /cables — 创建线缆连接
 */
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, cable_type, cable_color, length_m, status,
            a_device_id, a_device_type, a_port_name,
            b_device_id, b_device_type, b_port_name, description } = req.body;
    if (!a_device_id || !b_device_id) {
      return res.status(400).json({ success: false, message: 'a_device_id and b_device_id required' });
    }
    const id = crypto.randomUUID();
    dcCrudService.cables.create({
      id, name, cable_type, cable_color, length_m, status,
      a_device_id, a_device_type, a_port_name,
      b_device_id, b_device_type, b_port_name, description,
    });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    logger.error('Failed to operate dc cables', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * PUT /cables/:id — 更新线缆
 */
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, cable_type, cable_color, length_m, status, description } = req.body;
    dcCrudService.cables.update(req.params.id, { name, cable_type, cable_color, length_m, status, description });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc cables', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * DELETE /cables/:id — 删除线缆
 */
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    dcCrudService.cables.delete(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc cables', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
