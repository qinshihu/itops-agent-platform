/* eslint-disable @typescript-eslint/no-explicit-any */
/** snmpService 共享类型与辅助函数 */

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

// net-snmp Counter64 类型值为 70
export const SNMP_COUNTER64_TYPE = 70;

/** 将 Counter64 Buffer 字节转为 BigInt 的十进制字符串 */
export function counter64BufferToString(buf: Buffer): string {
  if (buf.length === 0) return '0';
  let result = BigInt(0);
  for (const byte of buf) {
    result = (result << BigInt(8)) + BigInt(byte);
  }
  return result.toString();
}

/** 统一处理 SNMP 返回值：Counter64 转数字字符串，Buffer 转 UTF-8，其余不变 */
export function normalizeSnmpValue(type: number | undefined, value: any): any {
  if (Buffer.isBuffer(value)) {
    if (type === SNMP_COUNTER64_TYPE) {
      return counter64BufferToString(value);
    }
    return value.toString('utf8');
  }
  return value;
}
