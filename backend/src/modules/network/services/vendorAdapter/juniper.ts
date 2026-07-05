import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// Juniper JunOS 适配器
// ====================================================================
export class JuniperAdapter implements VendorAdapter {
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
