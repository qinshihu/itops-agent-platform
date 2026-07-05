import db from '../../models/database';
import type { DcRackSlot } from '../types/dc';

export interface SlotRecord {
  id: string;
  rack_id: string;
  start_u: number;
  end_u: number;
  device_id?: string;
  device_type_id?: string;
}

export interface SlotCreateInput {
  id: string;
  rack_id: string;
  device_id?: string | null;
  device_type?: string;
  device_type_id?: string | null;
  start_u: number;
  end_u: number;
  position_face?: string;
}

export interface SlotImportInput {
  id: string;
  rack_id: string;
  device_id?: string;
  device_type?: string;
  start_u: number;
  end_u: number;
  position_face?: string;
}

export interface SlotUpdateInput {
  rack_id: string;
  start_u: number;
  end_u: number;
  position_face?: string;
}

export const slotsRepo = {
  getById(id: string): SlotRecord | undefined {
    return db.prepare('SELECT * FROM dc_rack_slots WHERE id = ?').get(id) as SlotRecord | undefined;
  },

  listByRack(rackId: string): SlotRecord[] {
    return db.prepare('SELECT * FROM dc_rack_slots WHERE rack_id = ?').all(rackId) as SlotRecord[];
  },

  delete(id: string): void {
    db.prepare('DELETE FROM dc_rack_slots WHERE id = ?').run(id);
  },

  deleteByRack(rackId: string): void {
    db.prepare('DELETE FROM dc_rack_slots WHERE rack_id = ?').run(rackId);
  },

  count(): number {
    return (db.prepare('SELECT COUNT(*) as c FROM dc_rack_slots').get() as { c: number }).c;
  },

  /** 已分配设备的 slot 数（device_id IS NOT NULL） */
  countOccupied(): number {
    return (db.prepare('SELECT COUNT(*) as c FROM dc_rack_slots WHERE device_id IS NOT NULL').get() as { c: number }).c;
  },

  listAll(): SlotRecord[] {
    return db.prepare('SELECT * FROM dc_rack_slots').all() as SlotRecord[];
  },

  listAssignedDeviceIds(): Array<{ device_id: string }> {
    return db.prepare('SELECT DISTINCT device_id FROM dc_rack_slots').all() as Array<{ device_id: string }>;
  },

  /**
   * 全部 U 位 + 关联设备信息（servers/network_devices/virtual_machines）
   * 用于 slots.ts GET / 和 overview.ts
   */
  listWithDeviceInfo(): DcRackSlot[] {
    return db.prepare(`
      SELECT s.*,
        COALESCE(ser.name, nd.name, vm.name, s.device_id) as device_name,
        COALESCE(ser.ip_address, nd.ip_address, '') as ip_address,
        COALESCE(CASE WHEN ser.enabled = 1 THEN 'online' ELSE 'offline' END, nd.status, vm.status) as device_status,
        CASE WHEN ser.enabled = 1 THEN 'online' ELSE 'offline' END as server_status,
        ser.cpu_cores, (ser.memory_gb * 1000) as memory_mb,
        nd.status as net_status, vm.status as vm_status
      FROM dc_rack_slots s
      LEFT JOIN servers ser ON s.device_type='server' AND s.device_id = ser.id
      LEFT JOIN network_devices nd ON s.device_type='network_device' AND s.device_id = nd.id
      LEFT JOIN virtual_machines vm ON s.device_type='vm_host' AND s.device_id = vm.id
      ORDER BY s.rack_id, s.start_u
    `).all() as DcRackSlot[];
  },

  /** 按机柜列出 U 位 + 设备信息 */
  listByRackWithDeviceInfo(rackId: string): DcRackSlot[] {
    return db.prepare(`
      SELECT s.*,
        COALESCE(ser.name, nd.name, vm.name, s.device_id) as device_name,
        COALESCE(ser.ip_address, nd.ip_address, '') as ip_address,
        COALESCE(CASE WHEN ser.enabled = 1 THEN 'online' ELSE 'offline' END, nd.status, vm.status) as device_status
      FROM dc_rack_slots s
      LEFT JOIN servers ser ON s.device_type='server' AND s.device_id = ser.id
      LEFT JOIN network_devices nd ON s.device_type='network_device' AND s.device_id = nd.id
      LEFT JOIN virtual_machines vm ON s.device_type='vm_host' AND s.device_id = vm.id
      WHERE s.rack_id = ?
      ORDER BY s.start_u
    `).all(rackId) as DcRackSlot[];
  },

  /**
   * 列出机柜内的所有设备（用于线缆拓扑）
   * 返回 device_id, device_type, device_name, ip_address
   */
  listDevicesByRack(rackId: string): DcRackSlot[] {
    return db.prepare(`
      SELECT DISTINCT s.id as device_id, 'server' as device_type, s.name as device_name,
        COALESCE(s.ip_address, '') as ip_address
      FROM dc_rack_slots sl
      JOIN servers s ON sl.device_id = s.id
      WHERE sl.rack_id = ? AND sl.device_type = 'server'
      UNION
      SELECT DISTINCT nd.id, 'network_device', nd.name, COALESCE(nd.ip_address, '')
      FROM dc_rack_slots sl
      JOIN network_devices nd ON sl.device_id = nd.id
      WHERE sl.rack_id = ? AND sl.device_type = 'network_device'
    `).all(rackId, rackId) as DcRackSlot[];
  },

  /** cables.ts /scene 用：列出已分配设备的位置信息 */
  listAssignedWithPosition(): DcRackSlot[] {
    return db.prepare(`
      SELECT s.device_id, s.device_type, s.rack_id, s.start_u, s.end_u
      FROM dc_rack_slots s WHERE s.device_id IS NOT NULL AND s.device_id != ''
    `).all() as DcRackSlot[];
  },

  create(input: SlotCreateInput): void {
    db.prepare(`
      INSERT INTO dc_rack_slots (id, rack_id, device_id, device_type, device_type_id, start_u, end_u, position_face)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.rack_id, input.device_id, input.device_type,
      input.device_type_id ?? null, input.start_u, input.end_u, input.position_face ?? 'front'
    );
  },

  /** 导入用：不含 device_type_id */
  createForImport(input: SlotImportInput): void {
    db.prepare(`
      INSERT INTO dc_rack_slots (id, rack_id, device_id, device_type, start_u, end_u, position_face)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.rack_id, input.device_id, input.device_type,
      input.start_u, input.end_u, input.position_face ?? 'front'
    );
  },

  update(id: string, input: SlotUpdateInput): void {
    db.prepare(`
      UPDATE dc_rack_slots
      SET rack_id=?, start_u=?, end_u=?, position_face=?
      WHERE id=?
    `).run(input.rack_id, input.start_u, input.end_u, input.position_face ?? 'front', id);
  },

  /** U 位冲突检查（排除可选的自身 id） */
  findConflict(rackId: string, startU: number, endU: number, excludeId?: string): SlotRecord | undefined {
    if (excludeId) {
      return db.prepare(`
        SELECT * FROM dc_rack_slots
        WHERE rack_id = ? AND id != ? AND NOT (end_u < ? OR start_u > ?)
      `).get(rackId, excludeId, startU, endU) as SlotRecord | undefined;
    }
    return db.prepare(`
      SELECT * FROM dc_rack_slots
      WHERE rack_id = ? AND NOT (end_u < ? OR start_u > ?)
    `).get(rackId, startU, endU) as SlotRecord | undefined;
  },

  /** 统计使用某设备型号的 U 位数 */
  countByDeviceTypeId(deviceTypeId: string): number {
    return (db.prepare('SELECT COUNT(*) as cnt FROM dc_rack_slots WHERE device_type_id = ?').get(deviceTypeId) as { cnt: number }).cnt;
  },

  /** DC 状态推送：统计 online 服务器设备数 */
  countOnlineServerDevices(): number {
    return (db.prepare(`
      SELECT COUNT(*) as c FROM dc_rack_slots s
      LEFT JOIN servers ser ON s.device_type='server' AND s.device_id = ser.id
      WHERE ser.enabled = 1
    `).get() as { c: number }).c;
  },

  /** DC 状态推送：统计关联告警的设备数 */
  countAlertDevices(): number {
    return (db.prepare(`
      SELECT COUNT(DISTINCT a.id) as c
      FROM alerts a
      JOIN dc_rack_slots s ON s.device_id = a.device_id AND s.device_id IS NOT NULL
      WHERE a.status != 'resolved'
    `).get() as { c: number }).c;
  },
};
