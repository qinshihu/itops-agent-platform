import db from '../../models/database';
import type { DcCable } from '../types/dc';

export interface CableCreateInput {
  id: string;
  name?: string;
  cable_type?: string;
  cable_color?: string;
  length_m?: number | null;
  status?: string;
  a_device_id: string;
  a_device_type?: string;
  a_port_name?: string;
  b_device_id: string;
  b_device_type?: string;
  b_port_name?: string;
  description?: string;
}

export interface CableUpdateInput {
  name?: string;
  cable_type?: string;
  cable_color?: string;
  length_m?: number | null;
  status?: string;
  description?: string;
}

export interface CableListFilters {
  deviceId?: string;
  status?: string;
}

export const cablesRepo = {
  delete(id: string): void {
    db.prepare('DELETE FROM dc_cables WHERE id = ?').run(id);
  },

  /** 线缆列表 + 双端设备名（多表 JOIN，cables.ts GET /） */
  list(filters: CableListFilters = {}): DcCable[] {
    let query = `
      SELECT c.*,
        COALESCE(s.name, nd.name, vm.name, pf.name, c.a_device_id) as a_device_name,
        COALESCE(s2.name, nd2.name, vm2.name, pf2.name, c.b_device_id) as b_device_name
      FROM dc_cables c
      LEFT JOIN servers s ON c.a_device_type='server' AND c.a_device_id = s.id
      LEFT JOIN servers s2 ON c.b_device_type='server' AND c.b_device_id = s2.id
      LEFT JOIN network_devices nd ON c.a_device_type='network_device' AND c.a_device_id = nd.id
      LEFT JOIN network_devices nd2 ON c.b_device_type='network_device' AND c.b_device_id = nd2.id
      LEFT JOIN virtual_machines vm ON c.a_device_type='vm_host' AND c.a_device_id = vm.id
      LEFT JOIN virtual_machines vm2 ON c.b_device_type='vm_host' AND c.b_device_id = vm2.id
      LEFT JOIN dc_power_feeds pf ON c.a_device_type='power_feed' AND c.a_device_id = pf.id
      LEFT JOIN dc_power_feeds pf2 ON c.b_device_type='power_feed' AND c.b_device_id = pf2.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters.deviceId) {
      query += ' AND (c.a_device_id = ? OR c.b_device_id = ?)';
      params.push(filters.deviceId, filters.deviceId);
    }
    if (filters.status) {
      query += ' AND c.status = ?';
      params.push(filters.status);
    }
    query += ' ORDER BY c.created_at DESC';
    return db.prepare(query).all(...params) as DcCable[];
  },

  /** 3D 场景用：仅 JOIN servers/network_devices，不含 power_feeds */
  listForScene(): DcCable[] {
    return db.prepare(`
      SELECT c.*,
        COALESCE(s1.name, nd1.name, '') as a_device_name,
        COALESCE(s2.name, nd2.name, '') as b_device_name
      FROM dc_cables c
      LEFT JOIN servers s1 ON c.a_device_type='server' AND c.a_device_id = s1.id
      LEFT JOIN servers s2 ON c.b_device_type='server' AND c.b_device_id = s2.id
      LEFT JOIN network_devices nd1 ON c.a_device_type='network_device' AND c.a_device_id = nd1.id
      LEFT JOIN network_devices nd2 ON c.b_device_type='network_device' AND c.b_device_id = nd2.id
      ORDER BY c.created_at DESC
    `).all() as DcCable[];
  },

  /** 按设备 ID 列表查询已连接的线缆（topology 用） */
  listConnectedByDeviceIds(deviceIds: string[]): DcCable[] {
    if (deviceIds.length === 0) return [];
    const placeholders = deviceIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT c.* FROM dc_cables c
      WHERE (c.a_device_id IN (${placeholders}) OR c.b_device_id IN (${placeholders}))
        AND c.status = 'connected'
      ORDER BY c.name
    `).all(...deviceIds, ...deviceIds) as DcCable[];
  },

  create(input: CableCreateInput): void {
    db.prepare(`
      INSERT INTO dc_cables (id, name, cable_type, cable_color, length_m, status,
        a_device_id, a_device_type, a_port_name,
        b_device_id, b_device_type, b_port_name, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.name ?? '', input.cable_type ?? 'cat6', input.cable_color ?? '',
      input.length_m ?? null, input.status ?? 'connected',
      input.a_device_id, input.a_device_type ?? 'server', input.a_port_name ?? '',
      input.b_device_id, input.b_device_type ?? 'network_device', input.b_port_name ?? '',
      input.description ?? ''
    );
  },

  update(id: string, input: CableUpdateInput): void {
    db.prepare(`
      UPDATE dc_cables SET name=?, cable_type=?, cable_color=?, length_m=?, status=?, description=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      input.name ?? '', input.cable_type ?? 'cat6', input.cable_color ?? '',
      input.length_m ?? null, input.status ?? 'connected', input.description ?? '', id
    );
  },
};
