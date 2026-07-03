import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// 锐捷 EG 出口网关适配器（独立命令集）
// ====================================================================
export class RuijieEgAdapter implements VendorAdapter {
  vendor: VendorType = 'ruijie_eg';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show interface brief', description: '检查接口状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查系统版本' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '查看路由表' },
    log: { type: 'log', name: '系统日志', command: 'show log', description: '查看系统日志' },
    nat: { type: 'nat', name: 'NAT 转换', command: 'show ip nat translations', deviceTypes: ['firewall', 'gateway', 'router'], description: '查看 NAT 转换表' },
    security_policy: { type: 'security_policy', name: '安全策略', command: 'show security-policy', deviceTypes: ['firewall', 'gateway'], description: '查看安全策略' },
    pool: { type: 'pool', name: 'DHCP 池', command: 'show ip dhcp server statistics', deviceTypes: ['router', 'gateway'], description: '查看 DHCP 状态' },
    dns: { type: 'dns', name: 'DNS 配置', command: 'show dns server', description: '查看 DNS 服务器' },
    neighbor: { type: 'neighbor', name: 'LLDP 邻居', command: 'show lldp neighbors', description: '查看 LLDP 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 状态' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show running-config | include hostname', description: '查看配置摘要' },
    session: { type: 'session', name: '连接数统计', command: 'show session statistics', deviceTypes: ['firewall', 'gateway'], description: '查看并发连接统计' },
    vpn: { type: 'vpn', name: 'VPN 隧道', command: 'show ike sa', fallbackCommands: ['show ipsec sa'], deviceTypes: ['firewall', 'gateway'], description: '查看 VPN 隧道' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}
