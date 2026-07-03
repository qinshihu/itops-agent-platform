import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
// F5 BIG-IP 负载均衡适配器
// ====================================================================
export class F5Adapter implements VendorAdapter {
  vendor: VendorType = 'f5';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'tmsh show sys performance module cpu | grep "CPU"', fallbackCommands: ['tmsh show sys cpu'], description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'tmsh show sys memory', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'tmsh show net interface', fallbackCommands: ['ifconfig -a'], description: '检查所有接口状态' },
    version: { type: 'version', name: '系统版本', command: 'tmsh show sys version', description: '检查 BIG-IP 版本' },
    log: { type: 'log', name: '最近日志', command: 'tmsh show ltm log last 30', fallbackCommands: ['cat /var/log/ltm | tail -30'], description: '查看最近 LTM 日志' },
    // F5 核心
    pool: { type: 'pool', name: '节点池状态', command: 'tmsh show ltm pool', description: '查看所有节点池及成员状态', deviceTypes: ['loadbalancer'] },
    session: { type: 'session', name: '连接统计', command: 'tmsh show sys performance module connections', description: '查看当前连接数统计', deviceTypes: ['loadbalancer'] },
    dns: { type: 'dns', name: 'DNS 解析', command: 'tmsh show ltm dns', description: '查看 DNS 解析配置' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'tmsh show sys ntp', description: '查看 NTP 同步状态' },
    license: { type: 'license', name: 'License 信息', command: 'tmsh show sys license', description: '查看 License 有效期' },
    routes: { type: 'routes', name: '路由表', command: 'tmsh show net route', description: '查看路由表' },
    arp: { type: 'arp', name: 'ARP 表', command: 'tmsh show net arp', description: '查看 ARP 表' },
    config_checksum: { type: 'config_checksum', name: '配置快照', command: 'tmsh show sys version | uname -a', description: '查看设备基础信息' },
    vpn: { type: 'vpn', name: 'VPN / APM 状态', command: 'tmsh show apm session', description: '查看 APM VPN 会话', deviceTypes: ['loadbalancer'] },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return true; }
}
