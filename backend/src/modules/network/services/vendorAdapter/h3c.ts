import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// 华三 Comware 适配器
// ====================================================================
export class H3cAdapter implements VendorAdapter {
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
