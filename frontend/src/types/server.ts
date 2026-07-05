// frontend/src/types/server.ts
// 与后端 backend/src/repositories/types/server.ts 对应

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
  gpu_count: number;
  gpu_model: string | null;
  os_detail: string | null;
  created_at: string;
  updated_at: string;
}

export interface SshKey {
  id: string;
  name: string;
  key_type: string;
  fingerprint: string | null;
  private_key: string | null;
  description: string | null;
  auth_type: string | null;
  username: string | null;
  password: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServerGroup {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServerImportItem {
  name: string;
  hostname: string;
  ip_address: string | null;
  port: number;
  username: string;
  password?: string;
  os_type: 'linux' | 'windows';
  tags?: string[];
  description?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  skipped?: number;
  details?: Array<{ name: string; error?: string }>;
  servers?: Server[];
  errors?: Array<{ name: string; error: string }>;
}
