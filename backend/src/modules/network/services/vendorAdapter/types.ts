/**
 * 厂商适配器 — 共享类型定义
 *
 * 所有厂商适配器文件和 index.ts 均从此文件导入类型。
 */

export type VendorType =
  | 'huawei'
  | 'cisco'
  | 'h3c'
  | 'ruijie'
  | 'zte'
  | 'fortinet'       // FortiGate 防火墙
  | 'paloalto'       // Palo Alto 防火墙
  | 'juniper'        // Juniper SRX/MX/EX
  | 'arista'         // Arista 交换机
  | 'hpe'            // HPE/Aruba 交换机
  | 'mikrotik'       // MikroTik RouterOS
  | 'ubiquiti'       // Ubiquiti UniFi/Edge
  | 'dell'           // Dell PowerSwitch/N-系列
  | 'tplink'         // TP-Link JetStream 交换机
  | 'f5'             // F5 BIG-IP 负载均衡
  | 'ruijie_eg'      // 锐捷 EG 出口网关（命令集不同）
  ;

export type DeviceType =
  | 'switch'
  | 'router'
  | 'firewall'
  | 'loadbalancer'
  | 'wlc'            // 无线控制器
  | 'ap'             // 无线接入点
  | 'gateway'        // 出口网关
  | 'unknown'
  ;

export type InspectionType =
  | 'cpu'
  | 'memory'
  | 'interface'
  | 'version'
  | 'routes'
  | 'log'
  | 'environment'
  | 'power'
  | 'fan'
  | 'stp'
  | 'vlan'
  | 'arp'
  | 'mac'
  | 'optic'           // 光模块收发光功率
  | 'neighbor'        // LLDP/CDP 邻居发现
  | 'security_policy' // 防火墙安全策略
  | 'nat'             // 防火墙 NAT 策略
  | 'session'         // 防火墙会话统计
  | 'vpn'             // VPN 隧道状态
  | 'wlan'            // 无线客户 / 射频
  | 'pool'            // DHCP 地址池
  | 'dns'             // DNS 配置 / 解析
  | 'bgp'             // BGP 邻居
  | 'ospf'            // OSPF 邻居
  | 'ntp'             // NTP 状态
  | 'license'         // License 有效期
  | 'config_checksum' // 配置 MD5 快照
  ;

export interface CommandTemplate {
  type: InspectionType;
  name: string;
  command: string;
  fallbackCommands?: string[];
  description: string;
  expectedPattern?: string;
  thresholds?: Record<string, number>;
  minFirmware?: string;
  models?: string[];
  deviceTypes?: DeviceType[];   // 仅适用于特定设备类型
}

export interface VendorAdapter {
  vendor: VendorType;
  getCommands(types?: InspectionType[], deviceType?: DeviceType): CommandTemplate[];
  getCommand(type: InspectionType): CommandTemplate | undefined;
  supportsEnablePassword(): boolean;
}
