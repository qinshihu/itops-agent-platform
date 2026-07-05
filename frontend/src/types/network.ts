// frontend/src/types/network.ts
// 与后端 backend/src/repositories/types/network.ts 对应

export interface NetworkDevice {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  model: string | null;
  device_type: string;
  status: string;
  location: string | null;
  snmp_enabled: number;
  snmp_port: number;
  last_snmp_at: string | null;
  last_inspection_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SnmpCredential {
  id: string;
  device_id: string | null;
  name: string;
  community: string | null;
  snmp_version: string;
  snmp_port: number;
}

export interface NetworkTopologyLink {
  id: string;
  deviceA_id: string;
  deviceA_name: string | null;
  deviceB_id: string;
  deviceB_name: string | null;
  status: string;
}

export interface NetworkSubnet {
  id: string;
  name: string;
  cidr: string;
  gateway: string | null;
  vlan_id: number | null;
  network_type: string;
  total_ips: number;
  used_ips: number;
  status: string;
}
