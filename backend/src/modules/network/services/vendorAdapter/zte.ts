import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// 中兴 ZTE ZXR10 适配器
// ====================================================================
export class ZteAdapter implements VendorAdapter {
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
