/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';

import { getErrorMessage } from '../../../utils/errorHelpers';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

// GET /overview — DataRoom 3D 总览数据（聚合所有资产）
router.get('/', (_req: Request, res: Response) => {
  try {
    // 检查是否有数据
    const realRooms = dcCrudService.rooms.list() as any[];
    const realRackCount = dcCrudService.racks.count();
    const realSlotCount = dcCrudService.slots.count();
    const hasData = realRackCount > 0 || realSlotCount > 0;

    if (!hasData) {
      return res.json({
        success: true,
        data: {
          rooms: [],
          summary: {
            totalRacks: 0, totalDevices: 0, totalRooms: 0,
            onlineDevices: 0, warningDevices: 0, criticalDevices: 0, alertDevices: 0,
            totalPower: 0, coolingPower: 0, itPower: 0, pue: 0,
            avgTemp: 0, avgHumidity: 0,
          },
          rackData: [], slotData: [], isEmpty: true,
        }
      });
    }

    // 加载真实数据
    const rackData = dcCrudService.racks.listForOverview() as any[];
    const allSlots = dcCrudService.slots.listWithDeviceInfo() as any[];

    // 统计
    const rackCounts: Record<string, number> = {};
    const roomDeviceCounts: Record<string, number> = {};
    let totalDevices = 0, onlineDevices = 0, alertDevices = 0;
    const rackAlertMap: Record<string, number> = {};

    for (const slot of allSlots) {
      if (!slot.device_id) continue;
      totalDevices++;
      rackCounts[slot.rack_id] = (rackCounts[slot.rack_id] || 0) + 1;
      if (slot.server_status === 'online') onlineDevices++;

      // 告警检测：按服务器真实状态判断
      if (slot.server_status && slot.server_status !== 'online' && slot.server_status !== 'offline') {
        rackAlertMap[slot.rack_id] = (rackAlertMap[slot.rack_id] || 0) + 1;
        alertDevices++;
      }
    }

    for (const rack of rackData) {
      roomDeviceCounts[rack.room_id] = (roomDeviceCounts[rack.room_id] || 0) + (rackCounts[rack.id] || 0);
    }

    res.json({
      success: true,
      data: {
        rooms: realRooms,
        summary: {
          totalRooms: realRooms.length,
          totalRacks: rackData.length,
          totalDevices,
          onlineDevices,
          offlineDevices: totalDevices - onlineDevices,
          alertDevices,
          avgTemp: realRooms.reduce((s, r) => s + (r.current_temperature || 25), 0) / (realRooms.length || 1),
          avgHumidity: realRooms.reduce((s, r) => s + (r.current_humidity || 50), 0) / (realRooms.length || 1),
          pue: realRooms.length > 0 ? (realRooms.reduce((s, r) => s + (r.pue || 1.45), 0) / realRooms.length) : 1.45,
          totalPowerKw: realRooms.length > 0 ? realRooms.reduce((s, r) => s + (r.total_power_kw || 0), 0) : (totalDevices * 0.35),
        },
        rackData: rackData.map(r => ({
          ...r,
          device_count: rackCounts[r.id] || 0,
          alert_count: rackAlertMap[r.id] || 0,
        })),
        slotData: allSlots,
        isEmpty: false, isPartialMock: false,
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to operate dc overview', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
    }
  });

export default router;
