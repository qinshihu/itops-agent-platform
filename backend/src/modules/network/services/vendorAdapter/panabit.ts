import type { VendorAdapter, VendorType, CommandTemplate, InspectionType, DeviceType } from './types';
import { filterByDeviceType } from './shared';

// ====================================================================
//  Panabit 流控网关适配器
// ====================================================================
//  Panabit 是国产专业的网络流量管理设备（流控网关、流量整形、上网行为管理）
// 命令风格类似 FreeBSD（基于 CLI），但有自己独有的流量分析/策略相关命令。
// 核心命令前缀：show / view / flowstat / ifstat / nat / policy
// ====================================================================
export class PanabitAdapter implements VendorAdapter {
  vendor: VendorType = 'panabit';
  private templates: Record<string, CommandTemplate> = {
    cpu: { type: 'cpu', name: 'CPU 使用率', command: 'show sys cpu', description: '检查 CPU 使用率', thresholds: { warning: 70, critical: 85 } },
    memory: { type: 'memory', name: '内存使用率', command: 'show sys mem', description: '检查内存使用率', thresholds: { warning: 75, critical: 90 } },
    interface: { type: 'interface', name: '接口状态', command: 'show ifstat', description: '查看接口流量与状态' },
    version: { type: 'version', name: '系统版本', command: 'show version', description: '检查系统版本' },
    log: { type: 'log', name: '系统日志', command: 'show log', description: '查看系统日志' },
    session: { type: 'session', name: '并发会话', command: 'show flowstat session', description: '查看当前并发会话数' },
    nat: { type: 'nat', name: 'NAT 状态', command: 'show nat rule', description: '查看 NAT 规则' },
    security_policy: { type: 'security_policy', name: '策略命中', command: 'show policy hit', description: '查看流量策略命中数' },
    routes: { type: 'routes', name: '路由表', command: 'show ip route', description: '查看路由表' },
    arp: { type: 'arp', name: 'ARP 表', command: 'show arp', description: '查看 ARP 表' },
    neighbor: { type: 'neighbor', name: '邻居发现', command: 'show lldp neighbor', description: '查看 LLDP 邻居' },
    ntp: { type: 'ntp', name: 'NTP 状态', command: 'show ntp status', description: '查看 NTP 状态' },
    dns: { type: 'dns', name: 'DNS 状态', command: 'show dns server', description: '查看 DNS 配置' },
    license: { type: 'license', name: '授权信息', command: 'show license', description: '查看授权信息' },
    config_checksum: { type: 'config_checksum', name: '配置摘要', command: 'show running-config | include hostname', description: '查看配置摘要' },
  };

  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[] {
    if (!types) return filterByDeviceType(Object.values(this.templates), deviceType);
    return filterByDeviceType(types.map(t => this.templates[t]).filter(Boolean), deviceType);
  }
  getCommand(type: InspectionType): CommandTemplate | undefined { return this.templates[type]; }
  supportsEnablePassword(): boolean { return false; }
}
