// frontend/src/types/container.ts
// 与后端 backend/src/repositories/types/containers.ts 对应

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
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface Container {
  id: string;
  container_id: string;
  name: string;
  image: string;
  status: string;
  host: string;
  port_mappings: string;
  created_at: string;
  updated_at: string;
}

export interface ContainerImage {
  id: string;
  image_id: string;
  name: string;
  tag: string;
  size_bytes: number;
  host: string;
}

export interface DockerEndpoint {
  id: string;
  name: string;
  host: string;
  port: number;
  status: string;
  containers_running: number;
  containers_total: number;
  created_at: string;
  updated_at: string;
}
