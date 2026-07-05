import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// 思科 IOS/IOS-XE/NX-OS 适配器
// ====================================================================
export class CiscoAdapter implements VendorAdapter {
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
