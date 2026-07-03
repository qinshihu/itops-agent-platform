/**
 * Containers 模块 API 服务层
 * 封装容器、虚拟机、存储卷、镜像、镜像仓库、Compose 编排、快照策略相关端点
 */

import api from '@/lib/api';

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

// ============================================================
// containersApi 对象
// ============================================================

export const containersApi = {
  // ── Docker 主机 ──

  /** 获取 Docker 主机列表 */
  async listHosts(): Promise<EndpointHost[]> {
    const { data } = await api.get('/api/containers/hosts');
    return data.data || [];
  },

  // ── 容器 ──

  /** 获取容器列表（分页） */
  async listContainers(params?: ContainerListParams): Promise<PaginatedResult<ContainerItem>> {
    const { data } = await api.get('/api/containers', { params });
    return data;
  },

  /** 创建并运行容器 */
  async runContainer(input: CreateContainerInput, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post('/api/containers/run', input, { params });
    return data;
  },

  /** 获取容器详情 */
  async getContainer(id: string, params?: { endpointId?: string }): Promise<ContainerItem> {
    const { data } = await api.get(`/api/containers/${id}`, { params });
    return data.data;
  },

  /** 容器操作（start/stop/restart） */
  async containerAction(id: string, action: string, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post(`/api/containers/${id}/${action}`, null, { params });
    return data;
  },

  /** 删除容器 */
  async deleteContainer(id: string, params?: { endpointId?: string }): Promise<void> {
    await api.delete(`/api/containers/${id}`, { params });
  },

  /** 获取容器日志 */
  async getContainerLogs(id: string, params?: { tail?: number; endpointId?: string }): Promise<string> {
    const { data } = await api.get(`/api/containers/logs/${id}`, { params });
    return data.data;
  },

  /** 获取容器状态统计 */
  async getContainerStats(id: string, params?: { endpointId?: string }): Promise<ContainerStats> {
    const { data } = await api.get(`/api/containers/stats/${id}`, { params });
    return data.data;
  },

  // ── Docker 网络 ──

  /** 获取网络列表 */
  async listNetworks(params?: { endpointId?: string }): Promise<NetworkItem[]> {
    const { data } = await api.get('/api/containers/networks/list', { params });
    return data.data || [];
  },

  /** 获取网络详情 */
  async getNetwork(id: string, params?: { endpointId?: string }): Promise<NetworkItem> {
    const { data } = await api.get(`/api/containers/networks/${id}`, { params });
    return data.data;
  },

  /** 创建网络 */
  async createNetwork(input: CreateNetworkInput, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post('/api/containers/networks', input, { params });
    return data;
  },

  /** 删除网络 */
  async deleteNetwork(id: string, params?: { endpointId?: string }): Promise<void> {
    await api.delete(`/api/containers/networks/${id}`, { params });
  },

  // ── Docker 端点 ──

  /** 获取端点列表 */
  async listEndpoints(): Promise<EndpointItem[]> {
    const { data } = await api.get('/api/containers/endpoints');
    return data.data || [];
  },

  /** 创建端点 */
  async createEndpoint(input: EndpointInput): Promise<unknown> {
    const { data } = await api.post('/api/containers/endpoints', input);
    return data;
  },

  /** 更新端点 */
  async updateEndpoint(id: string, input: EndpointInput): Promise<unknown> {
    const { data } = await api.put(`/api/containers/endpoints/${id}`, input);
    return data;
  },

  /** 删除端点 */
  async deleteEndpoint(id: string): Promise<void> {
    await api.delete(`/api/containers/endpoints/${id}`);
  },

  /** 测试端点连接 */
  async testEndpoint(input: EndpointInput): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/api/containers/endpoints/test', input);
    return data.data;
  },

  /** 刷新端点 */
  async refreshEndpoint(id: string): Promise<unknown> {
    const { data } = await api.post(`/api/containers/endpoints/${id}/refresh`);
    return data;
  },

  // ── Docker 数据卷（容器内） ──

  /** 获取 Docker 数据卷列表 */
  async listDockerVolumes(params?: { endpointId?: string }): Promise<unknown[]> {
    const { data } = await api.get('/api/containers/volumes/list', { params });
    return data.data || [];
  },

  /** 创建 Docker 数据卷 */
  async createDockerVolume(input: { name: string; driver: string }, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post('/api/containers/volumes', input, { params });
    return data;
  },

  /** 删除 Docker 数据卷 */
  async deleteDockerVolume(id: string, params?: { endpointId?: string }): Promise<void> {
    await api.delete(`/api/containers/volumes/${id}`, { params });
  },

  // ── Docker 镜像（容器内） ──

  /** 获取 Docker 镜像列表 */
  async listDockerImages(params?: { endpointId?: string }): Promise<unknown[]> {
    const { data } = await api.get('/api/containers/images/list', { params });
    return data.data || [];
  },

  /** 拉取 Docker 镜像 */
  async pullDockerImage(image: string, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post('/api/containers/images/pull', { image }, { params });
    return data;
  },

  /** 删除 Docker 镜像 */
  async deleteDockerImage(id: string, params?: { endpointId?: string }): Promise<void> {
    await api.delete(`/api/containers/images/${id}`, { params });
  },

  // ── Docker 监控 ──

  /** 获取集群快照 */
  async getClusterSnapshot(): Promise<ClusterSnapshot> {
    const { data } = await api.get('/api/docker-monitor/cluster-snapshot');
    return data.data;
  },

  /** 启动容器监控 */
  async startMonitor(containerId: string): Promise<void> {
    await api.post(`/api/docker-monitor/start/${containerId}`);
  },

  /** 停止容器监控 */
  async stopMonitor(containerId: string): Promise<void> {
    await api.post(`/api/docker-monitor/stop/${containerId}`);
  },

  // ── 虚拟机平台 ──

  /** 获取虚拟化平台列表 */
  async listPlatforms(): Promise<VmPlatform[]> {
    const { data } = await api.get('/api/virtual-machines/platforms');
    return data.data;
  },

  /** 添加虚拟化平台 */
  async createPlatform(input: VmPlatformInput): Promise<unknown> {
    const { data } = await api.post('/api/virtual-machines/platforms', input);
    return data;
  },

  /** 删除虚拟化平台 */
  async deletePlatform(id: string): Promise<void> {
    await api.delete(`/api/virtual-machines/platforms/${id}`);
  },

  /** 测试平台连接 */
  async testPlatform(id: string): Promise<{ message?: string }> {
    const { data } = await api.post(`/api/virtual-machines/platforms/${id}/test`);
    return data.data;
  },

  // ── 虚拟机 ──

  /** 获取虚拟机列表（分页） */
  async listVMs(params?: VmListParams): Promise<VmListResult> {
    const { data } = await api.get('/api/virtual-machines', { params });
    return data;
  },

  /** 创建虚拟机 */
  async createVM(input: VmInput): Promise<unknown> {
    const { data } = await api.post('/api/virtual-machines', input);
    return data;
  },

  /** 更新虚拟机 */
  async updateVM(id: string, input: VmInput): Promise<unknown> {
    const { data } = await api.put(`/api/virtual-machines/${id}`, input);
    return data;
  },

  /** 删除虚拟机 */
  async deleteVM(id: string): Promise<void> {
    await api.delete(`/api/virtual-machines/${id}`);
  },

  /** 虚拟机电源操作（start/stop/restart） */
  async vmAction(id: string, action: string): Promise<unknown> {
    const { data } = await api.post(`/api/virtual-machines/${id}/${action}`);
    return data;
  },

  /** 克隆虚拟机 */
  async cloneVM(id: string, input: CloneInput): Promise<unknown> {
    const { data } = await api.post(`/api/virtual-machines/${id}/clone`, input);
    return data;
  },

  /** 同步虚拟机 */
  async syncVMs(params?: { platformId?: string }): Promise<{ synced?: number }> {
    const { data } = await api.post('/api/virtual-machines/sync', params);
    return data.data;
  },

  /** 获取聚合统计 */
  async getAggregatedStats(): Promise<AggregatedStats> {
    const { data } = await api.get('/api/virtual-machines/stats');
    return data.data;
  },

  /** 获取虚拟机性能统计 */
  async getVMStats(id: string): Promise<VmStats> {
    const { data } = await api.get(`/api/virtual-machines/${id}/stats`);
    return data.data;
  },

  // ── 虚拟机快照 ──

  /** 获取快照列表 */
  async listSnapshots(vmId: string): Promise<VmSnapshot[]> {
    const { data } = await api.get(`/api/virtual-machines/${vmId}/snapshots`);
    return data.data;
  },

  /** 创建快照 */
  async createSnapshot(vmId: string, input: SnapshotInput): Promise<unknown> {
    const { data } = await api.post(`/api/virtual-machines/${vmId}/snapshots`, input);
    return data;
  },

  /** 恢复快照 */
  async restoreSnapshot(vmId: string, snapshotId: string): Promise<unknown> {
    const { data } = await api.post(`/api/virtual-machines/${vmId}/snapshots/${snapshotId}/restore`);
    return data;
  },

  /** 删除快照 */
  async deleteSnapshot(vmId: string, snapshotId: string): Promise<void> {
    await api.delete(`/api/virtual-machines/${vmId}/snapshots/${snapshotId}`);
  },

  // ── 存储卷（独立） ──

  /** 获取存储卷列表（分页） */
  async listVolumes(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResult<Volume>> {
    const { data } = await api.get('/api/volumes', { params });
    return data;
  },

  /** 创建存储卷 */
  async createVolume(input: VolumeInput): Promise<unknown> {
    const { data } = await api.post('/api/volumes', input);
    return data;
  },

  /** 更新存储卷 */
  async updateVolume(id: string, input: VolumeInput): Promise<unknown> {
    const { data } = await api.put(`/api/volumes/${id}`, input);
    return data;
  },

  /** 删除存储卷 */
  async deleteVolume(id: string): Promise<void> {
    await api.delete(`/api/volumes/${id}`);
  },

  /** 同步存储卷 */
  async syncVolumes(serverId?: string): Promise<{ synced?: number }> {
    const { data } = await api.post('/api/volumes/sync', { serverId });
    return data.data;
  },

  // ── 镜像（独立） ──

  /** 获取镜像列表（分页） */
  async listImages(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResult<Image>> {
    const { data } = await api.get('/api/images', { params });
    return data;
  },

  /** 同步镜像 */
  async syncImages(serverId?: string): Promise<{ synced?: number }> {
    const { data } = await api.post('/api/images/sync', { serverId });
    return data.data;
  },

  /** 拉取镜像 */
  async pullImage(input: PullImageInput): Promise<unknown> {
    const { data } = await api.post('/api/images/pull', input);
    return data;
  },

  /** 删除镜像 */
  async deleteImage(id: string): Promise<void> {
    await api.delete(`/api/images/${id}`);
  },

  // ── 镜像仓库 ──

  /** 获取镜像仓库列表 */
  async listRegistries(): Promise<Registry[]> {
    const { data } = await api.get('/api/registries');
    return data.data || [];
  },

  /** 添加镜像仓库 */
  async createRegistry(input: RegistryInput): Promise<unknown> {
    const { data } = await api.post('/api/registries', input);
    return data;
  },

  /** 更新镜像仓库 */
  async updateRegistry(id: string, input: RegistryInput): Promise<unknown> {
    const { data } = await api.put(`/api/registries/${id}`, input);
    return data;
  },

  /** 删除镜像仓库 */
  async deleteRegistry(id: string): Promise<void> {
    await api.delete(`/api/registries/${id}`);
  },

  /** 测试镜像仓库连接 */
  async testRegistry(id: string): Promise<void> {
    await api.post(`/api/registries/${id}/test`);
  },

  /** 获取仓库内镜像列表 */
  async listRegistryImages(id: string): Promise<RegistryImage[]> {
    const { data } = await api.get(`/api/registries/${id}/images`);
    return data.data || [];
  },

  // ── Compose 编排 ──

  /** 获取 Compose 项目列表（分页） */
  async listCompose(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResult<ComposeProject>> {
    const { data } = await api.get('/api/compose', { params });
    return data;
  },

  /** 创建 Compose 项目 */
  async createCompose(input: ComposeInput): Promise<unknown> {
    const { data } = await api.post('/api/compose', input);
    return data;
  },

  /** 更新 Compose 项目 */
  async updateCompose(id: string, input: ComposeInput): Promise<unknown> {
    const { data } = await api.put(`/api/compose/${id}`, input);
    return data;
  },

  /** 删除 Compose 项目 */
  async deleteCompose(id: string): Promise<void> {
    await api.delete(`/api/compose/${id}`);
  },

  /** Compose 项目操作（up/down/restart） */
  async composeAction(id: string, action: string): Promise<unknown> {
    const { data } = await api.post(`/api/compose/${id}/${action}`);
    return data;
  },

  /** 验证 YAML 语法 */
  async validateCompose(content: string): Promise<ComposeValidateResult> {
    const { data } = await api.post('/api/compose/validate', { content });
    return data;
  },

  /** 获取 Compose 服务列表 */
  async listComposeServices(id: string): Promise<ComposeService[]> {
    const { data } = await api.get(`/api/compose/${id}/services`);
    return data.data || [];
  },

  /** 获取 Compose 日志 */
  async getComposeLogs(id: string, params?: { tail?: number }): Promise<string> {
    const { data } = await api.get(`/api/compose/${id}/logs`, { params });
    return typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
  },

  // ── 快照策略 ──

  /** 获取快照策略列表（分页） */
  async listSnapshotPolicies(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResult<SnapshotPolicy>> {
    const { data } = await api.get('/api/snapshot-policies', { params });
    return data;
  },

  /** 创建快照策略 */
  async createSnapshotPolicy(input: SnapshotPolicyInput): Promise<unknown> {
    const { data } = await api.post('/api/snapshot-policies', input);
    return data;
  },

  /** 更新快照策略 */
  async updateSnapshotPolicy(id: string, input: SnapshotPolicyInput): Promise<unknown> {
    const { data } = await api.put(`/api/snapshot-policies/${id}`, input);
    return data;
  },

  /** 删除快照策略 */
  async deleteSnapshotPolicy(id: string): Promise<void> {
    await api.delete(`/api/snapshot-policies/${id}`);
  },
};

export default containersApi;
