import { Client } from 'ssh2';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';
import { createVendorAdapter, VendorType, InspectionType } from './vendorAdapter';
import { decrypt } from './encryptionService';

// ================================================================
// LLDP/CDP 邻居发现拓扑服务
//
// 用途：
// 1. 自动发现网络拓扑，构建链路图
// 2. 告警触发后快速定位故障影响范围
// 3. 定期刷新拓扑状态
// ================================================================

export interface NeighborEntry {
  localInterface: string;
  remoteDevice: string;
  remoteInterface: string;
  remotePlatform?: string;
  remoteMgmtIP?: string;
  protocol: 'lldp' | 'cdp';
  vlan?: number;
}

export interface TopologyLink {
  id: string;
  deviceA_id: string;
  deviceA_name: string;
  deviceA_interface: string;
  deviceB_id: string;
  deviceB_name: string;
  deviceB_interface: string;
  neighbors: NeighborEntry[];
  last_seen_at: string;
  status: 'active' | 'stale';
}

class LldpDiscoveryService {

  /**
   * 对单台设备执行 LLDP/CDP 邻居发现
   */
  async discoverNeighbors(deviceId: string): Promise<NeighborEntry[]> {
    const device = this.getDeviceById(deviceId);
    if (!device) throw new Error(`Device not found: ${deviceId}`);

    const adapter = createVendorAdapter(device.vendor as VendorType);
    const neighborTemplate = adapter.getCommand('neighbor');
    if (!neighborTemplate) {
      logger.warn(`Vendor ${device.vendor} has no neighbor discovery command`);
      return [];
    }

    try {
      // 通过 SSH 执行邻居发现命令
      const output = await this.executeSSHCommand(
        device.ip_address,
        device.ssh_port,
        device.username,
        decrypt(device.password),
        neighborTemplate.command
      );

      // 解析邻居信息
      const neighbors = this.parseNeighborOutput(device.vendor as VendorType, output);

      // 保存到数据库
      this.saveNeighborEntries(deviceId, neighbors);

      // 尝试建立双向拓扑关联
      await this.buildTopologyLinks(device, neighbors);

      return neighbors;
    } catch (error: any) {
      logger.error(`LLDP discovery failed for ${device.name}: ${error.message}`);
      return [];
    }
  }

  /**
   * 批量发现多台设备的 LLDP 邻居
   */
  async batchDiscover(deviceIds: string[]): Promise<Record<string, NeighborEntry[]>> {
    const results: Record<string, NeighborEntry[]> = {};
    for (const id of deviceIds) {
      results[id] = await this.discoverNeighbors(id);
    }
    return results;
  }

  /**
   * 发现所有在线设备的 LLDP 邻居
   */
  async discoverAll(): Promise<Record<string, NeighborEntry[]>> {
    const devices = db.prepare(
      "SELECT id FROM network_devices WHERE status IN ('online', 'unknown')"
    ).all() as { id: string }[];

    return this.batchDiscover(devices.map(d => d.id));
  }

  /**
   * 获取拓扑链路（支持按设备过滤）
   */
  getTopologyLinks(deviceId?: string): TopologyLink[] {
    if (deviceId) {
      return db.prepare(`
        SELECT * FROM network_topology_links
        WHERE deviceA_id = ? OR deviceB_id = ?
        ORDER BY last_seen_at DESC
      `).all(deviceId, deviceId) as TopologyLink[];
    }
    return db.prepare(`
      SELECT * FROM network_topology_links
      WHERE status = 'active'
      ORDER BY last_seen_at DESC
    `).all() as TopologyLink[];
  }

  /**
   * 根据告警设备查找相邻设备（定位影响范围）
   */
  getAdjacentDevices(deviceId: string): string[] {
    const links = this.getTopologyLinks(deviceId);
    const adj = new Set<string>();
    for (const link of links) {
      if (link.deviceA_id === deviceId) adj.add(link.deviceB_id);
      if (link.deviceB_id === deviceId) adj.add(link.deviceA_id);
    }
    return Array.from(adj);
  }

  /**
   * 获取完整的设备影响路径（BFS 遍历，最多 3 跳）
   */
  getImpactPath(deviceId: string, maxHops: number = 3): string[] {
    const visited = new Set<string>();
    const queue: Array<{ id: string; hop: number }> = [{ id: deviceId, hop: 0 }];
    visited.add(deviceId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.hop >= maxHops) continue;

      const adj = this.getAdjacentDevices(current.id);
      for (const neighborId of adj) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, hop: current.hop + 1 });
        }
      }
    }

    return Array.from(visited);
  }

  // ── 私有方法 ──

  private getDeviceById(id: string): { name: string; ip_address: string; vendor: string; ssh_port: number; username: string; password: string } | undefined {
    return db.prepare(
      'SELECT id, name, ip_address, vendor, ssh_port, username, password FROM network_devices WHERE id = ?'
    ).get(id) as any;
  }

  private parseNeighborOutput(vendor: VendorType, output: string): NeighborEntry[] {
    const neighbors: NeighborEntry[] = [];
    const lines = output.split('\n');

    switch (vendor) {
      case 'huawei':
      case 'h3c': {
        // display lldp neighbor brief 输出格式：
        // LocalIntf   NeighborDev         NeighborIntf        Exptime
        // GE0/0/1     SW-CORE-01           GE0/0/24             120s
        let inData = false;
        for (const line of lines) {
          if (line.includes('LocalIntf') || line.includes('NeighborDev')) {
            inData = true;
            continue;
          }
          if (!inData || !line.trim()) continue;
          const parts = line.trim().split(/\s{2,}/);
          if (parts.length >= 3) {
            neighbors.push({
              localInterface: parts[0],
              remoteDevice: parts[1],
              remoteInterface: parts.length > 2 ? parts[2] : '',
              protocol: 'lldp',
            });
          }
        }
        break;
      }

      case 'cisco': {
        // show lldp neighbors detail
        let current: Partial<NeighborEntry> = {};
        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('Local Intf:')) current.localInterface = t.split(':')[1].trim();
          if (t.startsWith('Device ID:')) current.remoteDevice = t.split(':')[1].trim();
          if (t.startsWith('Port id:')) current.remoteInterface = t.split(':')[1].trim();
          if (t.startsWith('Platform:')) current.remotePlatform = t.split(':')[1].trim();
          if (t.startsWith('Management Addresses:')) {
            const ip = t.split(':')[1]?.trim();
            if (ip) current.remoteMgmtIP = ip;
          }
          // 一条记录结束
          if (t === '' && current.localInterface && current.remoteDevice) {
            neighbors.push({
              localInterface: current.localInterface,
              remoteDevice: current.remoteDevice,
              remoteInterface: current.remoteInterface || '',
              remotePlatform: current.remotePlatform,
              remoteMgmtIP: current.remoteMgmtIP,
              protocol: 'lldp',
            });
            current = {};
          }
        }
        if (current.localInterface && current.remoteDevice) {
          neighbors.push({
            localInterface: current.localInterface,
            remoteDevice: current.remoteDevice,
            remoteInterface: current.remoteInterface || '',
            remotePlatform: current.remotePlatform,
            remoteMgmtIP: current.remoteMgmtIP,
            protocol: 'lldp',
          });
        }
        break;
      }

      case 'fortinet': {
        // get lldp neighbors
        let current: Partial<NeighborEntry> = {};
        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('Port:')) current.localInterface = t.split(':')[1].trim();
          if (t.startsWith('Device:')) current.remoteDevice = t.split(':')[1].trim();
          if (t.startsWith('Port desc:')) current.remoteInterface = t.split(':')[1].trim();
          if (t.startsWith('Platform:')) current.remotePlatform = t.split(':')[1].trim();
          if (t === '' && current.localInterface && current.remoteDevice) {
            neighbors.push({ ...current, protocol: 'lldp' } as NeighborEntry);
            current = {};
          }
        }
        if (current.localInterface && current.remoteDevice) {
          neighbors.push({ ...current, protocol: 'lldp' } as NeighborEntry);
        }
        break;
      }

      default: {
        // 通用尝试：提取设备名和接口
        for (const line of lines) {
          const parts = line.trim().split(/\s{2,}/);
          if (parts.length >= 3 && !line.includes('Local') && !line.includes('Neighbor')) {
            neighbors.push({
              localInterface: parts[0],
              remoteDevice: parts[1],
              remoteInterface: parts[2],
              protocol: /cdp/i.test(output) ? 'cdp' : 'lldp',
            });
          }
        }
      }
    }

    return neighbors;
  }

  private saveNeighborEntries(deviceId: string, neighbors: NeighborEntry[]): void {
    // 先清除旧数据
    db.prepare('DELETE FROM network_lldp_neighbors WHERE device_id = ?').run(deviceId);

    const insert = db.prepare(`
      INSERT INTO network_lldp_neighbors (id, device_id, local_interface, remote_device_name, remote_interface, remote_platform, remote_mgmt_ip, protocol)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const n of neighbors) {
      insert.run(randomUUID(), deviceId, n.localInterface, n.remoteDevice, n.remoteInterface,
        n.remotePlatform || null, n.remoteMgmtIP || null, n.protocol);
    }

    logger.info(`Saved ${neighbors.length} neighbor entries for device ${deviceId}`);
  }

  private async buildTopologyLinks(device: any, neighbors: NeighborEntry[]): Promise<void> {
    for (const n of neighbors) {
      // 查找远程设备是否已管理
      const remoteDevice = db.prepare(
        "SELECT id, name FROM network_devices WHERE name = ? OR ip_address = ?"
      ).get(n.remoteDevice, n.remoteMgmtIP || '') as { id: string; name: string } | undefined;

      if (!remoteDevice) {
        // 远程设备未管理，记录为外部设备
        const existingExt = db.prepare(
          'SELECT id FROM network_external_devices WHERE name = ?'
        ).get(n.remoteDevice) as { id: string } | undefined;

        if (!existingExt) {
          db.prepare(`
            INSERT INTO network_external_devices (id, name, discovered_from_device_id, platform, management_ip, last_seen_at)
            VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
          `).run(randomUUID(), n.remoteDevice, device.id, n.remotePlatform || null, n.remoteMgmtIP || null);
        }
        continue;
      }

      // 双向链路：检查是否已存在
      const existingLink = db.prepare(`
        SELECT id FROM network_topology_links
        WHERE (deviceA_id = ? AND deviceB_id = ? AND deviceA_interface = ? AND deviceB_interface = ?)
           OR (deviceA_id = ? AND deviceB_id = ? AND deviceA_interface = ? AND deviceB_interface = ?)
      `).get(
        device.id, remoteDevice.id, n.localInterface, n.remoteInterface,
        remoteDevice.id, device.id, n.remoteInterface, n.localInterface
      ) as { id: string } | undefined;

      if (existingLink) {
        db.prepare(`
          UPDATE network_topology_links SET status = 'active', last_seen_at = datetime('now','localtime')
          WHERE id = ?
        `).run(existingLink.id);
      } else {
        db.prepare(`
          INSERT INTO network_topology_links (id, deviceA_id, deviceA_name, deviceA_interface, deviceB_id, deviceB_name, deviceB_interface, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `).run(randomUUID(), device.id, device.name, n.localInterface, remoteDevice.id, remoteDevice.name, n.remoteInterface);

        logger.info(`New topology link: ${device.name}:${n.localInterface} <-> ${remoteDevice.name}:${n.remoteInterface}`);
      }
    }
  }

  /**
   * 通过 SSH 在网络设备上执行命令
   */
  private executeSSHCommand(host: string, port: number, username: string, password: string, command: string, timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let isResolved = false;
      let cmdTimeout: NodeJS.Timeout | null = null;

      const done = (err: Error | null, output?: string) => {
        if (isResolved) return;
        isResolved = true;
        if (cmdTimeout) clearTimeout(cmdTimeout);
        try { conn.end(); } catch { /* ignore */ }
        if (err) reject(err);
        else resolve(output || '');
      };

      cmdTimeout = setTimeout(() => done(new Error('SSH command timeout')), timeout);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) return done(new Error(`SSH exec: ${err.message}`));

          let stdout = '';
          let stderr = '';

          stream.on('data', (data: Buffer) => { stdout += data.toString(); });
          stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
          stream.on('close', (code: number | null) => {
            done(null, stdout || stderr);
          });
          stream.on('error', (e: any) => done(e));
        });
      });

      conn.on('error', (e: any) => done(e));

      conn.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 10000,
        keepaliveInterval: 10000,
      });
    });
  }
}

export const lldpDiscoveryService = new LldpDiscoveryService();
