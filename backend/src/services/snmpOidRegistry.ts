// ================================================================
// 标准 / 厂商专用 SNMP OID 定义
// ================================================================

import { VendorType } from './vendorAdapter';

/**
 * 标准系统 OID (RFC 1213 / RFC 4293)
 */
export const SYSTEM_OIDS = {
  sysDescr:        '1.3.6.1.2.1.1.1.0',
  sysObjectID:     '1.3.6.1.2.1.1.2.0',
  sysUptime:       '1.3.6.1.2.1.1.3.0',
  sysContact:      '1.3.6.1.2.1.1.4.0',
  sysName:         '1.3.6.1.2.1.1.5.0',
  sysLocation:     '1.3.6.1.2.1.1.6.0',
  sysServices:     '1.3.6.1.2.1.1.7.0',
} as const;

/**
 * 接口 MIB (IF-MIB)
 */
export const IF_MIB_OIDS = {
  ifNumber:              '1.3.6.1.2.1.2.1.0',
  ifTable:               '1.3.6.1.2.1.2.2',
  ifIndex:               '1.3.6.1.2.1.2.2.1.1',
  ifDescr:               '1.3.6.1.2.1.2.2.1.2',
  ifType:                '1.3.6.1.2.1.2.2.1.3',
  ifMtu:                 '1.3.6.1.2.1.2.2.1.4',
  ifSpeed:               '1.3.6.1.2.1.2.2.1.5',
  ifPhysAddress:         '1.3.6.1.2.1.2.2.1.6',
  ifAdminStatus:         '1.3.6.1.2.1.2.2.1.7',
  ifOperStatus:          '1.3.6.1.2.1.2.2.1.8',
  ifInOctets:            '1.3.6.1.2.1.2.2.1.10',
  ifInUcastPkts:         '1.3.6.1.2.1.2.2.1.11',
  ifInErrors:            '1.3.6.1.2.1.2.2.1.14',
  ifOutOctets:           '1.3.6.1.2.1.2.2.1.16',
  ifOutUcastPkts:        '1.3.6.1.2.1.2.2.1.17',
  ifOutErrors:           '1.3.6.1.2.1.2.2.1.20',
  ifLastChange:          '1.3.6.1.2.1.2.2.1.22',
  ifHighSpeed:           '1.3.6.1.2.1.31.1.1.1.15',
  ifHCInOctets:          '1.3.6.1.2.1.31.1.1.1.6',
  ifHCOutOctets:         '1.3.6.1.2.1.31.1.1.1.10',
  ifName:                '1.3.6.1.2.1.31.1.1.1.1',
  ifAlias:               '1.3.6.1.2.1.31.1.1.1.18',
} as const;

/**
 * IP MIB (RFC 4293 / IP-MIB)
 */
export const IP_MIB_OIDS = {
  ipAddressTable:       '1.3.6.1.2.1.4.34',
  ipNetToMediaTable:    '1.3.6.1.2.1.4.22', // ARP 表
  ipRouteTable:         '1.3.6.1.2.1.4.21', // 路由表
} as const;

/**
 * TCP/UDP MIB
 */
export const TRANSPORT_MIB_OIDS = {
  tcpConnTable:         '1.3.6.1.2.1.6.13',
} as const;

/**
 * LLDP MIB (IEEE 802.1AB)
 */
export const LLDP_MIB_OIDS = {
  lldpLocChassisId:      '1.0.8802.1.1.2.1.3.1.0',
  lldpLocSysName:        '1.0.8802.1.1.2.1.3.3.0',
  lldpLocSysDesc:        '1.0.8802.1.1.2.1.3.4.0',
  lldpRemTable:          '1.0.8802.1.1.2.1.4.1.1',
  lldpRemTimeMark:       '1.0.8802.1.1.2.1.4.1.1.2',
  lldpRemLocalPortNum:   '1.0.8802.1.1.2.1.4.1.1.4',
  lldpRemChassisId:      '1.0.8802.1.1.2.1.4.1.1.5',
  lldpRemSysName:        '1.0.8802.1.1.2.1.4.1.1.9',
  lldpRemSysDesc:        '1.0.8802.1.1.2.1.4.1.1.10',
  lldpRemPortDescr:      '1.0.8802.1.1.2.1.4.1.1.8',
} as const;

/**
 * ENTITY MIB (机箱/电源/风扇/温度)
 */
export const ENTITY_MIB_OIDS = {
  entPhysicalTable:     '1.3.6.1.2.1.47.1.1.1.1',
  entPhysicalDescr:     '1.3.6.1.2.1.47.1.1.1.1.2',
  entPhysicalName:      '1.3.6.1.2.1.47.1.1.1.1.7',
  entPhysicalModel:     '1.3.6.1.2.1.47.1.1.1.1.13',
} as const;

/**
 * 厂商私有 MIB OID
 */
export interface VendorOidMapping {
  vendor: VendorType;
  cpuUsage?: string;
  memoryUsage?: string;
  memTotal?: string;
  memFree?: string;
  memUsed?: string;
  cpu5sec?: string;
  cpu1min?: string;
  cpu5min?: string;
  temperature?: string[];
  powerStatus?: string;
  fanStatus?: string;
  opticRxPower?: string;
  opticTxPower?: string;
  opticTemperature?: string;
}

export const VENDOR_OIDS: Record<string, VendorOidMapping> = {
  huawei: {
    vendor: 'huawei',
    cpuUsage: '1.3.6.1.4.1.2011.6.3.4.1.2.0',          // hwEntityCpuUsage
    memoryUsage: '1.3.6.1.4.1.2011.6.3.5.1.1.2.0',      // hwEntityMemUsage
    temperature: ['1.3.6.1.4.1.2011.6.3.4.1.1.2'],      // hwEntityTemperature
    powerStatus: '1.3.6.1.4.1.2011.6.3.4.1.3',
    fanStatus: '1.3.6.1.4.1.2011.6.3.4.1.1.3',
  },
  cisco: {
    vendor: 'cisco',
    cpu5sec: '1.3.6.1.4.1.9.9.109.1.1.1.1.7.1',         // cpmCPUTotal5sec
    cpu1min: '1.3.6.1.4.1.9.9.109.1.1.1.1.8.1',         // cpmCPUTotal1min
    cpu5min: '1.3.6.1.4.1.9.9.109.1.1.1.1.6.1',         // cpmCPUTotal5min
    memFree: '1.3.6.1.4.1.9.9.48.1.1.1.6.1',             // ciscoMemoryPoolFree
    memUsed: '1.3.6.1.4.1.9.9.48.1.1.1.5.1',             // ciscoMemoryPoolUsed
    temperature: ['1.3.6.1.4.1.9.9.13.1.3.1.3'],
    powerStatus: '1.3.6.1.4.1.9.9.117.1.1.2.1.2',
    fanStatus: '1.3.6.1.4.1.9.9.117.1.1.3.1.2',
  },
  h3c: {
    vendor: 'h3c',
    cpuUsage: '1.3.6.1.4.1.25506.2.6.1.1.1.1.6.1',      // hh3cCpuUsage
    memoryUsage: '1.3.6.1.4.1.25506.2.6.1.1.1.1.8.1',   // hh3cMemUsage
    temperature: ['1.3.6.1.4.1.25506.2.6.1.1.1.1.12'],
    powerStatus: '1.3.6.1.4.1.25506.2.6.1.1.1.1.10',
    fanStatus: '1.3.6.1.4.1.25506.2.6.1.1.1.1.11',
  },
  fortinet: {
    vendor: 'fortinet',
    cpuUsage: '1.3.6.1.4.1.12356.101.4.1.4.0',           // fgSysCpuUsage
    memoryUsage: '1.3.6.1.4.1.12356.101.4.1.3.0',        // fgSysMemUsage
    memTotal: '1.3.6.1.4.1.12356.101.4.1.5.0',           // fgSysMemCapacity
    memFree: '1.3.6.1.4.1.12356.101.4.1.6.0',            // fgSysMemFree
    cpu5sec: '1.3.6.1.4.1.12356.101.4.1.1.0',             // fgSysCpu5SecUsage
    cpu1min: '1.3.6.1.4.1.12356.101.4.1.2.0',             // fgSysCpu1MinUsage
  },
  juniper: {
    vendor: 'juniper',
    cpuUsage: '1.3.6.1.4.1.2636.3.1.13.1.7.7.1',          // jnxOperatingCPU
    memoryUsage: '1.3.6.1.4.1.2636.3.1.13.1.11.7.1',     // jnxOperatingMemory
    temperature: ['1.3.6.1.4.1.2636.3.1.13.1.8.7.1'],    // jnxOperatingTemp
  },
  paloalto: {
    vendor: 'paloalto',
    cpuUsage: '1.3.6.1.4.1.25461.2.1.2.1.5.0',           // panSessionActive
    memoryUsage: '1.3.6.1.4.1.25461.2.1.2.1.2.0',        // panSessionUtilization
    cpu5sec: '1.3.6.1.4.1.25461.2.1.2.5.1.0',            // panCPU5seconds
    cpu1min: '1.3.6.1.4.1.25461.2.1.2.5.2.0',            // panCPU1minute
  },
  arista: {
    vendor: 'arista',
    cpuUsage: '1.3.6.1.4.1.30065.3.2.1.1.6.1',           // aristaCpuUtilization
    memoryUsage: '1.3.6.1.4.1.30065.3.2.1.1.7.1',        // aristaMemoryUtilization
  },
  mikrotik: {
    vendor: 'mikrotik',
    cpuUsage: '1.3.6.1.4.1.14988.1.1.1.1.0',             // mtCPUUsage
    memTotal: '1.3.6.1.4.1.14988.1.1.1.2.0',             // mtMemoryTotal
    memFree: '1.3.6.1.4.1.14988.1.1.1.3.0',              // mtMemoryFree
  },
  dell: {
    vendor: 'dell',
    cpuUsage: '1.3.6.1.4.1.674.10895.5000.2.6132.1.1.1.1.4.1.0',
    memoryUsage: '1.3.6.1.4.1.674.10895.5000.2.6132.1.1.1.1.16.1.0',
  },
};

/**
 * 通用接口速率阈值模板（bps）
 */
export const INTERFACE_THRESHOLDS = {
  warningBps: 800_000_000,   // 800Mbps 告警
  criticalBps: 950_000_000,  // 950Mbps 告警
};

/**
 * 接口类型名称映射 (RFC 2863 IANAifType)
 */
export const IANA_IF_TYPE: Record<number, string> = {
  1:  'other',
  6:  'ethernetCsmacd',
  7:  'iso88023Csmacd',
  9:  'iso88025TokenRing',
  23: 'ppp',
  24: 'softwareLoopback',
  28: 'slip',
  53: 'propVirtual',
  62: 'fastEther',
  69: 'atm',
  71: 'frameRelay',
  72: 'rs232',
  78: 'sonet',
  94: 'trunkVlan',
  97: 'gigabitEthernet',
  101: 'tunnel',
  108: 'mpls',
  117: 'gigabitEthernetFX',
  120: 'gigabitEthernetLX',
  121: 'gigabitEthernetSX',
  122: 'gigabitEthernetT',
  131: 'tenGigabitEthernet',
  135: 'l2vlan',
  136: 'l3ipvlan',
  161: 'ieee8023adLag',      // LACP
  176: 'propChannel',
  209: 'vdsl',
  216: 'ieee8023adPort',
  223: 'softwareLoopback',
  233: 'fortyGigabitEthernet',
  243: 'hundredGigabitEthernet',
  259: 'twentyFiveGigabitEthernet',
  277: 'twoHundredGigabitEthernet',
  283: 'fourHundredGigabitEthernet',
  285: 'eightHundredGigabitEthernet',
  287: 'oneThousandGigabitEthernet',
};
