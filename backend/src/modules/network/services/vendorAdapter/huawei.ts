import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// 华为 VRP 适配器（交换机 / 路由器 / 防火墙）
// ====================================================================
export class HuaweiAdapter implements VendorAdapter {
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
