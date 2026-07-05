export type ApiError = { response?: { data?: { message?: string } } };

export interface Platform {
  id: string;
  name: string;
  hypervisorType: 'vmware' | 'proxmox' | 'kvm';
  host: string;
  port: number;
  status: 'active' | 'inactive' | 'error';
  tags: string[];
}

export interface VM {
  id: string;
  name: string;
  powerState: 'poweredOn' | 'poweredOff' | 'suspended';
  hostName: string;
  guestOs: string;
  numCPUs: number;
  memoryMB: number;
  disks: Array<{ id: string; name: string; sizeGB: number; type: string }>;
  networkInterfaces: Array<{ name: string; ipAddress: string; macAddress: string }>;
  ipAddress: string;
  hypervisorType: string;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface Snapshot {
  id: string;
  name: string;
  description?: string;
  creationTime: string;
}

export interface VMStats {
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface PlatformStatsSummary {
  platformId: string;
  platformName: string;
  total: number;
  poweredOn: number;
  poweredOff: number;
  suspended: number;
}

export interface AggregatedStats {
  platforms: PlatformStatsSummary[];
  summary: { total: number; poweredOn: number; poweredOff: number; suspended: number };
  sqliteFallback: boolean;
}

export interface PlatformForm {
  name: string;
  hypervisorType: 'vmware' | 'proxmox' | 'kvm';
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface VMForm {
  name: string;
  os: string;
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  ip_address: string;
  notes: string;
  tags: string;
}

export interface SnapshotForm {
  name: string;
  description: string;
  memory: boolean;
}
