/**
 * Containers 模块 API 类型定义（2026-07-21 拆分）
 *
 * 把原 850 行 api.ts 中的全部 interface / type alias 抽出
 * 保留原 import 路径 `'../api'` 兼容（通过 ./types + ./index 桶 re-export）
 *
 * 拆分原则遵循 architecture.md §3.3.1 第 1 条「路由路径不变」+
 * 第 3 条「向后兼容的 import 路径」+ 第 4 条「import 路径深度处理」。
 */
import type { VirtualMachine as _VirtualMachine, Container as _Container } from '@/types/container';

// ============================================================
// 通用类型
// ============================================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

// ── Docker 容器 ──

export interface EndpointHost {
  id: string;
  name: string;
  host: string;
  port?: number;
  protocol?: string;
  status: string;
}

export interface ContainerItem {
  id: string;
  Names?: string[];
  name?: string;
  Image?: string;
  image?: string;
  State?: string;
  state?: string;
  Status?: string;
  status?: string;
  Ports?: Array<{ PublicPort?: number; PrivatePort?: number; Type?: string }>;
  Created?: number;
  created?: number;
}

export interface ContainerListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  endpointId?: string;
}

export interface CreateContainerInput {
  image: string;
  name?: string;
  ports?: string[];
  env?: string[];
  volumes?: string[];
  restartPolicy?: string;
  memory?: number;
  cpuShares?: number;
}

export interface NetworkItem {
  Id?: string;
  id?: string;
  Name?: string;
  name?: string;
  Driver?: string;
  driver?: string;
  Scope?: string;
  scope?: string;
  IPAM?: { Driver?: string; Config?: Array<{ Subnet?: string; Gateway?: string }> };
  Containers?: Record<string, { Name: string; IPv4Address: string }>;
  containers?: Record<string, { Name: string; IPv4Address: string }>;
}

export interface CreateNetworkInput {
  name: string;
  driver: string;
  subnet?: string;
  gateway?: string;
  internal: boolean;
  attachable: boolean;
}

export interface EndpointItem {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  status: string;
  tlsCa?: string;
  tlsCert?: string;
  tlsKey?: string;
  error_message?: string;
}

export interface EndpointInput {
  name: string;
  host: string;
  port: number;
  protocol: string;
  tlsCa?: string;
  tlsCert?: string;
  tlsKey?: string;
}

export interface ContainerStats {
  [key: string]: unknown;
}

export interface ClusterSnapshot {
  [key: string]: unknown;
}

// ── 虚拟机 ──

export interface VmPlatform {
  id: string;
  name: string;
  hypervisorType: 'vmware' | 'proxmox' | 'kvm';
  host: string;
  port: number;
  status: 'active' | 'inactive' | 'error';
  tags: string[];
}

export interface VmPlatformInput {
  name: string;
  hypervisorType: 'vmware' | 'proxmox' | 'kvm';
  host: string;
  port: number;
  username: string;
  password: string;
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

export interface VmListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  platformId?: string;
}

export interface VmListResult {
  data: VM[];
  total: number;
  source: string;
}

export interface VmInput {
  name: string;
  os?: string;
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  ip_address?: string;
  notes?: string;
  tags?: string[];
  platformId?: string;
}

export interface VmStats {
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface VmSnapshot {
  id: string;
  name: string;
  description?: string;
  creationTime: string;
}

export interface SnapshotInput {
  name: string;
  description: string;
  memory: boolean;
}

export interface CloneInput {
  name: string;
  powerOn: boolean;
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

// ── 存储卷 ──

export interface Volume {
  id: string;
  name: string;
  driver: string;
  mount_point: string;
  size_gb: number;
  used_gb: number;
  status: string;
  host: string;
  type: string;
  tags?: string | string[];
}

export interface VolumeInput {
  name: string;
  driver?: string;
  type?: string;
  mount_point?: string;
  size_gb?: number;
  used_gb?: number;
  host?: string;
  tags?: string[];
}

// ── 镜像 ──

export interface Image {
  id: string;
  name: string;
  tag?: string;
  size_bytes?: number;
  host?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface PullImageInput {
  name: string;
  tag?: string;
  serverId?: string;
}

// ── 镜像仓库 ──

export interface Registry {
  id: string;
  name: string;
  type: string;
  url?: string;
  username?: string;
  status?: string;
}

export interface RegistryInput {
  name: string;
  type: string;
  url?: string;
  username?: string;
  password?: string;
}

export interface RegistryImage {
  project?: string;
  repository?: string;
  tag?: string;
  size?: string;
  pushed_at?: string;
  pull_count?: number;
  vulnerabilities?: number;
}

// ── Compose 编排 ──

export interface ComposeProject {
  id: string;
  name: string;
  description?: string;
  yaml_content?: string;
  status: string;
  service_count?: number;
  running_count?: number;
  updated_at?: string;
}

export interface ComposeInput {
  name: string;
  description?: string;
  yaml_content: string;
}

export interface ComposeService {
  name: string;
  command?: string;
  state?: string;
  ports?: string;
  status?: string;
}

export interface ComposeValidateResult {
  valid: boolean;
  error?: string;
}

// ── 快照策略 ──

export interface SnapshotPolicy {
  id: string;
  name: string;
  platformId?: string;
  vmId?: string;
  cronExpression?: string;
  retention?: number;
  snapshotMemory?: boolean | number;
  enabled?: boolean | number;
  lastRunAt?: string;
}

export interface SnapshotPolicyInput {
  name: string;
  platformId?: string;
  vmId?: string;
  cronExpression?: string;
  retention?: number;
  snapshotMemory?: boolean;
  enabled?: boolean;
}

// ── VM 迁移（2026-07-21 工作区新增，未提交） ──

export interface VmMigration {
  id: string;
  vmId: string;
  vmName: string;
  sourceHost: string;
  targetHost: string;
  platformId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  reason?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface VmMigrationInput {
  platformId: string;
  vmId: string;
  targetHost: string;
  reason?: string;
}
