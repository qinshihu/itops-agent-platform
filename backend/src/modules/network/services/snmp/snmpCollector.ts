/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SNMP 数据采集功能
 * 从 snmpService.ts 提取的采集/轮询方法
 */

import snmp from 'net-snmp';
import { SYSTEM_OIDS, IF_MIB_OIDS, IANA_IF_TYPE } from '../snmpOidRegistry';
import {
  normalizeSnmpValue,
  type SnmpVersion,
  type SnmpResult,
  type InterfaceInfo,
} from '../snmpTypes';
import { getIfIndex, formatMac, typeToString } from './snmpParser';

export type SessionCreator = (
  host: string, port: number, version: SnmpVersion, community?: string,
  user?: string, authProtocol?: string, authKey?: string, privProtocol?: string, privKey?: string
) => snmp.Session;

/**
 * SNMP GET 单 OID
 */
export async function snmpGet(
  createSession: SessionCreator,
  host: string, port: number, version: SnmpVersion = 'v2c', community = 'public',
  user?: string, authProtocol?: string, authKey?: string, privProtocol?: string, privKey?: string,
  oid: string = SYSTEM_OIDS.sysName
): Promise<SnmpResult | null> {
  return new Promise((resolve) => {
    const session = createSession(host, port, version, community, user, authProtocol, authKey, privProtocol, privKey);

    // net-snmp 的 get() 接受 string[]，内部创建 { oid: oidStr }
    session.get([oid], (error: unknown, varbinds: any) => {
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
        typeName: typeToString(v.type),
      });
    });
  });
}

/**
 * SNMP GET 多 OID
 */
export async function snmpGetMultiple(
  createSession: SessionCreator,
  host: string, port: number, version: SnmpVersion, community: string,
  oids: string[]
): Promise<SnmpResult[]> {
  return new Promise((resolve) => {
    const session = createSession(host, port, version, community);
    // net-snmp 的 get() 接受 string[] (OID 字符串数组)
    session.get(oids, (error: unknown, results: any) => {
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
            typeName: typeToString(v.type),
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
export async function snmpWalk(
  createSession: SessionCreator,
  host: string, port: number, version: SnmpVersion, community: string,
  oid: string, maxRepetitions = 25
): Promise<SnmpResult[]> {
  return new Promise((resolve) => {
    const session = createSession(host, port, version, community);

    // net-snmp 的 walk 使用 feedCb（每批回调）+ doneCb（完成回调）模式
    const accumulator: SnmpResult[] = [];
    session.subtree(oid, maxRepetitions, (varbinds: any) => {
      for (const v of varbinds) {
        if (v && !snmp.isVarbindError(v)) {
          accumulator.push({
            oid: v.oid,
            value: normalizeSnmpValue(v.type, v.value),
            type: v.type,
            typeName: typeToString(v.type),
          });
        }
      }
      return false; // 继续遍历
    }, (error: unknown) => {
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
export async function getSystemInfo(
  createSession: SessionCreator,
  host: string, port = 161, version: SnmpVersion = 'v2c', community = 'public'
): Promise<{
  sysName: string;
  sysDescr: string;
  sysUptime: number;
  sysLocation: string;
  sysContact: string;
}> {
  const results = await snmpGetMultiple(createSession, host, port, version, community, [
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
export async function getInterfaces(
  createSession: SessionCreator,
  host: string, port = 161, version: SnmpVersion = 'v2c', community = 'public'
): Promise<InterfaceInfo[]> {
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
      walkScopes.map(oid => snmpWalk(createSession, host, port, version, community, oid, 50))
    );

  // 构建 index → 值 映射
  const makeMap = (arr: SnmpResult[]) => {
    const map = new Map<number, string>();
    for (const r of arr) {
      const idx = getIfIndex(r.oid);
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
    ...names.map(r => getIfIndex(r.oid)).filter(Boolean) as number[],
    ...descrs.map(r => getIfIndex(r.oid)).filter(Boolean) as number[],
  ]);

  const interfaces: InterfaceInfo[] = [];

  for (const idx of allIndexes) {
    const speed = parseInt(speedMap.get(idx) || '0', 10);
    const highSpeed = parseInt(highSpeedMap.get(idx) || '0', 10);
    const effectiveSpeed = speed > 0 ? speed : highSpeed * 1_000_000; // highSpeed → bps

    const inOctets = BigInt(inOctetsHCMap.get(idx) || inOctets32Map.get(idx) || '0');
    const outOctets = BigInt(outOctetsHCMap.get(idx) || outOctets32Map.get(idx) || '0');

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
      mac: formatMac(macMap.get(idx) || ''),
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
 * 测试设备 SNMP 连通性
 */
export async function snmpTestConnection(
  createSession: SessionCreator,
  host: string, port = 161, version: SnmpVersion = 'v2c', community = 'public'
): Promise<boolean> {
  const result = await snmpGet(createSession, host, port, version, community, undefined, undefined, undefined, undefined, undefined, SYSTEM_OIDS.sysName);
  return result !== null && !!result.value;
}