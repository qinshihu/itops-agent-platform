/* eslint-disable @typescript-eslint/no-explicit-any */
import snmp from 'net-snmp';
import { decrypt } from '../../../auth/services/encryptionService';
import { logger } from '../../../../utils/logger';
import { snmpCredentialsRepo, networkDeviceRepository } from '../../../../repositories';
import {
  SYSTEM_OIDS,
  VENDOR_OIDS,
} from '../snmpOidRegistry';
import {
  normalizeSnmpValue as _normalizeSnmpValue,
  type SnmpVersion,
  type SnmpCredential,
  type SnmpResult,
  type InterfaceInfo,
  type DeviceHealth,
} from '../snmpTypes';
import { typeToString as _typeToString } from './snmpParser';
import {
  snmpGet,
  snmpGetMultiple,
  snmpWalk,
  getSystemInfo as getSystemInfoFn,
  getInterfaces as getInterfacesFn,
  snmpTestConnection,
} from './snmpCollector';
import { discoverDevices as discoverDevicesFn } from './snmpDiscovery';

// Re-export types for backward compatibility
export type { SnmpVersion, SnmpCredential, SnmpResult, InterfaceInfo, DeviceHealth };

// ================================================================
// SNMP 服务
// ================================================================

class SnmpService {

  /**
   * 获取设备 SNMP 凭证
   */
  getCredential(deviceId: string): SnmpCredential | null {
    const row = snmpCredentialsRepo.getByDeviceId(deviceId);
    if (!row) return null;

    return {
      id: row.id,
      device_id: row.device_id ?? undefined,
      name: row.name,
      community: row.community ? decrypt(row.community) : undefined,
      snmp_user: row.snmp_user ?? undefined,
      snmp_auth_protocol: row.snmp_auth_protocol as SnmpCredential['snmp_auth_protocol'],
      snmp_auth_key: row.snmp_auth_key ? decrypt(row.snmp_auth_key) : undefined,
      snmp_priv_protocol: row.snmp_priv_protocol as SnmpCredential['snmp_priv_protocol'],
      snmp_priv_key: row.snmp_priv_key ? decrypt(row.snmp_priv_key) : undefined,
      snmp_version: row.snmp_version as SnmpVersion,
      snmp_port: row.snmp_port || 161,
    };
  }

  /**
   * 获取默认凭证（全局 community string）
   */
  getDefaultCredential(): SnmpCredential | null {
    const row = snmpCredentialsRepo.getDefault();
    if (!row) return null;

    return {
      id: row.id,
      device_id: undefined,
      name: row.name,
      community: row.community ? decrypt(row.community) : undefined,
      snmp_version: row.snmp_version as SnmpVersion,
      snmp_port: row.snmp_port || 161,
    };
  }

  /**
   * 创建 SNMP Session
   */
  createSession(host: string, port: number, version: SnmpVersion, community?: string,
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
  getSessionForDevice(deviceId: string, host?: string, port?: number): { session: snmp.Session; credential: SnmpCredential } | null {
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
   * SNMP GET 单 OID（委托给 collectors）
   */
  async get(host: string, port: number, version: SnmpVersion = 'v2c', community = 'public',
    user?: string, authProtocol?: string, authKey?: string, privProtocol?: string, privKey?: string,
    oid: string = SYSTEM_OIDS.sysName): Promise<SnmpResult | null> {
    return snmpGet(
      this.createSession.bind(this),
      host, port, version, community,
      user, authProtocol, authKey, privProtocol, privKey,
      oid
    );
  }

  /**
   * SNMP GET 多 OID（委托给 collectors）
   */
  async getMultiple(host: string, port: number, version: SnmpVersion, community: string,
    oids: string[]): Promise<SnmpResult[]> {
    return snmpGetMultiple(this.createSession.bind(this), host, port, version, community, oids);
  }

  /**
   * SNMP WALK（委托给 collectors）
   */
  async walk(host: string, port: number, version: SnmpVersion, community: string,
    oid: string, maxRepetitions = 25): Promise<SnmpResult[]> {
    return snmpWalk(this.createSession.bind(this), host, port, version, community, oid, maxRepetitions);
  }

  /**
   * 获取系统基本信息（委托给 collectors）
   */
  async getSystemInfo(host: string, port = 161, version: SnmpVersion = 'v2c', community = 'public'): Promise<{
    sysName: string;
    sysDescr: string;
    sysUptime: number;
    sysLocation: string;
    sysContact: string;
  }> {
    return getSystemInfoFn(this.createSession.bind(this), host, port, version, community);
  }

  /**
   * 获取接口列表（全量）（委托给 collectors）
   */
  async getInterfaces(host: string, port = 161, version: SnmpVersion = 'v2c', community = 'public'): Promise<InterfaceInfo[]> {
    return getInterfacesFn(this.createSession.bind(this), host, port, version, community);
  }

  /**
   * 获取设备健康检查（用于设备列表状态刷新）
   */
  async healthCheck(deviceId: string, host?: string, port?: number): Promise<DeviceHealth | null> {
    const credential = this.getCredential(deviceId) || this.getDefaultCredential();
    if (!credential) return null;

    const device = networkDeviceRepository.getByIdWithVendor(deviceId);
    if (!device) return null;

    const targetHost = host || device.ip_address;
    const targetPort = port || credential.snmp_port || 161;
    const community = credential.community || 'public';
    const createSession = this.createSession.bind(this);

    // 并行获取系统信息、接口、厂商指标
    const [sysInfo, interfaces] = await Promise.all([
      getSystemInfoFn(createSession, targetHost, targetPort, credential.snmp_version, community).catch(() => null),
      getInterfacesFn(createSession, targetHost, targetPort, credential.snmp_version, community).catch(() => [] as InterfaceInfo[]),
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
        const vendorMetrics = await snmpGetMultiple(createSession, targetHost, targetPort, credential.snmp_version, community, vendorOidsList);
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
          const temps = await snmpWalk(createSession, targetHost, targetPort, credential.snmp_version, community, tempOid, 10);
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
   * 测试设备 SNMP 连通性（委托给 collectors）
   */
  async testConnection(host: string, port = 161, version: SnmpVersion = 'v2c', community = 'public'): Promise<boolean> {
    return snmpTestConnection(this.createSession.bind(this), host, port, version, community);
  }

  /**
   * 从网段自动发现 SNMP 设备（委托给 discovery）
   */
  async discoverDevices(subnet: string, community = 'public', version: SnmpVersion = 'v2c', port = 161): Promise<Array<{ ip: string; sysName: string; sysDescr: string }>> {
    return discoverDevicesFn(
      (host, p, v, c) => getSystemInfoFn(this.createSession.bind(this), host, p, v, c),
      subnet, community, version, port
    );
  }
}

export const snmpService = new SnmpService();