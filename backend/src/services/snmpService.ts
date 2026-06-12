import snmp from 'net-snmp';
import { decrypt } from './encryptionService';
import db from '../models/database';
import { logger } from '../utils/logger';
import {
  SYSTEM_OIDS,
  IF_MIB_OIDS,
  ENTITY_MIB_OIDS,
  LLDP_MIB_OIDS,
  VENDOR_OIDS,
  IANA_IF_TYPE,
  INTERFACE_THRESHOLDS,
} from './snmpOidRegistry';
import { VendorType } from './vendorAdapter';

// ================================================================
// 类型定义
// ================================================================

// net-snmp Counter64 类型值为 70
const SNMP_COUNTER64_TYPE = 70;

/** 将 Counter64 Buffer 字节转为 BigInt 的十进制字符串 */
function counter64BufferToString(buf: Buffer): string {
  if (buf.length === 0) return '0';
  let result = BigInt(0);
  for (const byte of buf) {
    result = (result << BigInt(8)) + BigInt(byte);
  }
  return result.toString();
}

/** 统一处理 SNMP 返回值：Counter64 转数字字符串，Buffer 转 UTF-8，其余不变 */
function normalizeSnmpValue(type: number | undefined, value: any): any {
  if (Buffer.isBuffer(value)) {
    if (type === SNMP_COUNTER64_TYPE) {
      return counter64BufferToString(value);
    }
    return value.toString('utf8');
  }
  return value;
}

export type SnmpVersion = 'v1' | 'v2c' | 'v3';

export interface SnmpCredential {
  id: string;
  device_id?: string;
  name: string;
  community?: string;      // v1/v2c
  snmp_user?: string;      // v3
  snmp_auth_protocol?: 'MD5' | 'SHA';
  snmp_auth_key?: string;
  snmp_priv_protocol?: 'DES' | 'AES';
  snmp_priv_key?: string;
  snmp_version: SnmpVersion;
  snmp_port: number;
}

export interface SnmpResult {
  oid: string;
  value: any;
  type?: number;
  typeName?: string;
}

export interface InterfaceInfo {
  index: number;
  name: string;
  descr: string;
  type: number;
  typeName: string;
  speed: number;          // bps
  mtu: number;
  mac: string;
  adminStatus: 'up' | 'down';
  operStatus: 'up' | 'down';
  alias: string;
  inOctets: number;
  outOctets: number;
  inErrors: number;
  outErrors: number;
  inUtilization: number;  // %
  outUtilization: number; // %
}

export interface DeviceHealth {
  sysName: string;
  sysDescr: string;
  sysUptime: number;
  sysLocation: string;
  sysContact: string;
  cpuUsage: number | null;
  memoryUsage: number | null;
  temperature: number | null;
  interfaceCount: number;
  interfacesUp: number;
  interfacesDown: number;
  interfaceHighUtil: number; // >80% interfaces
}

// ================================================================
// SNMP 服务
// ================================================================

class SnmpService {

  /**
   * 获取设备 SNMP 凭证
   */
  getCredential(deviceId: string): SnmpCredential | null {
    const row = db.prepare(
      'SELECT * FROM snmp_credentials WHERE device_id = ? ORDER BY snmp_version DESC LIMIT 1'
    ).get(deviceId) as any;
    if (!row) return null;

    return {
      id: row.id,
      device_id: row.device_id,
      name: row.name,
      community: decrypt(row.community),
      snmp_user: row.snmp_user,
      snmp_auth_protocol: row.snmp_auth_protocol,
      snmp_auth_key: row.snmp_auth_key ? decrypt(row.snmp_auth_key) : undefined,
      snmp_priv_protocol: row.snmp_priv_protocol,
      snmp_priv_key: row.snmp_priv_key ? decrypt(row.snmp_priv_key) : undefined,
      snmp_version: row.snmp_version,
      snmp_port: row.snmp_port || 161,
    };
  }

  /**
   * 获取默认凭证（全局 community string）
   */
  getDefaultCredential(): SnmpCredential | null {
    const row = db.prepare(
      'SELECT * FROM snmp_credentials WHERE device_id IS NULL LIMIT 1'
    ).get() as any;
    if (!row) return null;

    return {
      id: row.id,
      device_id: undefined,
      name: row.name,
      community: decrypt(row.community),
      snmp_version: row.snmp_version,
      snmp_port: row.snmp_port || 161,
    };
  }

  /**
   * 创建 SNMP Session
   */
  private createSession(host: string, port: number, version: SnmpVersion, community?: string,
    user?: string, authProtocol?: string, authKey?: string, privProtocol?: string, privKey?: string): snmp.Session {
    const options: any = {
      port,
      timeout: 10000,
      retries: 2,
      transport: 'udp4',
    };

    if (version === 'v3') {
      // SNMP v3: 使用 Session.createV3(target, user, options)
      const v3Options: any = { ...options, version: snmp.Version3 };
      if (authProtocol) v3Options.authProtocol = authProtocol;
      if (authKey) v3Options.authKey = authKey;
      if (privProtocol) v3Options.privProtocol = privProtocol;
      if (privKey) v3Options.privKey = privKey;
      return snmp.Session.createV3(host, user || '', v3Options);
    }

    // SNMP v1/v2c: community string 是第2个参数，options 是第3个
    // net-snmp 的 createSession(target, community, options) 的 version 仅接受 Version1 / Version2c
    options.version = version === 'v1' ? snmp.Version1 : snmp.Version2c;
    return snmp.createSession(host, community || 'public', options);
  }

  /**
   * 发起Session（自动获取凭证）
   */
  private getSessionForDevice(deviceId: string, host?: string, port?: number): { session: snmp.Session; credential: SnmpCredential } | null {
    const credential = this.getCredential(deviceId) || this.getDefaultCredential();
    if (!credential) {
      logger.warn(`No SNMP credential for device ${deviceId}`);
      return null;
    }

    const targetHost = host || credential.device_id || deviceId;
    const session = this.createSession(
      targetHost as string,
      port || credential.snmp_port || 161,
      credential.snmp_version,
      credential.community,
      credential.snmp_user,
      credential.snmp_auth_protocol,
      credential.snmp_auth_key,
      credential.snmp_priv_protocol,
      credential.snmp_priv_key,
    );

    return { session, credential };
  }

  /**
   * SNMP GET 单 OID
   */
  async get(host: string, port: number, version: SnmpVersion = 'v2c', community: string = 'public',
    user?: string, authProtocol?: string, authKey?: string, privProtocol?: string, privKey?: string,
    oid: string = SYSTEM_OIDS.sysName): Promise<SnmpResult | null> {
    return new Promise((resolve) => {
      const session = this.createSession(host, port, version, community, user, authProtocol, authKey, privProtocol, privKey);

      // net-snmp 的 get() 接受 string[]，内部创建 { oid: oidStr }
      session.get([oid], (error: any, varbinds: any) => {
        session.close();
        if (error) {
          resolve(null);
          return;
        }
        const v = varbinds?.[0];
        if (!v || snmp.isVarbindError(v)) {
          resolve(null);
          return;
        }
        resolve({
          oid: v.oid,
          value: normalizeSnmpValue(v.type, v.value),
          type: v.type,
          typeName: this.typeToString(v.type),
        });
      });
    });
  }

  /**
   * SNMP GET 多 OID
   */
  async getMultiple(host: string, port: number, version: SnmpVersion, community: string,
    oids: string[]): Promise<SnmpResult[]> {
    return new Promise((resolve) => {
      const session = this.createSession(host, port, version, community);
      // net-snmp 的 get() 接受 string[] (OID 字符串数组)
      session.get(oids, (error: any, results: any) => {
        session.close();
        if (error) {
          resolve([]);
          return;
        }

        const output: SnmpResult[] = [];
        for (let i = 0; i < results.length; i++) {
          const v = results[i];
          if (v && !snmp.isVarbindError(v)) {
            output.push({
              oid: v.oid,
              value: normalizeSnmpValue(v.type, v.value),
              type: v.type,
              typeName: this.typeToString(v.type),
            });
          }
        }
        resolve(output);
      });
    });
  }

  /**
   * SNMP WALK
   */
  async walk(host: string, port: number, version: SnmpVersion, community: string,
    oid: string, maxRepetitions: number = 25): Promise<SnmpResult[]> {
    return new Promise((resolve) => {
      const session = this.createSession(host, port, version, community);

      // net-snmp 的 walk 使用 feedCb（每批回调）+ doneCb（完成回调）模式
      const accumulator: SnmpResult[] = [];
      session.subtree(oid, maxRepetitions, (varbinds: any) => {
        for (const v of varbinds) {
          if (v && !snmp.isVarbindError(v)) {
            accumulator.push({
              oid: v.oid,
              value: normalizeSnmpValue(v.type, v.value),
              type: v.type,
              typeName: this.typeToString(v.type),
            });
          }
        }
        return false; // 继续遍历
      }, (error: any) => {
        session.close();
        if (error) {
          resolve([]);
          return;
        }
        resolve(accumulator);
      });
    });
  }

  /**
   * 获取系统基本信息
   */
  async getSystemInfo(host: string, port: number = 161, version: SnmpVersion = 'v2c', community: string = 'public'): Promise<{
    sysName: string;
    sysDescr: string;
    sysUptime: number;
    sysLocation: string;
    sysContact: string;
  }> {
    const results = await this.getMultiple(host, port, version, community, [
      SYSTEM_OIDS.sysName,
      SYSTEM_OIDS.sysDescr,
      SYSTEM_OIDS.sysUptime,
      SYSTEM_OIDS.sysLocation,
      SYSTEM_OIDS.sysContact,
    ]);

    const find = (oid: string) => results.find(r => r.oid === oid)?.value || '';

    return {
      sysName: find(SYSTEM_OIDS.sysName),
      sysDescr: find(SYSTEM_OIDS.sysDescr),
      sysUptime: Number(find(SYSTEM_OIDS.sysUptime)) || 0,
      sysLocation: find(SYSTEM_OIDS.sysLocation),
      sysContact: find(SYSTEM_OIDS.sysContact),
    };
  }

  /**
   * 获取接口列表（全量）
   */
  async getInterfaces(host: string, port: number = 161, version: SnmpVersion = 'v2c', community: string = 'public'): Promise<InterfaceInfo[]> {
    const walkScopes = [
      IF_MIB_OIDS.ifName,
      IF_MIB_OIDS.ifDescr,
      IF_MIB_OIDS.ifType,
      IF_MIB_OIDS.ifSpeed,
      IF_MIB_OIDS.ifMtu,
      IF_MIB_OIDS.ifPhysAddress,
      IF_MIB_OIDS.ifAdminStatus,
      IF_MIB_OIDS.ifOperStatus,
      IF_MIB_OIDS.ifAlias,
      IF_MIB_OIDS.ifHCInOctets,
      IF_MIB_OIDS.ifHCOutOctets,
      IF_MIB_OIDS.ifInErrors,
      IF_MIB_OIDS.ifOutErrors,
      IF_MIB_OIDS.ifHighSpeed,
      IF_MIB_OIDS.ifInOctets,
      IF_MIB_OIDS.ifOutOctets,
    ];

    // 并行 walk 所有维度
    const [names, descrs, types, speeds, mtus, macs, admins, opers, aliases,
      hcInOctets, hcOutOctets, inErrors, outErrors, highSpeeds,
      inOctets32, outOctets32] = await Promise.all(
        walkScopes.map(oid => this.walk(host, port, version, community, oid, 50))
      );

    // 构建 index → 值 映射
    const makeMap = (arr: SnmpResult[]) => {
      const map = new Map<number, string>();
      for (const r of arr) {
        const idx = this.getIfIndex(r.oid);
        if (idx !== null) map.set(idx, String(r.value));
      }
      return map;
    };

    const nameMap = makeMap(names);
    const descrMap = makeMap(descrs);
    const typeMap = makeMap(types);
    const speedMap = makeMap(speeds);
    const mtuMap = makeMap(mtus);
    const macMap = makeMap(macs);
    const adminMap = makeMap(admins);
    const operMap = makeMap(opers);
    const aliasMap = makeMap(aliases);
    const inOctetsHCMap = makeMap(hcInOctets);
    const outOctetsHCMap = makeMap(hcOutOctets);
    const inErrMap = makeMap(inErrors);
    const outErrMap = makeMap(outErrors);
    const highSpeedMap = makeMap(highSpeeds);
    const inOctets32Map = makeMap(inOctets32);
    const outOctets32Map = makeMap(outOctets32);

    // 合并所有 index
    const allIndexes = new Set<number>([
      ...names.map(r => this.getIfIndex(r.oid)).filter(Boolean) as number[],
      ...descrs.map(r => this.getIfIndex(r.oid)).filter(Boolean) as number[],
    ]);

    const interfaces: InterfaceInfo[] = [];

    for (const idx of allIndexes) {
      const speed = parseInt(speedMap.get(idx) || '0', 10);
      const highSpeed = parseInt(highSpeedMap.get(idx) || '0', 10);
      const effectiveSpeed = speed > 0 ? speed : highSpeed * 1_000_000; // highSpeed → bps

      const inOctets = BigInt(inOctetsHCMap.get(idx) || inOctets32Map.get(idx) || '0');
      const outOctets = BigInt(outOctetsHCMap.get(idx) || outOctets32Map.get(idx) || '0');

      // 模拟实时利用率（这里拿到的是累积值；真实需要两次采样间隔，当前给累积值参考）
      const inUtil = effectiveSpeed > 0 ? Math.min(100, Number(inOctets) * 8 / effectiveSpeed / 100 * 100) : 0;
      const outUtil = effectiveSpeed > 0 ? Math.min(100, Number(outOctets) * 8 / effectiveSpeed / 100 * 100) : 0;

      const adminStatus = adminMap.get(idx) === '1' ? 'up' : 'down';
      const operStatus = operMap.get(idx) === '1' ? 'up' : 'down';

      interfaces.push({
        index: idx,
        name: nameMap.get(idx) || `if${idx}`,
        descr: descrMap.get(idx) || '',
        type: parseInt(typeMap.get(idx) || '0', 10),
        typeName: IANA_IF_TYPE[parseInt(typeMap.get(idx) || '0', 10)] || 'unknown',
        speed: effectiveSpeed,
        mtu: parseInt(mtuMap.get(idx) || '1500', 10),
        mac: this.formatMac(macMap.get(idx) || ''),
        adminStatus: adminStatus as 'up' | 'down',
        operStatus: operStatus as 'up' | 'down',
        alias: aliasMap.get(idx) || '',
        inOctets: Number(inOctets),
        outOctets: Number(outOctets),
        inErrors: parseInt(inErrMap.get(idx) || '0', 10),
        outErrors: parseInt(outErrMap.get(idx) || '0', 10),
        inUtilization: 0, // 需两轮采样
        outUtilization: 0,
      });
    }

    return interfaces;
  }

  /**
   * 获取设备健康检查（用于设备列表状态刷新）
   */
  async healthCheck(deviceId: string, host?: string, port?: number): Promise<DeviceHealth | null> {
    const credential = this.getCredential(deviceId) || this.getDefaultCredential();
    if (!credential) return null;

    const device = db.prepare('SELECT id, name, ip_address, vendor FROM network_devices WHERE id = ?')
      .get(deviceId) as any;
    if (!device) return null;

    const targetHost = host || device.ip_address;
    const targetPort = port || credential.snmp_port || 161;
    const community = credential.community || 'public';

    // 并行获取系统信息、接口、厂商指标
    const [sysInfo, interfaces] = await Promise.all([
      this.getSystemInfo(targetHost, targetPort, credential.snmp_version, community).catch(() => null),
      this.getInterfaces(targetHost, targetPort, credential.snmp_version, community).catch(() => [] as InterfaceInfo[]),
    ]);

    // 获取厂商特定指标
    const vendorOids = VENDOR_OIDS[device.vendor as string];
    let cpuUsage: number | null = null;
    let memoryUsage: number | null = null;
    let temperature: number | null = null;

    if (vendorOids) {
      const vendorOidsList: string[] = [];
      if (vendorOids.cpuUsage) vendorOidsList.push(vendorOids.cpuUsage);
      if (vendorOids.cpu5sec) vendorOidsList.push(vendorOids.cpu5sec);
      if (vendorOids.memoryUsage) vendorOidsList.push(vendorOids.memoryUsage);

      if (vendorOidsList.length > 0) {
        const vendorMetrics = await this.getMultiple(targetHost, targetPort, credential.snmp_version, community, vendorOidsList);
        for (const m of vendorMetrics) {
          if (m.oid === vendorOids.cpuUsage || m.oid === vendorOids.cpu5sec) {
            cpuUsage = Number(m.value);
          }
          if (m.oid === vendorOids.memoryUsage) {
            memoryUsage = Number(m.value);
          }
        }
      }

      // 温度
      if (vendorOids.temperature && vendorOids.temperature.length > 0) {
        for (const tempOid of vendorOids.temperature) {
          const temps = await this.walk(targetHost, targetPort, credential.snmp_version, community, tempOid, 10);
          if (temps.length > 0) {
            const vals = temps.map(t => Number(t.value)).filter(v => v > 0);
            if (vals.length > 0) {
              temperature = Math.max(...vals);
              break;
            }
          }
        }
      }
    }

    const upIfs = interfaces.filter(i => i.operStatus === 'up');
    const highUtilIfs = interfaces.filter(i => i.inUtilization > 80 || i.outUtilization > 80);

    return {
      sysName: sysInfo?.sysName || '',
      sysDescr: sysInfo?.sysDescr || '',
      sysUptime: sysInfo?.sysUptime || 0,
      sysLocation: sysInfo?.sysLocation || '',
      sysContact: sysInfo?.sysContact || '',
      cpuUsage,
      memoryUsage,
      temperature,
      interfaceCount: interfaces.length,
      interfacesUp: upIfs.length,
      interfacesDown: interfaces.length - upIfs.length,
      interfaceHighUtil: highUtilIfs.length,
    };
  }

  /**
   * 测试设备 SNMP 连通性
   */
  async testConnection(host: string, port: number = 161, version: SnmpVersion = 'v2c', community: string = 'public'): Promise<boolean> {
    const result = await this.get(host, port, version, community, undefined, undefined, undefined, undefined, undefined, SYSTEM_OIDS.sysName);
    return result !== null && !!result.value;
  }

  /**
   * 从网段自动发现 SNMP 设备（snmpwalk 联合发现）
   */
  async discoverDevices(subnet: string, community: string = 'public', version: SnmpVersion = 'v2c', port: number = 161): Promise<Array<{ ip: string; sysName: string; sysDescr: string }>> {
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
        const sysInfo = await this.getSystemInfo(ip, port, version, community);
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

  // ── 辅助方法 ──

  private getIfIndex(oid: string): number | null {
    // OID 以 .1.3.6.1.2.1.2.2.1.X. 结尾，后面是 index
    const match = oid.match(/\.(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  private formatMac(raw: string): string {
    if (!raw || raw === '') return '';
    // 十六进制字符串转为 MAC 格式
    const hex = raw.replace(/^0x/i, '');
    const parts: string[] = [];
    for (let i = 0; i < hex.length && i < 12; i += 2) {
      parts.push(hex.substring(i, i + 2));
    }
    return parts.join(':').toUpperCase();
  }

  private typeToString(type?: number): string {
    const types: Record<number, string> = {
      0x00: 'Boolean',
      0x01: 'Integer',
      0x02: 'BitString',
      0x03: 'OctetString',
      0x04: 'Null',
      0x05: 'OID',
      0x06: 'ObjectDescr',
      0x07: 'External',
      0x08: 'Real',
      0x09: 'Enumerated',
      0x0A: 'UInt32',
      0x0B: 'IpAddress',
      0x0C: 'Counter32',
      0x0D: 'Gauge32',
      0x0E: 'TimeTicks',
      0x0F: 'Opaque',
      0x10: 'NetAddr',
      0x11: 'Counter64',
      0x12: 'UInt64',
    };
    return type !== undefined ? types[type] || 'Unknown' : 'Unknown';
  }
}

export const snmpService = new SnmpService();
