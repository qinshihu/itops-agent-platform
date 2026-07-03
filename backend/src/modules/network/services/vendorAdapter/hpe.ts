import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// HPE/Aruba ProVision/Comware 适配器
// ====================================================================
export class HpeAdapter implements VendorAdapter {
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
