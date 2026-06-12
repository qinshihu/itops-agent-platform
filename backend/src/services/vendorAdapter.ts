import { logger } from '../utils/logger';

// ================================================================
// 厂商 & 设备类型 & 巡检维度枚举
// ================================================================

export type VendorType =
  | 'huawei'
  | 'cisco'
  | 'h3c'
  | 'ruijie'
  | 'zte'
  | 'fortinet'       // FortiGate 防火墙
  | 'paloalto'       // Palo Alto 防火墙
  | 'juniper'        // Juniper SRX/MX/EX
  | 'arista'         // Arista 交换机
  | 'hpe'            // HPE/Aruba 交换机
  | 'mikrotik'       // MikroTik RouterOS
  | 'ubiquiti'       // Ubiquiti UniFi/Edge
  | 'dell'           // Dell PowerSwitch/N-系列
  | 'tplink'         // TP-Link JetStream 交换机
  | 'f5'             // F5 BIG-IP 负载均衡
  | 'ruijie_eg'      // 锐捷 EG 出口网关（命令集不同）
  ;

export type DeviceType =
  | 'switch'
  | 'router'
  | 'firewall'
  | 'loadbalancer'
  | 'wlc'            // 无线控制器
  | 'ap'             // 无线接入点
  | 'gateway'        // 出口网关
  | 'unknown'
  ;

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
  | 'mac'
  | 'optic'           // 光模块收发光功率
  | 'neighbor'        // LLDP/CDP 邻居发现
  | 'security_policy' // 防火墙安全策略
  | 'nat'             // 防火墙 NAT 策略
  | 'session'         // 防火墙会话统计
  | 'vpn'             // VPN 隧道状态
  | 'wlan'            // 无线客户 / 射频
  | 'pool'            // DHCP 地址池
  | 'dns'             // DNS 配置 / 解析
  | 'bgp'             // BGP 邻居
  | 'ospf'            // OSPF 邻居
  | 'ntp'             // NTP 状态
  | 'license'         // License 有效期
  | 'config_checksum' // 配置 MD5 快照
  ;

export interface CommandTemplate {
  type: InspectionType;
  name: string;
  command: string;
  fallbackCommands?: string[];
  description: string;
  expectedPattern?: string;
  thresholds?: Record<string, number>;
  minFirmware?: string;
  models?: string[];
  deviceTypes?: DeviceType[];   // 仅适用于特定设备类型
}

export interface VendorAdapter {
  vendor: VendorType;
  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[];
  getCommand(type: InspectionType): CommandTemplate | undefined;
  supportsEnablePassword(): boolean;
}

// ================================================================
// 辅助：根据 deviceType 过滤指令
// ================================================================

function filterByDeviceType(
  templates: CommandTemplate[],
  deviceType?: DeviceType,
): CommandTemplate[] {
  if (!deviceType || deviceType === 'unknown') return templates;
  return templates.filter(t => !t.deviceTypes || t.deviceTypes.includes(deviceType));
}

// ====================================================================
// 华为 VRP 适配器（交换机 / 路由器 / 防火墙）
// ====================================================================
class HuaweiAdapter implements VendorAdapter {
  vendor: VendorType = 'huawei';

  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: {
      type: 'cpu', name: 'CPU 使用率',
      command: 'display cpu-usage',
      fallbackCommands: ['display cpu'],
      description: '检查设备 CPU 使用率，正常应低于 80%',
      expectedPattern: 'CPU utilization', thresholds: { warning: 70, critical: 85 },
    },
    memory: {
      type: 'memory', name: '内存使用率',
      command: 'display memory-usage',
      fallbackCommands: ['display memory', 'display memory-threshold'],
      description: '检查设备内存使用情况，正常应低于 85%',
      expectedPattern: 'Memory', thresholds: { warning: 75, critical: 90 },
    },
    interface: {
      type: 'interface', name: '接口状态',
      command: 'display interface brief',
      fallbackCommands: ['display ip interface brief'],
      description: '检查所有接口物理状态和协议状态',
      expectedPattern: 'PHY|Protocol',
    },
    version: {
      type: 'version', name: '系统版本',
      command: 'display version',
      description: '检查设备型号、软件版本和运行时间',
    },
    routes: {
      type: 'routes', name: '路由表',
      command: 'display ip routing-table',
      fallbackCommands: ['display ip routing-table statistics'],
      description: '检查路由表状态和路由数量',
    },
    log: {
      type: 'log', name: '日志缓冲区',
      command: 'display logbuffer',
      fallbackCommands: ['display trapbuffer', 'display syslog'],
      description: '检查最近的系统日志和告警信息',
    },
    environment: {
      type: 'environment', name: '环境状态',
      command: 'display temperature',
      fallbackCommands: ['display device temperature', 'display environment'],
      description: '检查设备温度和电压状态',
      models: ['NE', 'CE', 'S5700', 'S6700'],
    },
    power: {
      type: 'power', name: '电源状态',
      command: 'display power',
      fallbackCommands: ['display device power', 'display system-power'],
      description: '检查电源模块状态',
      models: ['NE', 'CE', 'S5700', 'S6700'],
    },
    fan: {
      type: 'fan', name: '风扇状态',
      command: 'display fan',
      fallbackCommands: ['display device fan'],
      description: '检查风扇模块运行状态',
      models: ['NE', 'CE', 'S5700', 'S6700'],
    },
    stp: {
      type: 'stp', name: 'STP 状态',
      command: 'display stp',
      fallbackCommands: ['display stp brief', 'display spanning-tree'],
      description: '检查生成树协议状态和端口角色',
    },
    vlan: {
      type: 'vlan', name: 'VLAN 信息',
      command: 'display vlan',
      fallbackCommands: ['display vlan summary'],
      description: '检查 VLAN 配置和端口成员',
    },
    arp: {
      type: 'arp', name: 'ARP 表',
      command: 'display arp',
      description: '检查 ARP 表项数量和状态',
    },
    mac: {
      type: 'mac', name: 'MAC 地址表',
      command: 'display mac-address',
      fallbackCommands: ['display mac-address summary'],
      description: '检查 MAC 地址表项',
    },
    // ---- 新增巡检维度 ----
    optic: {
      type: 'optic', name: '光模块信息',
      command: 'display optical-info',
      fallbackCommands: ['display transceiver verbose', 'display interface transceiver'],
      description: '检查光模块收发光功率和温度',
      deviceTypes: ['switch'],
    },
    neighbor: {
      type: 'neighbor', name: 'LLDP 邻居',
      command: 'display lldp neighbor brief',
      fallbackCommands: ['display cdp neighbor'],
      description: '查看 LLDP 邻居发现信息',
    },
    security_policy: {
      type: 'security_policy', name: '安全策略',
      command: 'display security-policy rule all',
      fallbackCommands: ['display acl all', 'display firewall rule'],
      description: '查看防火墙安全策略配置',
      deviceTypes: ['firewall', 'gateway'],
    },
    nat: {
      type: 'nat', name: 'NAT 转换',
      command: 'display nat session summary',
      fallbackCommands: ['display nat outbound', 'display nat server'],
      description: '查看 NAT 会话统计和映射',
      deviceTypes: ['firewall', 'router', 'gateway'],
    },
    session: {
      type: 'session', name: '会话统计',
      command: 'display firewall session table',
      fallbackCommands: ['display session statistics'],
      description: '查看防火墙会话状态',
      deviceTypes: ['firewall'],
    },
    vpn: {
      type: 'vpn', name: 'VPN 隧道',
      command: 'display ike sa',
      fallbackCommands: ['display ipsec sa', 'display ipsec tunnel'],
      description: '查看 IPSec VPN 隧道状态',
      deviceTypes: ['firewall', 'router', 'gateway'],
    },
    wlan: {
      type: 'wlan', name: '无线信息',
      command: 'display wlan ap all',
      fallbackCommands: ['display wlan client', 'display wlan radio'],
      description: '查看无线接入点和客户端状态',
      deviceTypes: ['wlc', 'ap'],
    },
    pool: {
      type: 'pool', name: 'DHCP 池',
      command: 'display ip pool',
      fallbackCommands: ['display dhcp server statistics'],
      description: '查看 DHCP 地址池使用情况',
      deviceTypes: ['router', 'gateway', 'switch'],
    },
    dns: {
      type: 'dns', name: 'DNS 配置',
      command: 'display dns server',
      description: '查看 DNS 服务器配置',
    },
    bgp: {
      type: 'bgp', name: 'BGP 状态',
      command: 'display bgp peer',
      fallbackCommands: ['display bgp peer verbose'],
      description: '查看 BGP 邻居状态',
      deviceTypes: ['router', 'firewall'],
    },
    ospf: {
      type: 'ospf', name: 'OSPF 状态',
      command: 'display ospf peer',
      fallbackCommands: ['display ospf interface', 'display ospf routing'],
      description: '查看 OSPF 邻居状态',
      deviceTypes: ['router', 'switch'],
    },
    ntp: {
      type: 'ntp', name: 'NTP 状态',
      command: 'display ntp status',
      fallbackCommands: ['display ntp-service status'],
      description: '查看 NTP 同步状态',
    },
    license: {
      type: 'license', name: 'License 有效期',
      command: 'display license',
      description: '查看 License 有效期和功能授权',
    },
    config_checksum: {
      type: 'config_checksum', name: '配置快照',
      command: 'display current-configuration | include sysname',
      fallbackCommands: ['display saved-configuration last-time'],
      description: '查看运行配置最后保存时间和摘要',
    },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    const all = types
      ? types.map(t => this.templates[t]).filter(Boolean)
      : Object.values(this.templates);
    return filterByDeviceType(all, deviceType);
  }

  getCommand(type: InspectionType): CommandTemplate | undefined {
    return this.templates[type];
  }

  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// 思科 IOS/IOS-XE/NX-OS 适配器
// ====================================================================
class CiscoAdapter implements VendorAdapter {
  vendor: VendorType = 'cisco';

  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: {
      type: 'cpu', name: 'CPU 使用率',
      command: 'show processes cpu | include CPU utilization',
      description: '检查设备 CPU 使用率，正常应低于 80%',
      expectedPattern: 'CPU utilization', thresholds: { warning: 70, critical: 85 },
    },
    memory: {
      type: 'memory', name: '内存使用率',
      command: 'show memory statistics',
      description: '检查设备内存使用情况，正常应低于 85%',
      expectedPattern: 'Pool', thresholds: { warning: 75, critical: 90 },
    },
    interface: {
      type: 'interface', name: '接口状态',
      command: 'show ip interface brief',
      description: '检查所有接口物理状态和协议状态',
      expectedPattern: 'Interface|Status',
    },
    version: {
      type: 'version', name: '系统版本',
      command: 'show version',
      description: '检查设备型号、软件版本和运行时间',
    },
    routes: {
      type: 'routes', name: '路由表',
      command: 'show ip route',
      description: '检查路由表状态和路由数量',
    },
    log: {
      type: 'log', name: '日志缓冲区',
      command: 'show logging',
      description: '检查最近的系统日志和告警信息',
    },
    environment: {
      type: 'environment', name: '环境状态',
      command: 'show environment all',
      description: '检查设备温度和电压状态',
    },
    power: {
      type: 'power', name: '电源状态',
      command: 'show power',
      description: '检查电源模块状态',
    },
    fan: {
      type: 'fan', name: '风扇状态',
      command: 'show environment fan',
      description: '检查风扇模块运行状态',
    },
    stp: {
      type: 'stp', name: 'STP 状态',
      command: 'show spanning-tree brief',
      description: '检查生成树协议状态和端口角色',
    },
    vlan: {
      type: 'vlan', name: 'VLAN 信息',
      command: 'show vlan brief',
      description: '检查 VLAN 配置和端口成员',
    },
    arp: {
      type: 'arp', name: 'ARP 表',
      command: 'show ip arp',
      description: '检查 ARP 表项数量和状态',
    },
    mac: {
      type: 'mac', name: 'MAC 地址表',
      command: 'show mac address-table',
      description: '检查 MAC 地址表项',
    },
    // ---- 新增 ----
    optic: {
      type: 'optic', name: '光模块信息',
      command: 'show interfaces transceiver detail',
      fallbackCommands: ['show interfaces transceiver'],
      description: '检查光模块收发光功率和温度',
      deviceTypes: ['switch'],
    },
    neighbor: {
      type: 'neighbor', name: 'LLDP 邻居',
      command: 'show lldp neighbors detail',
      fallbackCommands: ['show cdp neighbors detail'],
      description: '查看 LLDP/CDP 邻居发现信息',
    },
    security_policy: {
      type: 'security_policy', name: '安全策略',
      command: 'show access-list',
      fallbackCommands: ['show ip access-list', 'show running-config | section ip access-list'],
      description: '查看 ACL/安全策略配置',
      deviceTypes: ['firewall', 'router'],
    },
    nat: {
      type: 'nat', name: 'NAT 转换',
      command: 'show ip nat translations',
      fallbackCommands: ['show running-config | include nat'],
      description: '查看 NAT 转换表',
      deviceTypes: ['firewall', 'router', 'gateway'],
    },
    vpn: {
      type: 'vpn', name: 'VPN 隧道',
      command: 'show crypto isakmp sa',
      fallbackCommands: ['show crypto ipsec sa', 'show vpn-sessiondb'],
      description: '查看 IPSec VPN 隧道状态',
      deviceTypes: ['firewall', 'router', 'gateway'],
    },
    wlan: {
      type: 'wlan', name: '无线信息',
      command: 'show ap summary',
      fallbackCommands: ['show wireless client summary'],
      description: '查看无线接入点和客户端',
      deviceTypes: ['wlc', 'ap'],
    },
    pool: {
      type: 'pool', name: 'DHCP 池',
      command: 'show ip dhcp binding',
      fallbackCommands: ['show ip dhcp pool'],
      description: '查看 DHCP 地址池使用情况',
      deviceTypes: ['router', 'gateway', 'switch'],
    },
    dns: {
      type: 'dns', name: 'DNS 配置',
      command: 'show running-config | include name-server',
      fallbackCommands: ['show hosts'],
      description: '查看 DNS 服务器配置',
    },
    bgp: {
      type: 'bgp', name: 'BGP 状态',
      command: 'show bgp summary',
      fallbackCommands: ['show ip bgp summary'],
      description: '查看 BGP 邻居状态',
      deviceTypes: ['router', 'firewall'],
    },
    ospf: {
      type: 'ospf', name: 'OSPF 状态',
      command: 'show ip ospf neighbor',
      description: '查看 OSPF 邻居状态',
      deviceTypes: ['router', 'switch'],
    },
    ntp: {
      type: 'ntp', name: 'NTP 状态',
      command: 'show ntp associations',
      fallbackCommands: ['show ntp status'],
      description: '查看 NTP 同步状态',
    },
    license: {
      type: 'license', name: 'License 有效期',
      command: 'show license summary',
      fallbackCommands: ['show license usage'],
      description: '查看 License 有效期和功能授权',
    },
    config_checksum: {
      type: 'config_checksum', name: '配置快照',
      command: 'show running-config | include hostname',
      description: '查看运行配置摘要快照',
    },
    // Cisco 特有
    session: {
      type: 'session', name: '防火墙会话',
      command: 'show conn count',
      description: '查看防火墙并发连接数',
      deviceTypes: ['firewall'],
    },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    const all = types
      ? types.map(t => this.templates[t]).filter(Boolean)
      : Object.values(this.templates);
    return filterByDeviceType(all, deviceType);
  }

  getCommand(type: InspectionType): CommandTemplate | undefined {
    return this.templates[type];
  }

  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// 华三 Comware 适配器
// ====================================================================
class H3cAdapter implements VendorAdapter {
  vendor: VendorType = 'h3c';

  // 与华为 VRP 命令高度相似，继承大部分
  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'display cpu-usage', description: '检查设备 CPU 使用率', expectedPattern: 'CPU utilization', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'display memory-usage', fallbackCommands: ['display memory'], description: '检查设备内存使用情况', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'display interface brief', description: '检查所有接口物理状态', expectedPattern: 'Link|Protocol' },
    version: { type: 'version', name: '系统版本', command: 'display version', description: '检查设备型号、软件版本和运行时间' },
    routes: { type: 'routes', name: '路由表', command: 'display ip routing-table', description: '检查路由表' },
    log: { type: 'log', name: '日志缓冲区', command: 'display logbuffer', fallbackCommands: ['display trapbuffer'], description: '检查最近的系统日志' },
    environment: { type: 'environment', name: '环境状态', command: 'display environment', fallbackCommands: ['display temperature'], description: '检查温度和电压' },
    power: { type: 'power', name: '电源状态', command: 'display power', fallbackCommands: ['display device power'], description: '检查电源状态' },
    fan: { type: 'fan', name: '风扇状态', command: 'display fan', fallbackCommands: ['display device fan'], description: '检查风扇状态' },
    stp: { type: 'stp', name: 'STP 状态', command: 'display stp', fallbackCommands: ['display stp brief'], description: '检查 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 信息', command: 'display vlan', fallbackCommands: ['display vlan all'], description: '检查 VLAN 配置' },
    arp: { type: 'arp', name: 'ARP 表', command: 'display arp', description: '检查 ARP 表项' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'display mac-address', fallbackCommands: ['display mac-address statistics'], description: '检查 MAC 地址表' },
    // 新增维度
    optic: { type: 'optic', name: '光模块信息', command: 'display transceiver verbose', fallbackCommands: ['display optical-info'], description: '检查光模块收发光功率', deviceTypes: ['switch'] },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'display lldp neighbor brief', description: '查看 LLDP 邻居发现信息' },
    security_policy: { type: 'security_policy', name: '安全策略', command: 'display security-policy rule all', fallbackCommands: ['display acl all'], description: '查看安全策略配置', deviceTypes: ['firewall', 'gateway'] },
    nat: { type: 'nat', name: 'NAT 转换', command: 'display nat session summary', fallbackCommands: ['display nat outbound'], description: '查看 NAT 会话', deviceTypes: ['firewall', 'router', 'gateway'] },
    session: { type: 'session', name: '会话统计', command: 'display session statistics', description: '查看会话状态', deviceTypes: ['firewall'] },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'display ike sa', fallbackCommands: ['display ipsec sa'], description: '查看 VPN 隧道状态', deviceTypes: ['firewall', 'router', 'gateway'] },
    wlan: { type: 'wlan', name: '无线信息', command: 'display wlan ap all', fallbackCommands: ['display wlan client'], description: '查看无线信息', deviceTypes: ['wlc', 'ap'] },
    pool: { type: 'pool', name: 'DHCP 池', command: 'display dhcp server statistics', fallbackCommands: ['display ip pool'], description: '查看 DHCP 池', deviceTypes: ['router', 'gateway', 'switch'] },
    dns: { type: 'dns', name: 'DNS 配置', command: 'display dns server', description: '查看 DNS 配置' },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'display bgp peer', description: '查看 BGP 邻居', deviceTypes: ['router', 'firewall'] },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'display ospf peer', description: '查看 OSPF 邻居', deviceTypes: ['router', 'switch'] },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'display ntp status', fallbackCommands: ['display ntp-service status'], description: '查看 NTP 同步状态' },
    license: { type: 'license', name: 'License 有效期', command: 'display license', description: '查看 License 信息' },
    config_checksum: { type: 'config_checksum', name: '配置快照', command: 'display current-configuration | include sysname', description: '查看配置摘要' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    const all = types ? types.map(t => this.templates[t]).filter(Boolean) : Object.values(this.templates);
    return filterByDeviceType(all, deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// 锐捷（传统命令集）
// ====================================================================
class RuijieAdapter implements VendorAdapter {
  vendor: VendorType = 'ruijie';
  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interfaces status', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查系统版本' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '检查路由表' },
    log: { type: 'log', name: '日志缓冲区', command: 'show logging', description: '检查日志' },
    environment: { type: 'environment', name: '环境状态', command: 'show environment', description: '检查环境状态' },
    power: { type: 'power', name: '电源状态', command: 'show power', description: '检查电源状态' },
    fan: { type: 'fan', name: '风扇状态', command: 'show fan', description: '检查风扇状态' },
    stp: { type: 'stp', name: 'STP 状态', command: 'show spanning-tree', description: '检查 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 信息', command: 'show vlan', description: '检查 VLAN 配置' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp', description: '检查 ARP 表' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'show mac-address-table', description: '检查 MAC 表' },
    // 新增
    optic: { type: 'optic', name: '光模块信息', command: 'show interfaces transceiver', deviceTypes: ['switch'], description: '检查光模块' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    nat: { type: 'nat', name: 'NAT 转换', command: 'show ip nat translations', deviceTypes: ['firewall', 'router', 'gateway'], description: '查看 NAT 表' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show ip dhcp binding', deviceTypes: ['router', 'gateway', 'switch'], description: '查看 DHCP 池' },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'show ip bgp summary', deviceTypes: ['router', 'firewall'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'show ip ospf neighbor', deviceTypes: ['router', 'switch'], description: '查看 OSPF 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 状态' },
    security_policy: { type: 'security_policy', name: 'ACL 策略', command: 'show access-lists', deviceTypes: ['firewall', 'router'], description: '查看 ACL 策略' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show running-config | include nameserver', description: '查看 DNS 配置' },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'show crypto isakmp sa', deviceTypes: ['firewall', 'router', 'gateway'], description: '查看 VPN 隧道' },
    wlan: { type: 'wlan', name: '无线信息', command: 'show wlan ap summary', deviceTypes: ['wlc', 'ap'], description: '查看无线信息' },
    session: { type: 'session', name: '会话统计', command: 'show conn count', deviceTypes: ['firewall'], description: '查看会话数' },
    license: { type: 'license', name: 'License 信息', command: 'show license', description: '查看 License 信息' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show running-config | include hostname', description: '查看配置摘要' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    const all = types ? types.map(t => this.templates[t]).filter(Boolean) : Object.values(this.templates);
    return filterByDeviceType(all, deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// 中兴 ZTE ZXR10 适配器
// ====================================================================
class ZteAdapter implements VendorAdapter {
  vendor: VendorType = 'zte';
  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interface brief', description: '检查接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查系统版本' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '检查路由表' },
    log: { type: 'log', name: '日志缓冲区', command: 'show log', description: '检查日志' },
    environment: { type: 'environment', name: '环境状态', command: 'show environment', description: '检查环境状态' },
    power: { type: 'power', name: '电源状态', command: 'show power', description: '检查电源状态' },
    fan: { type: 'fan', name: '风扇状态', command: 'show fan', description: '检查风扇状态' },
    stp: { type: 'stp', name: 'STP 状态', command: 'show spanning-tree', description: '检查 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 信息', command: 'show vlan', description: '检查 VLAN' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp', description: '检查 ARP 表' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'show mac-address-table', description: '检查 MAC 表' },
    optic: { type: 'optic', name: '光模块信息', command: 'show transceiver', deviceTypes: ['switch'], description: '检查光模块' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    nat: { type: 'nat', name: 'NAT 转换', command: 'show ip nat translations', deviceTypes: ['firewall', 'router'], description: '查看 NAT 表' },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'show bgp summary', deviceTypes: ['router'], description: '查看 BGP' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show ip dhcp binding', deviceTypes: ['router'], description: '查看 DHCP' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show dns server', description: '查看 DNS' },
    session: { type: 'session', name: '会话统计', command: 'show session statistics', description: '查看会话统计', deviceTypes: ['firewall'] },
    wlan: { type: 'wlan', name: '无线信息', command: 'show wlan ap summary', deviceTypes: ['wlc', 'ap'], description: '查看无线 AP 信息' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'show ip ospf neighbor', deviceTypes: ['router', 'switch'], description: '查看 OSPF 邻居' },
    security_policy: { type: 'security_policy', name: 'ACL 策略', command: 'show access-list', deviceTypes: ['firewall'], description: '查看 ACL' },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'show ipsec sa', deviceTypes: ['firewall', 'router'], description: '查看 VPN' },
    license: { type: 'license', name: 'License 信息', command: 'show license', description: '查看 License' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show running-config | include sysname', description: '查看配置摘要' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    const all = types ? types.map(t => this.templates[t]).filter(Boolean) : Object.values(this.templates);
    return filterByDeviceType(all, deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// Fortinet FortiGate 防火墙适配器
// ====================================================================
class FortinetAdapter implements VendorAdapter {
  vendor: VendorType = 'fortinet';
  private templates: Record<InspectionType, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'get system performance status', fallbackCommands: ['get system perf'], description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'get system performance status', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show system interface physical', fallbackCommands: ['get system interface'], description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'get system status', description: '检查固件版本和运行时间' },
    log: { type: 'log', name: '最近日志', command: 'execute log filter category event\n' + 'execute log display', description: '查看最近系统日志' },
    // FortiGate 核心巡检
    security_policy: { type: 'security_policy', name: '防火墙策略', command: 'show firewall policy', description: '查看所有防火墙策略', deviceTypes: ['firewall'] },
    nat: { type: 'nat', name: 'NAT 策略', command: 'show firewall ippool', fallbackCommands: ['show firewall central-snat-map'], description: '查看 NAT 策略', deviceTypes: ['firewall', 'gateway'] },
    session: { type: 'session', name: '会话统计', command: 'get system sessions', fallbackCommands: ['diagnose sys session count'], description: '查看并发会话统计', deviceTypes: ['firewall'] },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'diagnose vpn tunnel list', fallbackCommands: ['get vpn ipsec tunnel details'], description: '查看 IPSec VPN 隧道', deviceTypes: ['firewall', 'gateway'] },
    routes: { type: 'routes', name: '路由表', command: 'get router info routing-table all', description: '查看路由表', deviceTypes: ['firewall', 'router'] },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'get lldp neighbors', description: '查看 LLDP 邻居' },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'get router info bgp summary', deviceTypes: ['firewall', 'router'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'get router info ospf neighbor', deviceTypes: ['firewall', 'router'], description: '查看 OSPF 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show system ntp', fallbackCommands: ['get system ntp status'], description: '查看 NTP 状态' },
    license: { type: 'license', name: 'License / 订阅', command: 'get system license', fallbackCommands: ['show system fortiguard'], description: '检查 License 到期日和 FortiGuard 订阅' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show system dhcp server', deviceTypes: ['firewall', 'gateway'], description: '查看 DHCP 配置' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show system dns', description: '查看 DNS 服务器配置' },
    wlan: { type: 'wlan', name: '无线信息', command: 'get wireless ap list', fallbackCommands: ['get wireless client list'], description: '查看无线接入点和客户端', deviceTypes: ['wlc', 'ap'] },
    config_checksum: { type: 'config_checksum', name: '配置快照', command: 'execute backup config checksum', description: '查看配置校验和' },
    environment: { type: 'environment', name: '硬件状态', command: 'get system hardware status', description: '查看硬件温度风扇电源' },
    power: { type: 'power', name: '电源状态', command: 'get system hardware status', description: '查看电源模块状态' },
    fan: { type: 'fan', name: '风扇状态', command: 'get system hardware status', description: '查看风扇状态' },
    stp: { type: 'stp', name: 'STP 状态', command: 'diagnose system bridge mac', description: '查看生成树状态' },
    vlan: { type: 'vlan', name: 'VLAN 接口', command: 'show system interface | grep -E "vlan|Vlan"', description: '查看 VLAN 接口' },
    arp: { type: 'arp', name: 'ARP 表', command: 'get system arp', description: '查看 ARP 表' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'diagnose device-switch mac-address', description: '查看 MAC 地址表' },
    optic: { type: 'optic', name: '光模块信息', command: 'diagnose system transceiver', deviceTypes: ['switch'], description: '查看光模块参数' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// Palo Alto 防火墙适配器
// ====================================================================
class PaloAltoAdapter implements VendorAdapter {
  vendor: VendorType = 'paloalto';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show system resources | match cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show system resources | match mem', fallbackCommands: ['show system resources'], description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interface all', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show system info | match sw-version', fallbackCommands: ['show system info'], description: '查看 PAN-OS 版本' },
    log: { type: 'log', name: '最近日志', command: 'show log system direction equal forward | tail 30', description: '查看最近系统日志' },
    security_policy: { type: 'security_policy', name: '安全策略', command: 'show running security-policy', description: '查看所有安全策略', deviceTypes: ['firewall'] },
    nat: { type: 'nat', name: 'NAT 策略', command: 'show running nat-policy', description: '查看 NAT 策略', deviceTypes: ['firewall', 'gateway'] },
    session: { type: 'session', name: '会话统计', command: 'show session info', fallbackCommands: ['show session summary'], description: '查看会话统计', deviceTypes: ['firewall'] },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'show vpn ipsec tunnel', description: '查看 IPSec VPN 隧道', deviceTypes: ['firewall', 'gateway'] },
    routes: { type: 'routes', name: '路由表', command: 'show routing route', description: '查看路由表', deviceTypes: ['firewall', 'router'] },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'show routing protocol bgp summary', deviceTypes: ['firewall', 'router'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'show routing protocol ospf neighbor', deviceTypes: ['firewall', 'router'], description: '查看 OSPF 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 同步' },
    license: { type: 'license', name: 'License 状态', command: 'show license info', description: '查看 License 到期日' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show dhcp server lease', deviceTypes: ['firewall', 'gateway', 'router'], description: '查看 DHCP 租约' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show dns proxy config', description: '查看 DNS 代理配置' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    environment: { type: 'environment', name: '硬件状态', command: 'show system environment', description: '查看温度/风扇' },
    power: { type: 'power', name: '电源状态', command: 'show system environment power', description: '查看电源模块状态' },
    config_checksum: { type: 'config_checksum', name: '配置快照', command: 'show config diff | match serial', description: '查看配置摘要' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp all', description: '查看 ARP 表' },
    vlan: { type: 'vlan', name: 'VLAN 接口', command: 'show interface all | match vlan', deviceTypes: ['switch'], description: '查看 VLAN 接口' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// Juniper JunOS 适配器
// ====================================================================
class JuniperAdapter implements VendorAdapter {
  vendor: VendorType = 'juniper';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show system processes extensive | match idle', fallbackCommands: ['show chassis routing-engine'], description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show system memory', fallbackCommands: ['show chassis routing-engine'], description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interfaces terse', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查 JunOS 版本和运行时间' },
    log: { type: 'log', name: '最近日志', command: 'show log messages | last 30', description: '查看最近系统日志' },
    routes: { type: 'routes', name: '路由表', command: 'show route summary', fallbackCommands: ['show route protocol static'], description: '查看路由表概要' },
    security_policy: { type: 'security_policy', name: '安全策略', command: 'show security policies', description: '查看安全策略', deviceTypes: ['firewall'] },
    nat: { type: 'nat', name: 'NAT 策略', command: 'show security nat source rule', fallbackCommands: ['show security nat dest rule'], description: '查看 NAT 规则', deviceTypes: ['firewall', 'gateway'] },
    session: { type: 'session', name: '会话统计', command: 'show security flow session summary', description: '查看会话统计', deviceTypes: ['firewall'] },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'show security ipsec security-associations', fallbackCommands: ['show security ike security-associations'], description: '查看 IPSec VPN 隧道', deviceTypes: ['firewall', 'gateway'] },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'show bgp summary', deviceTypes: ['router', 'firewall'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'show ospf neighbor', deviceTypes: ['router', 'switch'], description: '查看 OSPF 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp associations', description: '查看 NTP 同步状态' },
    license: { type: 'license', name: 'License 信息', command: 'show system license', description: '查看 License 信息' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show dhcp server binding', deviceTypes: ['router', 'switch'], description: '查看 DHCP 绑定信息' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show system name-server', description: '查看 DNS 服务器配置' },
    environment: { type: 'environment', name: '环境状态', command: 'show chassis hardware', fallbackCommands: ['show chassis environment'], description: '查看机框硬件信息' },
    power: { type: 'power', name: '电源状态', command: 'show chassis power', description: '查看电源状态' },
    fan: { type: 'fan', name: '风扇状态', command: 'show chassis fan', description: '查看风扇状态' },
    stp: { type: 'stp', name: 'STP 状态', command: 'show spanning-tree interface', description: '查看 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 信息', command: 'show vlans', description: '查看 VLAN 配置' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp', description: '查看 ARP 表' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'show ethernet-switching table', deviceTypes: ['switch'], description: '查看 MAC 地址表' },
    optic: { type: 'optic', name: '光模块信息', command: 'show interfaces diagnostics optics', deviceTypes: ['switch'], description: '查看光模块参数' },
    config_checksum: { type: 'config_checksum', name: '配置签名', command: 'show configuration checksum', description: '查看运行配置 MD5 签名' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return false; } // JunOS 通常用 SSH key
}

// ====================================================================
// Arista EOS 适配器
// ====================================================================
class AristaAdapter implements VendorAdapter {
  vendor: VendorType = 'arista';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show processes top | grep Cpu', fallbackCommands: ['show system resources'], description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show system memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interfaces status', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查 EOS 版本' },
    log: { type: 'log', name: '最近日志', command: 'show logging last 30', description: '查看最近日志' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route summary', description: '查看路由表概要' },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'show bgp summary', deviceTypes: ['router', 'switch'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'show ip ospf neighbor', deviceTypes: ['router', 'switch'], description: '查看 OSPF 邻居' },
    stp: { type: 'stp', name: 'STP 状态', command: 'show spanning-tree', description: '查看 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 信息', command: 'show vlan', description: '查看 VLAN 配置' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show ip arp', description: '查看 ARP 表' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'show mac address-table', description: '查看 MAC 表' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors detail', description: '查看 LLDP 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 同步' },
    optic: { type: 'optic', name: '光模块信息', command: 'show interfaces transceiver', deviceTypes: ['switch'], description: '查看光模块参数' },
    environment: { type: 'environment', name: '环境状态', command: 'show system environment', description: '查看温度/电源/风扇' },
    power: { type: 'power', name: '电源状态', command: 'show system environment power', description: '查看电源状态' },
    fan: { type: 'fan', name: '风扇状态', command: 'show system environment fan', description: '查看风扇状态' },
    license: { type: 'license', name: 'License 信息', command: 'show license', description: '查看 License' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show hosts', description: '查看 DNS 配置' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show running-config | grep hostname', description: '查看配置摘要' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show ip dhcp server leases summary', deviceTypes: ['router', 'switch'], description: '查看 DHCP 租约' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// HPE/Aruba ProVision/Comware 适配器
// ====================================================================
class HpeAdapter implements VendorAdapter {
  vendor: VendorType = 'hpe';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show system cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show system memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interfaces brief', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查系统版本' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '查看路由表' },
    log: { type: 'log', name: '最近日志', command: 'show logging -r', description: '查看最近日志' },
    stp: { type: 'stp', name: 'STP 状态', command: 'show spanning-tree', description: '查看 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 信息', command: 'show vlan', description: '查看 VLAN 配置' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp', description: '查看 ARP 表' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'show mac-address', description: '查看 MAC 表' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp info remote-device', description: '查看 LLDP 邻居' },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'show bgp summary', deviceTypes: ['router', 'switch'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'show ip ospf neighbor', deviceTypes: ['router', 'switch'], description: '查看 OSPF 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp', description: '查看 NTP 状态' },
    environment: { type: 'environment', name: '环境状态', command: 'show system environment', description: '查看温度/电源/风扇' },
    power: { type: 'power', name: '电源状态', command: 'show system power-supply', description: '查看电源状态' },
    fan: { type: 'fan', name: '风扇状态', command: 'show system fan', description: '查看风扇状态' },
    optic: { type: 'optic', name: '光模块信息', command: 'show interfaces transceiver', deviceTypes: ['switch'], description: '查看光模块参数' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show ip dns', description: '查看 DNS 配置' },
    config_checksum: { type: 'config_checksum', name: '配置快照', command: 'show running-config | include hostname', description: '查看配置摘要' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show ip dhcp server', deviceTypes: ['router', 'switch'], description: '查看 DHCP 池' },
    license: { type: 'license', name: 'License 信息', command: 'show license', description: '查看 License' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// MikroTik RouterOS 适配器
// ====================================================================
class MikrotikAdapter implements VendorAdapter {
  vendor: VendorType = 'mikrotik';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: '/system resource print', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: '/system resource print', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: '/interface print detail', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: '/system resource print', description: '检查 RouterOS 版本' },
    routes: { type: 'routes', name: '路由表', command: '/ip route print detail', description: '查看路由表' },
    log: { type: 'log', name: '最近日志', command: '/log print where topics=critical,warning,error', description: '查看最近重要日志' },
    nat: { type: 'nat', name: 'NAT 规则', command: '/ip firewall nat print', description: '查看 NAT 规则', deviceTypes: ['firewall', 'router', 'gateway'] },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: '/ip neighbor print', description: '查看邻居发现信息' },
    bgp: { type: 'bgp', name: 'BGP 状态', command: '/routing bgp peer print', deviceTypes: ['router'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: '/routing ospf neighbor print', deviceTypes: ['router'], description: '查看 OSPF 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: '/system ntp client print', description: '查看 NTP 客户端状态' },
    pool: { type: 'pool', name: 'DHCP 池', command: '/ip dhcp-server lease print', deviceTypes: ['router', 'gateway'], description: '查看 DHCP 租约' },
    dns: { type: 'dns', name: 'DNS 配置', command: '/ip dns print', description: '查看 DNS 配置' },
    vlan: { type: 'vlan', name: 'VLAN 接口', command: '/interface vlan print', description: '查看 VLAN 接口' },
    arp: { type: 'arp', name: 'ARP 表', command: '/ip arp print', description: '查看 ARP 表' },
    wlan: { type: 'wlan', name: '无线状态', command: '/interface wireless registration-table print', deviceTypes: ['ap', 'wlc'], description: '查看无线客户端' },
    license: { type: 'license', name: 'License 级别', command: '/system license print', description: '查看 License 级别和到期时间' },
    security_policy: { type: 'security_policy', name: '防火墙规则', command: '/ip firewall filter print', description: '查看防火墙过滤规则', deviceTypes: ['firewall', 'router', 'gateway'] },
    config_checksum: { type: 'config_checksum', name: '配置快照', command: '/export terse | include /system identity', description: '查看配置摘要' },
    environment: { type: 'environment', name: '硬件状态', command: '/system health print', description: '查看温度/电压/风扇' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return false; }
}

// ====================================================================
// Ubiquiti EdgeSwitch / UniFi 适配器
// ====================================================================
class UbiquitiAdapter implements VendorAdapter {
  vendor: VendorType = 'ubiquiti';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show system processes cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show system memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interfaces', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查 EdgeOS 版本' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '查看路由表' },
    log: { type: 'log', name: '最近日志', command: 'show log | tail -30', description: '查看最近日志' },
    nat: { type: 'nat', name: 'NAT 规则', command: 'show nat', description: '查看 NAT 规则', deviceTypes: ['firewall', 'router', 'gateway'] },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    stp: { type: 'stp', name: 'STP 状态', command: 'show spanning-tree', description: '查看 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 配置', command: 'show vlan', description: '查看 VLAN 配置' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp', description: '查看 ARP 表' },
    mac: { type: 'mac', name: 'MAC 表', command: 'show mac-address-table', description: '查看 MAC 表' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show dhcp leases', deviceTypes: ['router', 'gateway'], description: '查看 DHCP 租约' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show dns', description: '查看 DNS 配置' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp', description: '查看 NTP 状态' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show configuration | head -5', description: '查看配置摘要' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// Dell PowerSwitch / N-series 适配器
// ====================================================================
class DellAdapter implements VendorAdapter {
  vendor: VendorType = 'dell';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show system resources cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show system resources memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interfaces status', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查 Dell OS 版本' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '查看路由表' },
    log: { type: 'log', name: '日志', command: 'show logging last 30', description: '查看最近日志' },
    stp: { type: 'stp', name: 'STP 状态', command: 'show spanning-tree', description: '查看 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 信息', command: 'show vlan', description: '查看 VLAN 配置' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp', description: '查看 ARP 表' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'show mac address-table', description: '查看 MAC 表' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'show ip bgp summary', deviceTypes: ['router', 'switch'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'show ip ospf neighbor', deviceTypes: ['router', 'switch'], description: '查看 OSPF 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 状态' },
    environment: { type: 'environment', name: '环境状态', command: 'show system environment', description: '查看温度/电源/风扇' },
    power: { type: 'power', name: '电源状态', command: 'show system power-supply', description: '查看电源状态' },
    fan: { type: 'fan', name: '风扇状态', command: 'show system fan', description: '查看风扇状态' },
    optic: { type: 'optic', name: '光模块信息', command: 'show interfaces transceiver', deviceTypes: ['switch'], description: '查看光模块参数' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show ip dns', description: '查看 DNS 配置' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show running-config | include hostname', description: '查看配置摘要' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show ip dhcp server', deviceTypes: ['router', 'switch'], description: '查看 DHCP 池' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// TP-Link JetStream 适配器
// ====================================================================
class TplinkAdapter implements VendorAdapter {
  vendor: VendorType = 'tplink';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show process cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interface status', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查固件版本' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '查看路由表' },
    log: { type: 'log', name: '系统日志', command: 'show log buffer', description: '查看系统日志' },
    stp: { type: 'stp', name: 'STP 状态', command: 'show spanning-tree', description: '查看 STP 状态' },
    vlan: { type: 'vlan', name: 'VLAN 信息', command: 'show vlan', description: '查看 VLAN 配置' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp', description: '查看 ARP 表' },
    mac: { type: 'mac', name: 'MAC 地址表', command: 'show mac-address-table', description: '查看 MAC 表' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbor', description: '查看 LLDP 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 状态' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show running-config | include hostname', description: '查看配置摘要' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show ip dhcp pool', deviceTypes: ['router', 'switch'], description: '查看 DHCP 池' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// F5 BIG-IP 负载均衡适配器
// ====================================================================
class F5Adapter implements VendorAdapter {
  vendor: VendorType = 'f5';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'tmsh show sys performance module cpu | grep "CPU"', fallbackCommands: ['tmsh show sys cpu'], description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'tmsh show sys memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'tmsh show net interface', fallbackCommands: ['ifconfig -a'], description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'tmsh show sys version', description: '检查 BIG-IP 版本' },
    log: { type: 'log', name: '最近日志', command: 'tmsh show ltm log last 30', fallbackCommands: ['cat /var/log/ltm | tail -30'], description: '查看最近 LTM 日志' },
    // F5 核心
    pool: { type: 'pool', name: '节点池状态', command: 'tmsh show ltm pool', description: '查看所有节点池及成员状态', deviceTypes: ['loadbalancer'] },
    session: { type: 'session', name: '连接统计', command: 'tmsh show sys performance module connections', description: '查看当前连接数统计', deviceTypes: ['loadbalancer'] },
    dns: { type: 'dns', name: 'DNS 解析', command: 'tmsh show ltm dns', description: '查看 DNS 解析配置' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'tmsh show sys ntp', description: '查看 NTP 同步状态' },
    license: { type: 'license', name: 'License 信息', command: 'tmsh show sys license', description: '查看 License 有效期' },
    routes: { type: 'routes', name: '路由表', command: 'tmsh show net route', description: '查看路由表' },
    arp: { type: 'arp', name: 'ARP 表', command: 'tmsh show net arp', description: '查看 ARP 表' },
    config_checksum: { type: 'config_checksum', name: '配置快照', command: 'tmsh show sys version | uname -a', description: '查看设备基础信息' },
    vpn: { type: 'vpn', name: 'VPN / APM 状态', command: 'tmsh show apm session', description: '查看 APM VPN 会话', deviceTypes: ['loadbalancer'] },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// 锐捷 EG 出口网关适配器（独立命令集）
// ====================================================================
class RuijieEgAdapter implements VendorAdapter {
  vendor: VendorType = 'ruijie_eg';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interface brief', description: '检查接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查系统版本' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '查看路由表' },
    log: { type: 'log', name: '系统日志', command: 'show log', description: '查看系统日志' },
    nat: { type: 'nat', name: 'NAT 转换', command: 'show ip nat translations', deviceTypes: ['firewall', 'gateway', 'router'], description: '查看 NAT 转换表' },
    security_policy: { type: 'security_policy', name: '安全策略', command: 'show security-policy', deviceTypes: ['firewall', 'gateway'], description: '查看安全策略' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show ip dhcp server statistics', deviceTypes: ['router', 'gateway'], description: '查看 DHCP 状态' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show dns server', description: '查看 DNS 服务器' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 状态' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show running-config | include hostname', description: '查看配置摘要' },
    session: { type: 'session', name: '连接数统计', command: 'show session statistics', deviceTypes: ['firewall', 'gateway'], description: '查看并发连接统计' },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'show ike sa', fallbackCommands: ['show ipsec sa'], deviceTypes: ['firewall', 'gateway'], description: '查看 VPN 隧道' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}

// ====================================================================
// Factory：按厂商名称创建适配器实例
// ====================================================================

const adapterRegistry: Record<VendorType, new () => VendorAdapter> = {
  huawei: HuaweiAdapter,
  cisco: CiscoAdapter,
  h3c: H3cAdapter,
  ruijie: RuijieAdapter,
  zte: ZteAdapter,
  fortinet: FortinetAdapter,
  paloalto: PaloAltoAdapter,
  juniper: JuniperAdapter,
  arista: AristaAdapter,
  hpe: HpeAdapter,
  mikrotik: MikrotikAdapter,
  ubiquiti: UbiquitiAdapter,
  dell: DellAdapter,
  tplink: TplinkAdapter,
  f5: F5Adapter,
  ruijie_eg: RuijieEgAdapter,
};

export function createVendorAdapter(vendor: VendorType): VendorAdapter {
  const AdapterClass = adapterRegistry[vendor];
  if (!AdapterClass) {
    logger.warn(`Unknown vendor: ${vendor}, falling back to Huawei adapter`);
    return new HuaweiAdapter();
  }
  return new AdapterClass();
}

// ====================================================================
// 所有标准巡检维度（全量）
// ====================================================================

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
  'mac',
  // 新增维度
  'optic',
  'neighbor',
  'security_policy',
  'nat',
  'session',
  'vpn',
  'wlan',
  'pool',
  'dns',
  'bgp',
  'ospf',
  'ntp',
  'license',
  'config_checksum',
];
