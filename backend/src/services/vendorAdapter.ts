import { logger } from '../utils/logger';

export type VendorType = 'huawei' | 'cisco' | 'h3c' | 'ruijie' | 'zte' | 'hikvision';

export type InspectionType = 
  | 'cpu' 
  | 'memory' 
  | 'interface' 
  | 'version' 
  | 'routes' 
  | 'log'
  | 'environment'
  | 'power'
  | 'fan'
  | 'stp'
  | 'vlan'
  | 'arp'
  | 'mac';

export interface CommandTemplate {
  type: InspectionType;
  name: string;
  command: string;
  description: string;
  expectedPattern?: string;
  thresholds?: Record<string, number>;
}

export interface VendorAdapter {
  vendor: VendorType;
  getCommands(types?: InspectionType[]): CommandTemplate[];
  getCommand(type: InspectionType): CommandTemplate | undefined;
  supportsEnablePassword(): boolean;
}

class HuaweiAdapter implements VendorAdapter {
  vendor: VendorType = 'huawei';

  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: {
      type: 'cpu',
      name: 'CPU 使用率',
      command: 'display cpu-usage',
      description: '检查设备 CPU 使用率，正常应低于 80%',
      expectedPattern: 'CPU utilization',
      thresholds: { warning: 70, critical: 85 }
    },
    memory: {
      type: 'memory',
      name: '内存使用率',
      command: 'display memory',
      description: '检查设备内存使用情况，正常应低于 85%',
      expectedPattern: 'Memory Using',
      thresholds: { warning: 75, critical: 90 }
    },
    interface: {
      type: 'interface',
      name: '接口状态',
      command: 'display interface brief',
      description: '检查所有接口物理状态和协议状态',
      expectedPattern: 'PHY|Protocol'
    },
    version: {
      type: 'version',
      name: '系统版本',
      command: 'display version',
      description: '检查设备型号、软件版本和运行时间'
    },
    routes: {
      type: 'routes',
      name: '路由表',
      command: 'display ip routing-table',
      description: '检查路由表状态和路由数量'
    },
    log: {
      type: 'log',
      name: '日志缓冲区',
      command: 'display logbuffer',
      description: '检查最近的系统日志和告警信息'
    },
    environment: {
      type: 'environment',
      name: '环境状态',
      command: 'display environment',
      description: '检查设备温度和电压状态'
    },
    power: {
      type: 'power',
      name: '电源状态',
      command: 'display power',
      description: '检查电源模块状态'
    },
    fan: {
      type: 'fan',
      name: '风扇状态',
      command: 'display fan',
      description: '检查风扇模块运行状态'
    },
    stp: {
      type: 'stp',
      name: 'STP 状态',
      command: 'display stp brief',
      description: '检查生成树协议状态和端口角色'
    },
    vlan: {
      type: 'vlan',
      name: 'VLAN 信息',
      command: 'display vlan',
      description: '检查 VLAN 配置和端口成员'
    },
    arp: {
      type: 'arp',
      name: 'ARP 表',
      command: 'display arp',
      description: '检查 ARP 表项数量和状态'
    },
    mac: {
      type: 'mac',
      name: 'MAC 地址表',
      command: 'display mac-address',
      description: '检查 MAC 地址表项'
    }
  };

  getCommands(types?: InspectionType[]): CommandTemplate[] {
    if (!types) {
      return Object.values(this.templates);
    }
    return types.map(type => this.templates[type]).filter(Boolean);
  }

  getCommand(type: InspectionType): CommandTemplate | undefined {
    return this.templates[type];
  }

  supportsEnablePassword(): boolean {
    return true;
  }
}

class CiscoAdapter implements VendorAdapter {
  vendor: VendorType = 'cisco';

  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: {
      type: 'cpu',
      name: 'CPU 使用率',
      command: 'show processes cpu | include CPU utilization',
      description: '检查设备 CPU 使用率，正常应低于 80%',
      expectedPattern: 'CPU utilization',
      thresholds: { warning: 70, critical: 85 }
    },
    memory: {
      type: 'memory',
      name: '内存使用率',
      command: 'show memory statistics',
      description: '检查设备内存使用情况，正常应低于 85%',
      expectedPattern: 'Pool',
      thresholds: { warning: 75, critical: 90 }
    },
    interface: {
      type: 'interface',
      name: '接口状态',
      command: 'show ip interface brief',
      description: '检查所有接口物理状态和协议状态',
      expectedPattern: 'Interface|Status'
    },
    version: {
      type: 'version',
      name: '系统版本',
      command: 'show version',
      description: '检查设备型号、软件版本和运行时间'
    },
    routes: {
      type: 'routes',
      name: '路由表',
      command: 'show ip route',
      description: '检查路由表状态和路由数量'
    },
    log: {
      type: 'log',
      name: '日志缓冲区',
      command: 'show logging',
      description: '检查最近的系统日志和告警信息'
    },
    environment: {
      type: 'environment',
      name: '环境状态',
      command: 'show environment all',
      description: '检查设备温度和电压状态'
    },
    power: {
      type: 'power',
      name: '电源状态',
      command: 'show power',
      description: '检查电源模块状态'
    },
    fan: {
      type: 'fan',
      name: '风扇状态',
      command: 'show environment fan',
      description: '检查风扇模块运行状态'
    },
    stp: {
      type: 'stp',
      name: 'STP 状态',
      command: 'show spanning-tree brief',
      description: '检查生成树协议状态和端口角色'
    },
    vlan: {
      type: 'vlan',
      name: 'VLAN 信息',
      command: 'show vlan brief',
      description: '检查 VLAN 配置和端口成员'
    },
    arp: {
      type: 'arp',
      name: 'ARP 表',
      command: 'show ip arp',
      description: '检查 ARP 表项数量和状态'
    },
    mac: {
      type: 'mac',
      name: 'MAC 地址表',
      command: 'show mac address-table',
      description: '检查 MAC 地址表项'
    }
  };

  getCommands(types?: InspectionType[]): CommandTemplate[] {
    if (!types) {
      return Object.values(this.templates);
    }
    return types.map(type => this.templates[type]).filter(Boolean);
  }

  getCommand(type: InspectionType): CommandTemplate | undefined {
    return this.templates[type];
  }

  supportsEnablePassword(): boolean {
    return true;
  }
}

class H3cAdapter implements VendorAdapter {
  vendor: VendorType = 'h3c';

  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: {
      type: 'cpu',
      name: 'CPU 使用率',
      command: 'display cpu-usage',
      description: '检查设备 CPU 使用率，正常应低于 80%',
      expectedPattern: 'CPU utilization',
      thresholds: { warning: 70, critical: 85 }
    },
    memory: {
      type: 'memory',
      name: '内存使用率',
      command: 'display memory',
      description: '检查设备内存使用情况，正常应低于 85%',
      expectedPattern: 'Memory',
      thresholds: { warning: 75, critical: 90 }
    },
    interface: {
      type: 'interface',
      name: '接口状态',
      command: 'display interface brief',
      description: '检查所有接口物理状态和协议状态',
      expectedPattern: 'Link|Protocol'
    },
    version: {
      type: 'version',
      name: '系统版本',
      command: 'display version',
      description: '检查设备型号、软件版本和运行时间'
    },
    routes: {
      type: 'routes',
      name: '路由表',
      command: 'display ip routing-table',
      description: '检查路由表状态和路由数量'
    },
    log: {
      type: 'log',
      name: '日志缓冲区',
      command: 'display logbuffer',
      description: '检查最近的系统日志和告警信息'
    },
    environment: {
      type: 'environment',
      name: '环境状态',
      command: 'display environment',
      description: '检查设备温度和电压状态'
    },
    power: {
      type: 'power',
      name: '电源状态',
      command: 'display power',
      description: '检查电源模块状态'
    },
    fan: {
      type: 'fan',
      name: '风扇状态',
      command: 'display fan',
      description: '检查风扇模块运行状态'
    },
    stp: {
      type: 'stp',
      name: 'STP 状态',
      command: 'display stp brief',
      description: '检查生成树协议状态和端口角色'
    },
    vlan: {
      type: 'vlan',
      name: 'VLAN 信息',
      command: 'display vlan all',
      description: '检查 VLAN 配置和端口成员'
    },
    arp: {
      type: 'arp',
      name: 'ARP 表',
      command: 'display arp',
      description: '检查 ARP 表项数量和状态'
    },
    mac: {
      type: 'mac',
      name: 'MAC 地址表',
      command: 'display mac-address',
      description: '检查 MAC 地址表项'
    }
  };

  getCommands(types?: InspectionType[]): CommandTemplate[] {
    if (!types) {
      return Object.values(this.templates);
    }
    return types.map(type => this.templates[type]).filter(Boolean);
  }

  getCommand(type: InspectionType): CommandTemplate | undefined {
    return this.templates[type];
  }

  supportsEnablePassword(): boolean {
    return true;
  }
}

class RuijieAdapter implements VendorAdapter {
  vendor: VendorType = 'ruijie';

  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: {
      type: 'cpu',
      name: 'CPU 使用率',
      command: 'show cpu',
      description: '检查设备 CPU 使用率，正常应低于 80%',
      expectedPattern: 'CPU',
      thresholds: { warning: 70, critical: 85 }
    },
    memory: {
      type: 'memory',
      name: '内存使用率',
      command: 'show memory',
      description: '检查设备内存使用情况，正常应低于 85%',
      expectedPattern: 'Memory',
      thresholds: { warning: 75, critical: 90 }
    },
    interface: {
      type: 'interface',
      name: '接口状态',
      command: 'show interfaces status',
      description: '检查所有接口物理状态和协议状态'
    },
    version: {
      type: 'version',
      name: '系统版本',
      command: 'show version',
      description: '检查设备型号、软件版本和运行时间'
    },
    routes: {
      type: 'routes',
      name: '路由表',
      command: 'show ip route',
      description: '检查路由表状态和路由数量'
    },
    log: {
      type: 'log',
      name: '日志缓冲区',
      command: 'show logging',
      description: '检查最近的系统日志和告警信息'
    },
    environment: {
      type: 'environment',
      name: '环境状态',
      command: 'show environment',
      description: '检查设备温度和电压状态'
    },
    power: {
      type: 'power',
      name: '电源状态',
      command: 'show power',
      description: '检查电源模块状态'
    },
    fan: {
      type: 'fan',
      name: '风扇状态',
      command: 'show fan',
      description: '检查风扇模块运行状态'
    },
    stp: {
      type: 'stp',
      name: 'STP 状态',
      command: 'show spanning-tree',
      description: '检查生成树协议状态和端口角色'
    },
    vlan: {
      type: 'vlan',
      name: 'VLAN 信息',
      command: 'show vlan',
      description: '检查 VLAN 配置和端口成员'
    },
    arp: {
      type: 'arp',
      name: 'ARP 表',
      command: 'show arp',
      description: '检查 ARP 表项数量和状态'
    },
    mac: {
      type: 'mac',
      name: 'MAC 地址表',
      command: 'show mac-address-table',
      description: '检查 MAC 地址表项'
    }
  };

  getCommands(types?: InspectionType[]): CommandTemplate[] {
    if (!types) {
      return Object.values(this.templates);
    }
    return types.map(type => this.templates[type]).filter(Boolean);
  }

  getCommand(type: InspectionType): CommandTemplate | undefined {
    return this.templates[type];
  }

  supportsEnablePassword(): boolean {
    return true;
  }
}

class ZteAdapter implements VendorAdapter {
  vendor: VendorType = 'zte';

  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: {
      type: 'cpu',
      name: 'CPU 使用率',
      command: 'show cpu',
      description: '检查设备 CPU 使用率，正常应低于 80%',
      expectedPattern: 'CPU',
      thresholds: { warning: 70, critical: 85 }
    },
    memory: {
      type: 'memory',
      name: '内存使用率',
      command: 'show memory',
      description: '检查设备内存使用情况，正常应低于 85%',
      expectedPattern: 'Memory',
      thresholds: { warning: 75, critical: 90 }
    },
    interface: {
      type: 'interface',
      name: '接口状态',
      command: 'show interface brief',
      description: '检查所有接口物理状态和协议状态'
    },
    version: {
      type: 'version',
      name: '系统版本',
      command: 'show version',
      description: '检查设备型号、软件版本和运行时间'
    },
    routes: {
      type: 'routes',
      name: '路由表',
      command: 'show ip route',
      description: '检查路由表状态和路由数量'
    },
    log: {
      type: 'log',
      name: '日志缓冲区',
      command: 'show log',
      description: '检查最近的系统日志和告警信息'
    },
    environment: {
      type: 'environment',
      name: '环境状态',
      command: 'show environment',
      description: '检查设备温度和电压状态'
    },
    power: {
      type: 'power',
      name: '电源状态',
      command: 'show power',
      description: '检查电源模块状态'
    },
    fan: {
      type: 'fan',
      name: '风扇状态',
      command: 'show fan',
      description: '检查风扇模块运行状态'
    },
    stp: {
      type: 'stp',
      name: 'STP 状态',
      command: 'show spanning-tree',
      description: '检查生成树协议状态和端口角色'
    },
    vlan: {
      type: 'vlan',
      name: 'VLAN 信息',
      command: 'show vlan',
      description: '检查 VLAN 配置和端口成员'
    },
    arp: {
      type: 'arp',
      name: 'ARP 表',
      command: 'show arp',
      description: '检查 ARP 表项数量和状态'
    },
    mac: {
      type: 'mac',
      name: 'MAC 地址表',
      command: 'show mac-address-table',
      description: '检查 MAC 地址表项'
    }
  };

  getCommands(types?: InspectionType[]): CommandTemplate[] {
    if (!types) {
      return Object.values(this.templates);
    }
    return types.map(type => this.templates[type]).filter(Boolean);
  }

  getCommand(type: InspectionType): CommandTemplate | undefined {
    return this.templates[type];
  }

  supportsEnablePassword(): boolean {
    return true;
  }
}

class HikvisionAdapter implements VendorAdapter {
  vendor: VendorType = 'hikvision';

  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: {
      type: 'cpu',
      name: 'CPU 使用率',
      command: 'display cpu-usage',
      description: '检查设备 CPU 使用率，正常应低于 80%',
      expectedPattern: 'CPU utilization',
      thresholds: { warning: 70, critical: 85 }
    },
    memory: {
      type: 'memory',
      name: '内存使用率',
      command: 'display memory',
      description: '检查设备内存使用情况，正常应低于 85%',
      expectedPattern: 'Memory',
      thresholds: { warning: 75, critical: 90 }
    },
    interface: {
      type: 'interface',
      name: '接口状态',
      command: 'display interface brief',
      description: '检查所有接口物理状态和协议状态',
      expectedPattern: 'Link|Protocol'
    },
    version: {
      type: 'version',
      name: '系统版本',
      command: 'display version',
      description: '检查设备型号、软件版本和运行时间'
    },
    routes: {
      type: 'routes',
      name: '路由表',
      command: 'display ip routing-table',
      description: '检查路由表状态和路由数量'
    },
    log: {
      type: 'log',
      name: '日志缓冲区',
      command: 'display logbuffer',
      description: '检查最近的系统日志和告警信息'
    },
    environment: {
      type: 'environment',
      name: '环境状态',
      command: 'display environment',
      description: '检查设备温度和电压状态'
    },
    power: {
      type: 'power',
      name: '电源状态',
      command: 'display power',
      description: '检查电源模块状态'
    },
    fan: {
      type: 'fan',
      name: '风扇状态',
      command: 'display fan',
      description: '检查风扇模块运行状态'
    },
    stp: {
      type: 'stp',
      name: 'STP 状态',
      command: 'display stp brief',
      description: '检查生成树协议状态和端口角色'
    },
    vlan: {
      type: 'vlan',
      name: 'VLAN 信息',
      command: 'display vlan all',
      description: '检查 VLAN 配置和端口成员'
    },
    arp: {
      type: 'arp',
      name: 'ARP 表',
      command: 'display arp',
      description: '检查 ARP 表项数量和状态'
    },
    mac: {
      type: 'mac',
      name: 'MAC 地址表',
      command: 'display mac-address',
      description: '检查 MAC 地址表项'
    }
  };

  getCommands(types?: InspectionType[]): CommandTemplate[] {
    if (!types) {
      return Object.values(this.templates);
    }
    return types.map(type => this.templates[type]).filter(Boolean);
  }

  getCommand(type: InspectionType): CommandTemplate | undefined {
    return this.templates[type];
  }

  supportsEnablePassword(): boolean {
    return true;
  }
}

export function createVendorAdapter(vendor: VendorType): VendorAdapter {
  const adapters: Record<VendorType, VendorAdapter> = {
    huawei: new HuaweiAdapter(),
    cisco: new CiscoAdapter(),
    h3c: new H3cAdapter(),
    ruijie: new RuijieAdapter(),
    zte: new ZteAdapter(),
    hikvision: new HikvisionAdapter()
  };

  const adapter = adapters[vendor];
  if (!adapter) {
    logger.warn(`Unknown vendor: ${vendor}, falling back to Huawei adapter`);
    return new HuaweiAdapter();
  }

  return adapter;
}

export const STANDARD_INSPECTION_TYPES: InspectionType[] = [
  'cpu',
  'memory',
  'interface',
  'version',
  'routes',
  'log',
  'environment',
  'power',
  'fan',
  'stp',
  'vlan',
  'arp',
  'mac'
];
