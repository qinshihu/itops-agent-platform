import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// Palo Alto 防火墙适配器
// ====================================================================
export class PaloAltoAdapter implements VendorAdapter {
  vendor: VendorType = 'paloalto';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show system resources | match cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show system resources | match mem', fallbackCommands: ['show system resources'], description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interface all', description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show system info | match sw-version', fallbackCommands: ['show system info'], description: '查看 PAN-OS 版本' },
    log: { type: 'log', name: '最近日志', command: 'show log system direction equal forward | tail 30', description: '查看最近系统日志' },
    security_policy: { type: 'security_policy', name: '安全策略', command: 'show running security-policy', description: '查看所有安全策略', deviceTypes: ['firewall'] },
    nat: { type: 'nat', name: 'NAT 策略', command: 'show running nat-policy', description: '查看 NAT 策略', deviceTypes: ['firewall', 'gateway'] },
    session: { type: 'session', name: '会话统计', command: 'show session info', fallbackCommands: ['show session summary'], description: '查看会话统计', deviceTypes: ['firewall'] },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'show vpn ipsec tunnel', description: '查看 IPSec VPN 隧道', deviceTypes: ['firewall', 'gateway'] },
    routes: { type: 'routes', name: '路由表', command: 'show routing route', description: '查看路由表', deviceTypes: ['firewall', 'router'] },
    bgp: { type: 'bgp', name: 'BGP 状态', command: 'show routing protocol bgp summary', deviceTypes: ['firewall', 'router'], description: '查看 BGP 邻居' },
    ospf: { type: 'ospf', name: 'OSPF 状态', command: 'show routing protocol ospf neighbor', deviceTypes: ['firewall', 'router'], description: '查看 OSPF 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 同步' },
    license: { type: 'license', name: 'License 状态', command: 'show license info', description: '查看 License 到期日' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show dhcp server lease', deviceTypes: ['firewall', 'gateway', 'router'], description: '查看 DHCP 租约' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show dns proxy config', description: '查看 DNS 代理配置' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    environment: { type: 'environment', name: '硬件状态', command: 'show system environment', description: '查看温度/风扇' },
    power: { type: 'power', name: '电源状态', command: 'show system environment power', description: '查看电源模块状态' },
    config_checksum: { type: 'config_checksum', name: '配置快照', command: 'show config diff | match serial', description: '查看配置摘要' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp all', description: '查看 ARP 表' },
    vlan: { type: 'vlan', name: 'VLAN 接口', command: 'show interface all | match vlan', deviceTypes: ['switch'], description: '查看 VLAN 接口' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}
