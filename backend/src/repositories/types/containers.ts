// backend/src/repositories/types/containers.ts
// 来源: v023 + v024 + v025 + v026 + v044 + v045 + v046 + v049 + v050 + v055

/** 虚拟机 — v023 virtual_machines */
export interface VirtualMachine {
  id: string;
  name: string;
  host: string;
  status: string;
  os: string;
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  ip_address: string;
  hypervisor: string;
  agent_id: string;
  server_id: string;
  tags: string;                      // JSON string
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 容器 — v024 containers */
export interface Container {
  id: string;
  container_id: string;
  name: string;
  image: string;
  status: string;
  host: string;
  port_mappings: string;             // JSON string
  created_at: string;
  updated_at: string;
}

/** 容器镜像 — v025 container_images */
export interface ContainerImage {
  id: string;
  image_id: string;
  name: string;
  tag: string;
  size_bytes: number;
  host: string;
  created_at: string;
  updated_at: string;
}

/** 存储卷 — v026 storage_volumes */
export interface StorageVolume {
  id: string;
  name: string;
  driver: string;
  mount_point: string;
  size_gb: number;
  used_gb: number;
  status: string;
  host: string;
  type: string;
  tags: string;                      // JSON string
  created_at: string;
  updated_at: string;
}

/** Compose 项目 — v044 compose_projects */
export interface ComposeProject {
  id: string;
  name: string;
  description: string | null;
  compose_content: string;
  status: string;
  service_count: number;
  running_count: number;
  working_dir: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

/** 镜像仓库 — v045 image_registries */
export interface ImageRegistry {
  id: string;
  name: string;
  type: string;
  url: string;
  username: string | null;
  encrypted_password: string | null;
  encrypted_password_iv: string | null;
  status: string;
  error_message: string | null;
  project_count: number;
  repo_count: number;
  created_at: string;
  updated_at: string;
}

/** Docker 端点 — v046 docker_endpoints */
export interface DockerEndpoint {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  tls_ca: string | null;
  tls_cert: string | null;
  tls_key: string | null;
  status: string;
  error_message: string | null;
  containers_running: number;
  containers_total: number;
  images: number;
  cpu_count: number;
  memory_limit: number;
  created_at: string;
  updated_at: string;
}

/** VM 迁移 — v049 vm_migrations */
export interface VmMigration {
  id: string;
  vm_id: string;
  vm_name: string | null;
  source_host: string | null;
  target_host: string;
  platform_id: string;
  status: string;
  progress: number;
  reason: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** VM 快照策略 — v050 vm_snapshot_policies */
export interface VmSnapshotPolicy {
  id: string;
  name: string;
  platform_id: string;
  vm_id: string;
  cron_expression: string;
  retention: number;
  snapshot_memory: number;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

/** VM 平台 — v055 vm_platforms */
export interface VmPlatform {
  id: string;
  name: string;
  hypervisor_type: string;
  host: string;
  port: number | null;
  username: string | null;
  encrypted_password: string | null;
  encrypted_password_iv: string | null;
  config: string | null;
  status: string;
  last_connected: string | null;
  error_message: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

/** VM 审计日志 — v055 vm_audit_logs */
export interface VmAuditLog {
  id: string;
  platform_id: string;
  vm_id: string | null;
  vm_name: string | null;
  operation: string;
  user_id: string | null;
  username: string | null;
  parameters: string | null;
  result: string | null;
  status: string;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}
