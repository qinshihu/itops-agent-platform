import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// Fortinet FortiGate 防火墙适配器
// ====================================================================
export class FortinetAdapter implements VendorAdapter {
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
