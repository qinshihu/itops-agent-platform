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
  const parsers: Record<VendorType, ParseFunctionMap> = {
    huawei: {
      cpu: parseHuaweiCpu,
      memory: parseHuaweiMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer
    },
    cisco: {
      cpu: parseCiscoCpu,
      memory: parseCiscoMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer
    },
    h3c: {
      cpu: parseH3cCpu,
      memory: parseH3cMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer
    },
    ruijie: {
      cpu: parseRuijieCpu,
      memory: parseRuijieMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer
    },
    zte: {
      cpu: parseZteCpu,
      memory: parseZteMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer
    },
    hikvision: {
      cpu: parseH3cCpu,
      memory: parseH3cMemory,
      interface: parseInterfaceBrief,
      version: parseVersion,
      routes: parseRoutes,
      log: parseLogBuffer
    }
  };

  return (parsers[vendor]?.[type] || parseCustom);
}
