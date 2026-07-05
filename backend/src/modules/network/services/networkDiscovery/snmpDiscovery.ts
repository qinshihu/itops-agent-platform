/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SNMP 设备发现
 * 从 networkDiscoveryService.ts 提取的 SNMP 连接与厂商识别逻辑
 */

import type { SnmpCredentialRecord } from '../../../../repositories/snmpRepository';

/**
 * 尝试 SNMP 连接并获取设备信息
 */
export async function trySnmpConnect(ip: string, cred: SnmpCredentialRecord): Promise<Record<string, any> | null> {
  // 使用内置的 snmp 测试逻辑
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const snmp = require('net-snmp');

  const options: any = {
    port: cred.snmp_port || 161,
    timeout: 3000,
    retries: 1,
  };

  let session: any;
  try {
    if (cred.snmp_version === 'v3') {
      const user = {
        name: cred.snmp_user || '',
        level: cred.snmp_auth_protocol ? (cred.snmp_priv_protocol ? 'authPriv' : 'authNoPriv') : 'noAuthNoPriv',
        authProtocol: cred.snmp_auth_protocol?.toLowerCase() || undefined,
        authKey: cred.snmp_auth_key || undefined,
        privProtocol: cred.snmp_priv_protocol?.toLowerCase() || undefined,
        privKey: cred.snmp_priv_key || undefined,
      };
      session = snmp.createV3Session(ip, user, options);
    } else {
      session = snmp.createSession(ip, cred.community || 'public', options);
    }
  } catch {
    return null;
  }

  return new Promise(resolve => {
    const results: Record<string, any> = {};

    const oids = [
      '1.3.6.1.2.1.1.1.0',   // sysDescr
      '1.3.6.1.2.1.1.5.0',   // sysName
      '1.3.6.1.2.1.1.6.0',   // sysLocation
      '1.3.6.1.2.1.1.2.0',   // sysObjectID
      '1.3.6.1.2.1.2.1.0',   // ifNumber
    ];

    session.get(oids, (error: Error | null, varbinds: any[]) => {
      session.close();

      if (error) {
        resolve(null);
        return;
      }

      for (const v of varbinds) {
        if (v.value === undefined || v.value === null) continue;
        const val = typeof v.value === 'object' && v.value?.toString
          ? v.value.toString()
          : String(v.value);

        const oid = v.oid || '';
        if (oid.endsWith('.1.1.1.0')) results.sysDescr = val;
        else if (oid.endsWith('.1.1.5.0')) results.sysName = val;
        else if (oid.endsWith('.1.1.6.0')) results.sysLocation = val;
        else if (oid.endsWith('.1.1.2.0')) results.sysObjectID = val;
        else if (oid.endsWith('.1.2.1.0')) results.interfaceCount = parseInt(val) || 0;
      }

      // 解析厂商信息
      if (results.sysObjectID) {
        const vendorInfo = resolveVendor(results.sysObjectID);
        results.vendor = vendorInfo.vendor;
        results.model = vendorInfo.model || results.sysDescr;
      }

      if (results.sysName || results.sysDescr) {
        resolve(results);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * 根据 sysObjectID 识别厂商
 */
export function resolveVendor(sysObjectId: string): { vendor: string; model?: string } {
  const vendorMap: Record<string, string> = {
    '.1.3.6.1.4.1.9': 'Cisco',
    '.1.3.6.1.4.1.2011': 'Huawei',
    '.1.3.6.1.4.1.25506': 'H3C',
    '.1.3.6.1.4.1.2636': 'Juniper',
    '.1.3.6.1.4.1.4881': 'Ruijie',
    '.1.3.6.1.4.1.674': 'Dell',
    '.1.3.6.1.4.1.11': 'HP',
    '.1.3.6.1.4.1.14988': 'MikroTik',
    '.1.3.6.1.4.1.11863': 'TP-Link',
    '.1.3.6.1.4.1.41112': 'Ubiquiti',
    '.1.3.6.1.4.1.171': 'ZTE',
    '.1.3.6.1.4.1.6527': 'Nokia',
    '.1.3.6.1.4.1.890': 'Zyxel',
    '.1.3.6.1.4.1.12356': 'Fortinet',
    '.1.3.6.1.4.1.3224': 'Huawei (CSP)',
  };

  for (const [prefix, vendor] of Object.entries(vendorMap)) {
    if (sysObjectId.startsWith(prefix)) {
      return { vendor };
    }
  }
  if (sysObjectId.startsWith('.1.3.6.1.4.1')) {
    return { vendor: 'Other (Private Enterprise)' };
  }
  return { vendor: 'Unknown' };
}