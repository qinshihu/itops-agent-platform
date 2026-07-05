/**
 * networkDeviceRepository — LLDP / 拓扑操作
 *
 * 取代 lldpDiscoveryService.ts 中散落的 db.prepare 调用。
 */

import db from '../../models/database';
import type { NetworkTopologyLink } from '../types/network';

export const networkDeviceLldpRepo = {
  // ── LLDP / Topology ──

  /** 按 ID 获取设备（含 vendor，LLDP 发现用） */
  getByIdWithVendorAndCreds(id: string): { id: string; name: string; ip_address: string; vendor: string; ssh_port: number; username: string | null; password: string | null } | undefined {
    return db.prepare('SELECT id, name, ip_address, vendor, ssh_port, username, password FROM network_devices WHERE id = ?')
      .get(id) as { id: string; name: string; ip_address: string; vendor: string; ssh_port: number; username: string | null; password: string | null } | undefined;
  },

  /** 清除设备 LLDP 邻居 */
  clearLldpNeighbors(deviceId: string): void {
    db.prepare('DELETE FROM network_lldp_neighbors WHERE device_id = ?').run(deviceId);
  },

  /** 插入 LLDP 邻居 */
  insertLldpNeighbor(neighbor: {
    id: string; device_id: string; local_interface: string; remote_device_name: string;
    remote_interface: string; remote_platform?: string | null; remote_mgmt_ip?: string | null; protocol: string;
  }): void {
    db.prepare(`
      INSERT INTO network_lldp_neighbors (id, device_id, local_interface, remote_device_name, remote_interface, remote_platform, remote_mgmt_ip, protocol)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(neighbor.id, neighbor.device_id, neighbor.local_interface, neighbor.remote_device_name,
      neighbor.remote_interface, neighbor.remote_platform ?? null, neighbor.remote_mgmt_ip ?? null, neighbor.protocol);
  },

  /** 按 name 或 IP 查找外部设备 */
  getExternalDeviceByName(name: string): { id: string } | undefined {
    return db.prepare('SELECT id FROM network_external_devices WHERE name = ?').get(name) as { id: string } | undefined;
  },

  /** 插入外部设备 */
  insertExternalDevice(input: {
    id: string; name: string; discovered_from_device_id: string; platform?: string | null; management_ip?: string | null;
  }): void {
    db.prepare(`
      INSERT INTO network_external_devices (id, name, discovered_from_device_id, platform, management_ip, last_seen_at)
      VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(input.id, input.name, input.discovered_from_device_id, input.platform ?? null, input.management_ip ?? null);
  },

  /** 查找拓扑链路（双向匹配） */
  findTopologyLink(deviceA_id: string, deviceB_id: string, deviceA_iface: string, deviceB_iface: string): { id: string } | undefined {
    return db.prepare(`
      SELECT id FROM network_topology_links
      WHERE (deviceA_id = ? AND deviceB_id = ? AND deviceA_interface = ? AND deviceB_interface = ?)
         OR (deviceA_id = ? AND deviceB_id = ? AND deviceA_interface = ? AND deviceB_interface = ?)
    `).get(deviceA_id, deviceB_id, deviceA_iface, deviceB_iface, deviceB_id, deviceA_id, deviceB_iface, deviceA_iface) as { id: string } | undefined;
  },

  /** 刷新现有拓扑链路状态 */
  refreshTopologyLink(id: string): void {
    db.prepare(`
      UPDATE network_topology_links SET status = 'active', last_seen_at = datetime('now','localtime')
      WHERE id = ?
    `).run(id);
  },

  /** 创建拓扑链路 */
  createTopologyLink(input: {
    id: string; deviceA_id: string; deviceA_name: string; deviceA_interface: string;
    deviceB_id: string; deviceB_name: string; deviceB_interface: string;
  }): void {
    db.prepare(`
      INSERT INTO network_topology_links (id, deviceA_id, deviceA_name, deviceA_interface, deviceB_id, deviceB_name, deviceB_interface, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(input.id, input.deviceA_id, input.deviceA_name, input.deviceA_interface, input.deviceB_id, input.deviceB_name, input.deviceB_interface);
  },

  /** 列出拓扑链路（可选按设备过滤） */
  listTopologyLinks(deviceId?: string): NetworkTopologyLink[] {
    if (deviceId) {
      return db.prepare(`
        SELECT * FROM network_topology_links
        WHERE deviceA_id = ? OR deviceB_id = ?
        ORDER BY last_seen_at DESC
      `).all(deviceId, deviceId) as NetworkTopologyLink[];
    }
    return db.prepare(`
      SELECT * FROM network_topology_links
      WHERE status = 'active'
      ORDER BY last_seen_at DESC
    `).all() as NetworkTopologyLink[];
  },
};