import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// MikroTik RouterOS 适配器
// ====================================================================
export class MikrotikAdapter implements VendorAdapter {
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
