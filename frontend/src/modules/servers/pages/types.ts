export interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  use_ssh_key: number;
  description?: string;
  tags?: string[];
  enabled: number;
  last_connected?: string;
  created_at: string;
  os?: string;
  os_type?: 'linux' | 'windows' | 'unknown';
  cpu_cores?: number;
  memory_gb?: number;
  disk_gb?: number;
  ip_address?: string;
  private_ip?: string;
  ssh_key_id?: string;
  vnc_port?: number;
  groups?: Array<{ id: string; name: string }>;
}

export interface ServerGroup {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  server_count?: number;
  children_count?: number;
  children?: ServerGroup[];
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
  aiAnalysis?: string;
}

export interface CommandHistoryItem {
  id: string;
  server_id: string;
  command: string;
  stdout: string;
  stderr: string;
  success: number;
  execution_time_ms: number;
  executed_by: string;
  executed_at: string;
}

export interface ComplianceCheck {
  id: string;
  server_id: string;
  check_name: string;
  check_results: string;
  status: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}
