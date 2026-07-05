import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// TP-Link JetStream 适配器
// ====================================================================
export class TplinkAdapter implements VendorAdapter {
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
