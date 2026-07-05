/**
 * SNMP 设备发现功能
 * 从 snmpService.ts 提取的网段扫描发现方法
 */

import { logger } from '../../../../utils/logger';
import type { SnmpVersion } from '../snmpTypes';

/**
 * 从网段自动发现 SNMP 设备（snmpwalk 联合发现）
 */
export async function discoverDevices(
  getSystemInfoFn: (
    host: string, port: number, version: SnmpVersion, community: string
  ) => Promise<{ sysName: string; sysDescr: string; sysUptime: number; sysLocation: string; sysContact: string }>,
  subnet: string, community = 'public', version: SnmpVersion = 'v2c', port = 161
): Promise<Array<{ ip: string; sysName: string; sysDescr: string }>> {
  // 简单实现：探索给定网段
  const results: Array<{ ip: string; sysName: string; sysDescr: string }> = [];

  if (!subnet) return results;

  // 解析网段
  const parts = subnet.split('/');
  if (parts.length !== 2) return results;

  const baseIP = parts[0].split('.').map(Number);
  const prefixLen = parseInt(parts[1], 10);

  // 只探索 /24 以上子网
  if (prefixLen < 24) return results;

  const hostCount = 2 ** (32 - prefixLen) - 2;
  if (hostCount > 254) return results; // 避免扫太大网段

  // 开始探索
  const base = (baseIP[0] << 24) + (baseIP[1] << 16) + (baseIP[2] << 8) + baseIP[3];
  const startBase = (base & ~((1 << (32 - prefixLen)) - 1)) + 1;

  for (let i = 1; i <= hostCount; i++) {
    const ipInt = startBase + i;
    const ip = `${(ipInt >>> 24) & 0xFF}.${(ipInt >>> 16) & 0xFF}.${(ipInt >>> 8) & 0xFF}.${ipInt & 0xFF}`;

    try {
      const sysInfo = await getSystemInfoFn(ip, port, version, community);
      if (sysInfo.sysName) {
        results.push({ ip, sysName: sysInfo.sysName, sysDescr: sysInfo.sysDescr });
        logger.info(`SNMP discovered: ${ip} (${sysInfo.sysName})`);
      }
    } catch {
      // ignore timeout / unreachable
    }
  }

  return results;
}