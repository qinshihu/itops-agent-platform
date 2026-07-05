/**
 * networkDeviceRepository — 类型定义
 *
 * network_devices 表结构（v001 + v006 + v009 + v010 + 运行时 ALTER）：
 *   id, name, ip_address(UNIQUE), vendor, model, os_version, ssh_port(DEFAULT 22),
 *   ssh_key_id, username, password, enable_password, location, role, status(DEFAULT 'online'),
 *   last_inspection_at, last_inspection_result, created_at, updated_at,
 *   device_type, last_backup_at, device_role,
 *   snmp_enabled(DEFAULT 1), last_snmp_at, snmp_port(DEFAULT 161), snmp_credential_id
 */

export interface NetworkDeviceRecord {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  model?: string | null;
  os_version?: string | null;
  ssh_port: number;
  ssh_key_id?: string | null;
  username?: string | null;
  password?: string | null;
  enable_password?: string | null;
  location?: string | null;
  role?: string | null;
  status: string;
  last_inspection_at?: string | null;
  last_inspection_result?: string | null;
  created_at: string;
  updated_at: string;
  device_type?: string | null;
  last_backup_at?: string | null;
  device_role?: string | null;
  snmp_enabled: number;
  last_snmp_at?: string | null;
  snmp_port?: number | null;
  snmp_credential_id?: string | null;
}

/** 含 SNMP 凭证名称的联表记录（list/getByIdWithCredential 返回） */
export interface NetworkDeviceWithCredentialName extends NetworkDeviceRecord {
  snmp_credential_name?: string | null;
}

/** 凭证字段子集（巡检/配置备份用） */
export interface NetworkDeviceCredentials {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  ssh_port: number;
  username: string | null;
  password: string | null;
  enable_password?: string | null;
}

/** SSH 凭证子集（告警自动响应用） */
export interface NetworkDeviceSshCredentials {
  username: string | null;
  password: string | null;
  ssh_port: number;
}

/** 基础信息子集（id/name/ip_address） */
export interface NetworkDeviceBasic {
  id: string;
  name: string;
  ip_address: string;
}

/** 创建设备输入（业务层已处理加密、ssh_key 解析、默认值） */
export interface NetworkDeviceCreateInput {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  model?: string | null;
  os_version?: string | null;
  ssh_port?: number;
  ssh_key_id?: string | null;
  username?: string | null;
  password?: string | null;
  enable_password?: string | null;
  location?: string | null;
  role?: string | null;
  status?: string;
  snmp_enabled?: number;
  snmp_credential_id?: string | null;
  snmp_port?: number;
}

/** 动态更新字段（业务层已处理加密、空密码保护） */
export interface NetworkDeviceUpdateInput {
  name?: string;
  model?: string | null;
  os_version?: string | null;
  ssh_port?: number;
  ssh_key_id?: string | null;
  username?: string | null;
  password?: string | null;
  enable_password?: string | null;
  location?: string | null;
  role?: string | null;
  snmp_enabled?: number;
  snmp_credential_id?: string | null;
  snmp_port?: number;
}

/** 设备发现导入的简化输入 */
export interface NetworkDeviceDiscoveryInput {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  model?: string | null;
  username?: string | null;
  ssh_port?: number;
  status?: string;
  os_version?: string | null;
}