/**
 * AddDeviceModal 类型定义（2026-07-21 拆分）
 *
 * 把原 AddDeviceModal.tsx L12-52 的 4 个 interface 抽出
 * 包含：NetworkDevice + Credential + SnmpCredential + AddDeviceModalProps
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 5 + lessons-learned §3.5
 */

export interface NetworkDevice {
  id?: string;
  name: string;
  ip_address: string;
  vendor: string;
  model?: string;
  os_version?: string;
  ssh_port?: number;
  ssh_key_id?: string;
  username: string;
  password?: string;
  enable_password?: string;
  location?: string;
  role?: string;
  snmp_enabled?: number;
  snmp_credential_id?: string;
  snmp_port?: number;
}

export interface Credential {
  id: string;
  name: string;
  auth_type: 'key' | 'password';
  key_type: string;
  username: string | null;
  description: string | null;
}

export interface SnmpCredential {
  id: string;
  name: string;
  snmp_version: string;
  snmp_port: number;
  host?: string;
}

export interface AddDeviceModalProps {
  device?: NetworkDevice | null;
  onClose: () => void;
  onSuccess: () => void;
}

export type TabKey = 'ssh' | 'snmp';

export interface DeviceTab {
  key: TabKey;
  label: string;
}

export interface TestResult {
  success: boolean;
  message: string;
}

export interface AddDeviceFormData {
  name: string;
  ip_address: string;
  vendor: string;
  model: string;
  os_version: string;
  ssh_port: number;
  ssh_key_id: string;
  username: string;
  password: string;
  enable_password: string;
  location: string;
  role: string;
  snmp_enabled: number;
  snmp_credential_id: string;
  snmp_port: number;
}

export function createDefaultFormData(device?: NetworkDevice | null): AddDeviceFormData {
  return {
    name: device?.name || '',
    ip_address: device?.ip_address || '',
    vendor: device?.vendor || 'huawei',
    model: device?.model || '',
    os_version: device?.os_version || '',
    ssh_port: device?.ssh_port || 22,
    ssh_key_id: device?.ssh_key_id || '',
    username: device?.username || '',
    password: '',
    enable_password: '',
    location: device?.location || '',
    role: device?.role || 'switch',
    snmp_enabled: device?.snmp_enabled ?? 1,
    snmp_credential_id: device?.snmp_credential_id || '',
    snmp_port: device?.snmp_port || 161,
  };
}
