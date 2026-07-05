import type { Request, Response } from 'express';
import { Router } from 'express';
import { dcRepository } from '../../repositories';
import { getErrorMessage } from '../../utils/errorHelpers';

const router = Router();

// GET /devices — 按机房/机柜分组的设备分布（供设备分布Tab）
router.get('/', (_req: Request, res: Response) => {
  try {
    const rooms = dcRepository.rooms.list();
    const groups = rooms.map(room => {
      const racks = dcRepository.racks.list({ roomId: (room as { id: string }).id });
      const rackMap: Record<string, unknown> = {};
      for (const rack of racks) {
        const r = rack as { id: string; name: string };
        // 获取该机柜下的设备（带 device_info）
        const slots = dcRepository.slots.listByRackWithDeviceInfo(r.id);
        const devices = slots
          .filter(s => (s as { device_id?: string }).device_id)
          .map(s => ({
            slot_id: (s as { id: string }).id,
            device_id: (s as { device_id: string }).device_id,
            device_name: (s as { device_name?: string }).device_name ?? (s as { device_id: string }).device_id,
            device_type: (s as { device_type?: string }).device_type,
            start_u: (s as { start_u: number }).start_u,
            end_u: (s as { end_u: number }).end_u,
            ip_address: (s as { ip_address?: string }).ip_address ?? '',
            server_status: (s as { device_status?: string }).device_status,
          }));
        rackMap[r.name] = {
          rack_id: r.id, rack_name: r.name,
          devices,
        };
      }
      const rm = room as { id: string; label?: string; name: string };
      return { room_id: rm.id, room_name: rm.label || rm.name, racks: rackMap };
    });

    res.json({ success: true, data: { groups } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /devices/unallocated — 获取未分配的设备
router.get('/unallocated', (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const assignedRows = dcRepository.slots.listAssignedDeviceIds();
    const assignedIds = assignedRows.map(r => r.device_id);

    const servers = dcRepository.devices.listUnallocatedServers({ assignedIds, search });
    const netDevs = dcRepository.devices.listUnallocatedNetworkDevices({ assignedIds, search });
    const vms = dcRepository.devices.listUnallocatedVms({ assignedIds, search });

    const combined = [...servers, ...netDevs, ...vms].slice(0, 200);
    res.json({ success: true, data: combined });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
