// backend/src/repositories/types/network.ts
// 来源: v001 + v006 + v009 + v010 + v013 + v031

/** 网络设备 — v001 + v006 + v009 + v010 */
export interface NetworkDevice {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  model: string | null;
  os_version: string | null;
  ssh_port: number;
  username: string | null;
  password: string | null;
  enable_password: string | null;
  location: string | null;
  role: string | null;
  status: string;
  last_inspection_at: string | null;
  last_inspection_result: string | null;
  ssh_key_id: string | null;
  device_type: string;
  last_backup_at: string | null;
  device_role: string | null;
  snmp_enabled: number;
  last_snmp_at: string | null;
  snmp_port: number;
  created_at: string;
  updated_at: string;
}

/** 网络巡检历史 — v001 network_inspection_history + v009 ALTER */
export interface NetworkInspectionHistory {
  id: string;
  device_id: string;
  inspection_type: string;
  status: string;
  commands_executed: number;
  commands_failed: number;
  results: string | null;            // JSON string
  summary: string | null;
  duration_ms: number | null;
  device_type: string;               // v009 ALTER
  created_at: string;
}

/** 网络配置备份 — v009 network_config_backups */
export interface NetworkConfigBackup {
  id: string;
  device_id: string;
  config_md5: string;
  config_text: string | null;
  config_size: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

/** LLDP 邻居 — v009 network_lldp_neighbors */
export interface NetworkLldpNeighbor {
  id: string;
  device_id: string;
  local_interface: string | null;
  remote_device_name: string | null;
  remote_interface: string | null;
  remote_platform: string | null;
  remote_mgmt_ip: string | null;
  protocol: string;
  created_at: string;
}

/** 外部设备 — v009 network_external_devices */
export interface NetworkExternalDevice {
  id: string;
  name: string;
  discovered_from_device_id: string | null;
  platform: string | null;
  management_ip: string | null;
  last_seen_at: string;
}

/** 拓扑链路 — v009 network_topology_links */
export interface NetworkTopologyLink {
  id: string;
  deviceA_id: string;
  deviceA_name: string | null;
  deviceA_interface: string | null;
  deviceB_id: string;
  deviceB_name: string | null;
  deviceB_interface: string | null;
  status: string;
  last_seen_at: string;
  created_at: string;
}

/** SNMP 凭证 — v010 snmp_credentials */
export interface SnmpCredential {
  id: string;
  device_id: string | null;
  name: string;
  community: string | null;
  snmp_version: string;
  snmp_port: number;
  snmp_user: string | null;
  snmp_auth_protocol: string | null;
  snmp_auth_key: string | null;
  snmp_priv_protocol: string | null;
  snmp_priv_key: string | null;
  created_at: string;
  updated_at: string;
}

/** SNMP Trap 事件 — v010 snmp_trap_events */
export interface SnmpTrapEvent {
  id: string;
  source_ip: string;
  trap_type: string | null;
  enterprise_oid: string | null;
  agent_address: string | null;
  generic_type: number;
  specific_type: number;
  varbinds_json: string | null;      // JSON string
  created_at: string;
}

/** SNMP 轮询任务 — v010 snmp_polling_tasks */
export interface SnmpPollingTask {
  id: string;
  device_id: string;
  poll_interval_seconds: number;
  poll_items: string;                // JSON string
  enabled: number;
  last_poll_at: string | null;
  created_at: string;
}

/** SNMP 接口指标 — v010 snmp_interface_metrics */
export interface SnmpInterfaceMetric {
  id: string;
  device_id: string;
  if_index: number;
  if_name: string | null;
  in_octets: number | null;
  out_octets: number | null;
  in_errors: number | null;
  out_errors: number | null;
  in_utilization: number | null;
  out_utilization: number | null;
  sampled_at: string;
}

/** 网络发现任务 — v013 network_discovery_jobs */
export interface NetworkDiscoveryJob {
  id: string;
  name: string;
  start_ip: string;
  end_ip: string;
  status: string;
  progress: number;
  total_hosts: number;
  scanned_hosts: number;
  found_devices: number;
  credential_ids: string;            // JSON string
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** 网络发现结果 — v013 network_discovery_results */
export interface NetworkDiscoveryResult {
  id: string;
  job_id: string;
  ip_address: string;
  status: string;
  sys_name: string | null;
  sys_descr: string | null;
  sys_location: string | null;
  sys_object_id: string | null;
  snmp_version: string | null;
  community: string | null;
  interface_count: number | null;
  vendor: string | null;
  model: string | null;
  response_time_ms: number | null;
  created_at: string;
}

/** 子网 — v031 network_subnets */
export interface NetworkSubnet {
  id: string;
  name: string;
  cidr: string;
  gateway: string | null;
  vlan_id: number | null;
  network_type: string;
  location: string | null;
  description: string | null;
  status: string;
  total_ips: number;
  used_ips: number;
  created_at: string;
  updated_at: string;
}

/** IP 地址 — v031 network_ips */
export interface NetworkIp {
  id: string;
  subnet_id: string;
  ip_address: string;
  status: string;
  device_id: string | null;
  device_name: string | null;
  mac_address: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
