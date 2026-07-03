import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// Ubiquiti EdgeSwitch / UniFi 适配器
// ====================================================================
export class UbiquitiAdapter implements VendorAdapter {
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
