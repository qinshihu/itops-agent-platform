// backend/src/repositories/types/server.ts
// 来源: v001 + v005 + v009

/** 服务器 — v001 servers + v009 ALTER (gpu_count, gpu_model, os_detail) */
export interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  private_key: string | null;
  use_ssh_key: number;
  description: string | null;
  tags: string | null;
  enabled: number;
  last_connected: string | null;
  os: string | null;
  os_type: string;
  cpu_cores: number | null;
  memory_gb: number | null;
  disk_gb: number | null;
  ip_address: string | null;
  private_ip: string | null;
  cloud_provider: string | null;
  cloud_instance_id: string | null;
  vnc_port: number;
  vnc_password: string | null;
  ssh_key_id: string | null;
  gpu_count: number;                // v009 ALTER
  gpu_model: string | null;         // v009 ALTER
  os_detail: string | null;         // v009 ALTER
  created_at: string;
  updated_at: string;
}

/** SSH 密钥 — v005 (重建，新增 auth_type/username/password，private_key 可空) */
export interface SshKey {
  id: string;
  name: string;
  key_type: string;
  fingerprint: string | null;
  private_key: string | null;      // v005 改为可空
  description: string | null;
  auth_type: string | null;         // v005 新增
  username: string | null;          // v005 新增
  password: string | null;          // v005 新增
  created_at: string;
  updated_at: string;
}

/** 服务器分组 — v001 server_groups */
export interface ServerGroup {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 服务器与分组映射 — v001 server_group_mapping */
export interface ServerGroupMapping {
  server_id: string;
  group_id: string;
}

/** SSH 命令历史 — v001 server_command_history */
export interface ServerCommandHistory {
  id: string;
  server_id: string;
  command: string;
  stdout: string | null;
  stderr: string | null;
  success: number;
  execution_time_ms: number | null;
  executed_by: string | null;
  executed_at: string;
}

/** 合规检查 — v001 compliance_checks */
export interface ComplianceCheck {
  id: string;
  server_id: string;
  check_name: string;
  check_results: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** 服务拓扑 — v001 service_topologies */
export interface ServiceTopology {
  id: string;
  source_server_id: string;
  target_server_id: string;
  dependency_type: string;
  protocol: string | null;
  port: number | null;
  status: string;
  last_verified_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

/** 服务器指标 — v001 server_metrics */
export interface ServerMetric {
  id: string;
  server_id: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  memory_total_gb: number | null;
  memory_used_gb: number | null;
  disk_usage: number | null;
  disk_total_gb: number | null;
  disk_used_gb: number | null;
  network_in_mbps: number | null;
  network_out_mbps: number | null;
  load_1min: number | null;
  load_5min: number | null;
  load_15min: number | null;
  uptime_seconds: number | null;
  collected_at: string | null;
  created_at: string;
}
