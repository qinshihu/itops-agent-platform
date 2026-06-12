import { InspectionType, VendorType } from './vendorAdapter';
import { logger } from '../utils/logger';

export interface ParsedResult {
  type: InspectionType;
  success: boolean;
  value?: number | string;
  unit?: string;
  status: 'normal' | 'warning' | 'critical' | 'error';
  details: string;
  rawOutput: string;
  timestamp: string;
}

export interface CpuResult extends ParsedResult {
  type: 'cpu';
  value?: number;
  unit: '%';
}

export interface MemoryResult extends ParsedResult {
  type: 'memory';
  value?: number;
  unit: '%';
}

export interface InterfaceResult extends ParsedResult {
  type: 'interface';
  interfaces: Array<{
    name: string;
    physicalStatus: 'up' | 'down' | 'admin_down';
    protocolStatus: 'up' | 'down';
    description?: string;
  }>;
  totalInterfaces: number;
  upInterfaces: number;
  downInterfaces: number;
}

export function parseHuaweiCpu(output: string): CpuResult {
  const match = output.match(/(\d+)%/);
  const cpuUsage = match ? parseInt(match[1], 10) : undefined;
  
  let status: 'normal' | 'warning' | 'critical' | 'error' = 'normal';
  if (cpuUsage !== undefined) {
    if (cpuUsage > 85) status = 'critical';
    else if (cpuUsage > 70) status = 'warning';
  }

  return {
    type: 'cpu',
    success: cpuUsage !== undefined,
    value: cpuUsage,
    unit: '%',
    status,
    details: cpuUsage !== undefined 
      ? `CPU 使用率: ${cpuUsage}%` 
      : '无法解析 CPU 使用率',
    rawOutput: output.substring(0, 500),
    timestamp: new Date().toISOString()
  };
}

export function parseCiscoCpu(output: string): CpuResult {
  const match = output.match(/CPU utilization.*?(\d+)%/i);
  const cpuUsage = match ? parseInt(match[1], 10) : undefined;
  
  let status: 'normal' | 'warning' | 'critical' | 'error' = 'normal';
  if (cpuUsage !== undefined) {
    if (cpuUsage > 85) status = 'critical';
    else if (cpuUsage > 70) status = 'warning';
  }

  return {
    type: 'cpu',
    success: cpuUsage !== undefined,
    value: cpuUsage,
    unit: '%',
    status,
    details: cpuUsage !== undefined 
      ? `CPU 使用率: ${cpuUsage}%` 
      : '无法解析 CPU 使用率',
    rawOutput: output.substring(0, 500),
    timestamp: new Date().toISOString()
  };
}

export function parseH3cCpu(output: string): CpuResult {
  return parseHuaweiCpu(output);
}

export function parseRuijieCpu(output: string): CpuResult {
  const match = output.match(/(\d+)%/);
  const cpuUsage = match ? parseInt(match[1], 10) : undefined;
  
  let status: 'normal' | 'warning' | 'critical' | 'error' = 'normal';
  if (cpuUsage !== undefined) {
    if (cpuUsage > 85) status = 'critical';
    else if (cpuUsage > 70) status = 'warning';
  }

  return {
    type: 'cpu',
    success: cpuUsage !== undefined,
    value: cpuUsage,
    unit: '%',
    status,
    details: cpuUsage !== undefined 
      ? `CPU 使用率: ${cpuUsage}%` 
      : '无法解析 CPU 使用率',
    rawOutput: output.substring(0, 500),
    timestamp: new Date().toISOString()
  };
}

export function parseZteCpu(output: string): CpuResult {
  return parseRuijieCpu(output);
}

export function parseHuaweiMemory(output: string): MemoryResult {
  const match = output.match(/Memory Using.*?(\d+)%/i) || output.match(/(\d+)%/i);
  const memUsage = match ? parseInt(match[1], 10) : undefined;
  
  let status: 'normal' | 'warning' | 'critical' | 'error' = 'normal';
  if (memUsage !== undefined) {
    if (memUsage > 90) status = 'critical';
    else if (memUsage > 75) status = 'warning';
  }

  return {
    type: 'memory',
    success: memUsage !== undefined,
    value: memUsage,
    unit: '%',
    status,
    details: memUsage !== undefined 
      ? `内存使用率: ${memUsage}%` 
      : '无法解析内存使用率',
    rawOutput: output.substring(0, 500),
    timestamp: new Date().toISOString()
  };
}

export function parseCiscoMemory(output: string): MemoryResult {
  const match = output.match(/(\d+)%/);
  const memUsage = match ? parseInt(match[1], 10) : undefined;
  
  let status: 'normal' | 'warning' | 'critical' | 'error' = 'normal';
  if (memUsage !== undefined) {
    if (memUsage > 90) status = 'critical';
    else if (memUsage > 75) status = 'warning';
  }

  return {
    type: 'memory',
    success: memUsage !== undefined,
    value: memUsage,
    unit: '%',
    status,
    details: memUsage !== undefined 
      ? `内存使用率: ${memUsage}%` 
      : '无法解析内存使用率',
    rawOutput: output.substring(0, 500),
    timestamp: new Date().toISOString()
  };
}

export function parseH3cMemory(output: string): MemoryResult {
  return parseHuaweiMemory(output);
}

export function parseRuijieMemory(output: string): MemoryResult {
  return parseCiscoMemory(output);
}

export function parseZteMemory(output: string): MemoryResult {
  return parseCiscoMemory(output);
}

export function parseInterfaceBrief(output: string): InterfaceResult {
  const interfaces: Array<{
    name: string;
    physicalStatus: 'up' | 'down' | 'admin_down';
    protocolStatus: 'up' | 'down';
    description?: string;
  }> = [];

  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(UP|DOWN|ADM)\s+(UP|DOWN)/i);
    if (match) {
      const [, name, phys, proto] = match;
      interfaces.push({
        name,
        physicalStatus: phys.toUpperCase() === 'ADM' ? 'admin_down' : phys.toLowerCase() as 'up' | 'down',
        protocolStatus: proto.toLowerCase() as 'up' | 'down'
      });
    }
  }

  const upInterfaces = interfaces.filter(i => i.physicalStatus === 'up').length;
  const downInterfaces = interfaces.filter(i => i.physicalStatus === 'down').length;

  return {
    type: 'interface',
    success: true,
    status: downInterfaces > interfaces.length * 0.3 ? 'warning' : 'normal',
    details: `总接口: ${interfaces.length}, UP: ${upInterfaces}, DOWN: ${downInterfaces}`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString(),
    interfaces,
    totalInterfaces: interfaces.length,
    upInterfaces,
    downInterfaces
  };
}

export function parseVersion(output: string): ParsedResult {
  const lines = output.split('\n').filter(l => l.trim());
  const firstLines = lines.slice(0, 10).join('\n');
  
  const versionMatch = output.match(/Version\s+(\S+)/i);
  const uptimeMatch = output.match(/uptime is\s+(.+)/i);

  return {
    type: 'version',
    success: true,
    value: versionMatch ? versionMatch[1] : undefined,
    status: 'normal',
    details: versionMatch 
      ? `版本: ${versionMatch[1]}${uptimeMatch ? `, 运行时间: ${uptimeMatch[1]}` : ''}` 
      : '无法解析版本信息',
    rawOutput: firstLines,
    timestamp: new Date().toISOString()
  };
}

export function parseRoutes(output: string): ParsedResult {
  const routeCount = output.split('\n').filter(line => 
    line.match(/^\d+\.\d+\.\d+\.\d+/) || line.match(/^[O|C|S|R|B]/i)
  ).length;

  return {
    type: 'routes',
    success: true,
    value: routeCount,
    status: routeCount === 0 ? 'warning' : 'normal',
    details: `路由表条目数: ${routeCount}`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

export function parseLogBuffer(output: string): ParsedResult {
  const errorLines = output.match(/error|critical|alert|emergency/gi);
  const warningLines = output.match(/warning|notice/gi);
  
  const errorCount = errorLines ? errorLines.length : 0;
  const warningCount = warningLines ? warningLines.length : 0;

  let status: 'normal' | 'warning' | 'critical' | 'error' = 'normal';
  if (errorCount > 5) status = 'critical';
  else if (errorCount > 0) status = 'warning';
  else if (warningCount > 10) status = 'warning';

  return {
    type: 'log',
    success: true,
    status,
    details: `错误: ${errorCount}, 警告: ${warningCount}`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

// ==================== 新增解析器 (environment/power/fan/stp/vlan/arp/mac) ====================

/** 环境状态（温度/电压） */
export function parseEnvironment(output: string): ParsedResult {
  const tempMatch = output.match(/(\d+)\s*°?C/i);
  const overheat = output.match(/(overheat|over\s*temp|高温|告警)/i);

  return {
    type: 'environment',
    success: output.trim().length > 0,
    value: tempMatch ? parseInt(tempMatch[1], 10) : undefined,
    unit: '°C',
    status: overheat ? 'critical' : 'normal',
    details: tempMatch ? `最高温度: ${tempMatch[1]}°C` : '环境温度信息',
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

/** 电源状态 */
export function parsePower(output: string): ParsedResult {
  const normalCount = (output.match(/normal|正常|present|ok|up/gi) || []).length;
  const abnormalCount = (output.match(/abnormal|absent|fault|error|down|fail|异常|故障|无/gi) || []).length;

  return {
    type: 'power',
    success: output.trim().length > 0,
    status: abnormalCount > 0 ? 'critical' : normalCount > 0 ? 'normal' : 'warning',
    details: `正常电源: ${normalCount}, 异常电源: ${abnormalCount}`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

/** 风扇状态 */
export function parseFan(output: string): ParsedResult {
  const normalCount = (output.match(/normal|正常|present|ok|up|running/gi) || []).length;
  const abnormalCount = (output.match(/abnormal|absent|fault|error|stop|down|fail|异常|故障|停/gi) || []).length;

  return {
    type: 'fan',
    success: output.trim().length > 0,
    status: abnormalCount > 0 ? 'critical' : normalCount > 0 ? 'normal' : 'warning',
    details: `正常风扇: ${normalCount}, 异常风扇: ${abnormalCount}`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

/** STP 状态 */
export function parseStp(output: string): ParsedResult {
  const portCount = (output.match(/\S+\s+(DESI|ROOT|ALTE|BACK|MAST|DISA|EDGE|FWD|BLK|LIS|LRN)/gi) || []).length;
  const rootBridge = output.match(/This bridge is root|Root bridge|is rooted/gi) ? true : false;
  const blockedPorts = (output.match(/BLK|DISA|ALTE|BACK/gi) || []).length;

  return {
    type: 'stp',
    success: output.trim().length > 0,
    value: portCount,
    status: blockedPorts > 3 ? 'warning' : 'normal',
    details: rootBridge
      ? `STP 根桥, ${portCount} 端口参与, ${blockedPorts} 端口阻塞`
      : `STP 状态, ${portCount} 端口参与, ${blockedPorts} 端口阻塞`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

/** VLAN 信息 */
export function parseVlan(output: string): ParsedResult {
  const vlanCount = (output.match(/\d+\s+(?:static|dynamic|STATIC)/gi) || []).length ||
    (() => { const m = output.match(/Total.*?(\d+)/i); return m ? parseInt(m[1], 10) : 0; })();
  const actualVlanCount = Math.max(vlanCount, output.split('\n').filter(l => l.trim() && /^\d+\s/.test(l)).length);

  return {
    type: 'vlan',
    success: output.trim().length > 0,
    value: actualVlanCount,
    status: 'normal',
    details: `VLAN 数量: ${actualVlanCount}`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

/** ARP 表 */
export function parseArp(output: string): ParsedResult {
  const arpEntries = output.split('\n')
    .filter(l => /^\d{1,3}\./.test(l.trim())).length;
  const totalMatch = output.match(/Total[\s:]+(\d+)|(\d+)\s+entr/gi);
  const total = arpEntries > 0 ? arpEntries :
    (totalMatch ? parseInt((totalMatch[0] || '').replace(/\D/g, ''), 10) || 0 : 0);

  return {
    type: 'arp',
    success: output.trim().length > 0,
    value: total,
    status: total > 0 ? 'normal' : 'warning',
    details: `ARP 表项总数: ${total}`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

/** MAC 地址表 */
export function parseMac(output: string): ParsedResult {
  const macEntries = output.split('\n')
    .filter(l => /^[0-9a-f]{4}[-.][0-9a-f]{4}[-.][0-9a-f]{4}/i.test(l.trim())).length;
  const totalMatch = output.match(/Total[\s:]+(\d+)/i);
  const total = macEntries > 0 ? macEntries :
    (totalMatch ? parseInt(totalMatch[1], 10) : 0);

  return {
    type: 'mac',
    success: output.trim().length > 0,
    value: total,
    status: total > 0 ? 'normal' : 'warning',
    details: `MAC 地址表项总数: ${total}`,
    rawOutput: output.substring(0, 1000),
    timestamp: new Date().toISOString()
  };
}

export function parseCustom(output: string): ParsedResult {
  return {
    type: 'cpu',
    success: true,
    value: output.substring(0, 200),
    status: 'normal',
    details: '自定义命令输出',
    rawOutput: output.substring(0, 500),
    timestamp: new Date().toISOString()
  };
}

export interface ParseFunctionMap {
  [key: string]: (output: string) => ParsedResult;
}

export function getParser(vendor: VendorType, type: InspectionType): (output: string) => ParsedResult {
  const parsers: Partial<Record<VendorType, ParseFunctionMap>> = {
    huawei: {
      cpu: parseHuaweiCpu,
      memory: parseHuaweiMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer,
      environment: parseEnvironment,
      power: parsePower,
      fan: parseFan,
      stp: parseStp,
      vlan: parseVlan,
      arp: parseArp,
      mac: parseMac
    },
    cisco: {
      cpu: parseCiscoCpu,
      memory: parseCiscoMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer,
      environment: parseEnvironment,
      power: parsePower,
      fan: parseFan,
      stp: parseStp,
      vlan: parseVlan,
      arp: parseArp,
      mac: parseMac
    },
    h3c: {
      cpu: parseH3cCpu,
      memory: parseH3cMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer,
      environment: parseEnvironment,
      power: parsePower,
      fan: parseFan,
      stp: parseStp,
      vlan: parseVlan,
      arp: parseArp,
      mac: parseMac
    },
    ruijie: {
      cpu: parseRuijieCpu,
      memory: parseRuijieMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer,
      environment: parseEnvironment,
      power: parsePower,
      fan: parseFan,
      stp: parseStp,
      vlan: parseVlan,
      arp: parseArp,
      mac: parseMac
    },
    zte: {
      cpu: parseZteCpu,
      memory: parseZteMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer,
      environment: parseEnvironment,
      power: parsePower,
      fan: parseFan,
      stp: parseStp,
      vlan: parseVlan,
      arp: parseArp,
      mac: parseMac
    }
  };

  // 新增厂商使用通用解析器，特定类型可后续补充
  const newParsers: Record<string, VendorType> = {
    fortinet: 'fortinet',
    paloalto: 'paloalto',
    juniper: 'juniper',
    arista: 'arista',
    hpe: 'hpe',
    mikrotik: 'mikrotik',
    ubiquiti: 'ubiquiti',
    dell: 'dell',
    tplink: 'tplink',
    f5: 'f5',
    ruijie_eg: 'ruijie_eg',
  } as Record<string, VendorType>;

  if (newParsers[vendor]) {
    // 对于新增厂商，暂使用 huawei 或 cisco 兼容解析器
    const compatParsers: ParseFunctionMap = {
      cpu: ['fortinet', 'paloalto', 'f5'].includes(vendor) ? parseCiscoCpu : parseHuaweiCpu,
      memory: ['fortinet', 'paloalto', 'f5'].includes(vendor) ? parseCiscoMemory : parseHuaweiMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer,
      environment: parseEnvironment,
      power: parsePower,
      fan: parseFan,
      stp: parseStp,
      vlan: parseVlan,
      arp: parseArp,
      mac: parseMac,
    };
    return (compatParsers[type] || parseCustom);
  }

  return (parsers[vendor]?.[type] || parseCustom);
}
