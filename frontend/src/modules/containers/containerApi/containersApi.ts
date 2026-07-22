/**
 * containersApi 对象（2026-07-21 拆分）
 * 把原 api.ts L351-791 的容器 / 主机 / 网络 / 端点 / 卷 / 镜像 / Compose / 快照策略 / VM 全功能 API 抽出
 *
 * 拆分原则遵循 architecture.md §3.3.1 第 3 条「向后兼容的 import 路径」——
 * 上层可通过 `import { containersApi } from '../api'` 继续访问（api.ts 重新导出）
 */
import api from '@/lib/api';
import type {
  EndpointHost,
  ContainerItem,
  ContainerListParams,
  CreateContainerInput,
  NetworkItem,
  CreateNetworkInput,
  EndpointItem,
  EndpointInput,
  ContainerStats,
  ClusterSnapshot,
  PaginatedResult,
  VmPlatform,
  VmPlatformInput,
  VM,
  VmListParams,
  VmListResult,
  VmInput,
  VmStats,
  VmSnapshot,
  SnapshotInput,
  CloneInput,
  AggregatedStats,
  Volume,
  VolumeInput,
  Image,
  PullImageInput,
  Registry,
  RegistryInput,
  RegistryImage,
  ComposeProject,
  ComposeInput,
  ComposeService,
  ComposeValidateResult,
  SnapshotPolicy,
  SnapshotPolicyInput,
} from './types';

export const containersApi = {
  // ── Docker 主机 ──

  /** 获取 Docker 主机列表 */
  async listHosts(): Promise<EndpointHost[]> {
    const { data } = await api.get('/containers/hosts');
    return data.data || [];
  },

  // ── 容器 ──

  /** 获取容器列表（分页） */
  async listContainers(params?: ContainerListParams): Promise<PaginatedResult<ContainerItem>> {
    const { data } = await api.get('/containers', { params });
    return data;
  },

  /** 创建并运行容器 */
  async runContainer(input: CreateContainerInput, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post('/containers/run', input, { params });
    return data;
  },

  /** 获取容器详情 */
  async getContainer(id: string, params?: { endpointId?: string }): Promise<ContainerItem> {
    const { data } = await api.get(`/containers/${id}`, { params });
    return data.data;
  },

  /** 容器操作（start/stop/restart） */
  async containerAction(id: string, action: string, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post(`/containers/${id}/${action}`, null, { params });
    return data;
  },

  /** 删除容器 */
  async deleteContainer(id: string, params?: { endpointId?: string }): Promise<void> {
    await api.delete(`/containers/${id}`, { params });
  },

  /** 获取容器日志 */
  async getContainerLogs(id: string, params?: { tail?: number; endpointId?: string }): Promise<string> {
    const { data } = await api.get(`/containers/logs/${id}`, { params });
    return data.data;
  },

  /** 获取容器状态统计 */
  async getContainerStats(id: string, params?: { endpointId?: string }): Promise<ContainerStats> {
    const { data } = await api.get(`/containers/stats/${id}`, { params });
    return data.data;
  },

  // ── Docker 网络 ──

  /** 获取网络列表 */
  async listNetworks(params?: { endpointId?: string }): Promise<NetworkItem[]> {
    const { data } = await api.get('/containers/networks/list', { params });
    return data.data || [];
  },

  /** 获取网络详情 */
  async getNetwork(id: string, params?: { endpointId?: string }): Promise<NetworkItem> {
    const { data } = await api.get(`/containers/networks/${id}`, { params });
    return data.data;
  },

  /** 创建网络 */
  async createNetwork(input: CreateNetworkInput, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post('/containers/networks', input, { params });
    return data;
  },

  /** 删除网络 */
  async deleteNetwork(id: string, params?: { endpointId?: string }): Promise<void> {
    await api.delete(`/containers/networks/${id}`, { params });
  },

  // ── Docker 端点 ──

  /** 获取端点列表 */
  async listEndpoints(): Promise<EndpointItem[]> {
    const { data } = await api.get('/containers/endpoints');
    return data.data || [];
  },

  /** 创建端点 */
  async createEndpoint(input: EndpointInput): Promise<unknown> {
    const { data } = await api.post('/containers/endpoints', input);
    return data;
  },

  /** 更新端点 */
  async updateEndpoint(id: string, input: EndpointInput): Promise<unknown> {
    const { data } = await api.put(`/containers/endpoints/${id}`, input);
    return data;
  },

  /** 删除端点 */
  async deleteEndpoint(id: string): Promise<void> {
    await api.delete(`/containers/endpoints/${id}`);
  },

  /** 测试端点连接 */
  async testEndpoint(input: EndpointInput): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/containers/endpoints/test', input);
    return data.data;
  },

  /** 刷新端点 */
  async refreshEndpoint(id: string): Promise<unknown> {
    const { data } = await api.post(`/containers/endpoints/${id}/refresh`);
    return data;
  },

  // ── Docker 数据卷（容器内） ──

  /** 获取 Docker 数据卷列表 */
  async listDockerVolumes(params?: { endpointId?: string }): Promise<unknown[]> {
    const { data } = await api.get('/containers/volumes/list', { params });
    return data.data || [];
  },

  /** 创建 Docker 数据卷 */
  async createDockerVolume(input: { name: string; driver: string }, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post('/containers/volumes', input, { params });
    return data;
  },

  /** 删除 Docker 数据卷 */
  async deleteDockerVolume(id: string, params?: { endpointId?: string }): Promise<void> {
    await api.delete(`/containers/volumes/${id}`, { params });
  },

  // ── Docker 镜像（容器内） ──

  /** 获取 Docker 镜像列表 */
  async listDockerImages(params?: { endpointId?: string }): Promise<unknown[]> {
    const { data } = await api.get('/containers/images/list', { params });
    return data.data || [];
  },

  /** 拉取 Docker 镜像 */
  async pullDockerImage(image: string, params?: { endpointId?: string }): Promise<unknown> {
    const { data } = await api.post('/containers/images/pull', { image }, { params });
    return data;
  },

  /** 删除 Docker 镜像 */
  async deleteDockerImage(id: string, params?: { endpointId?: string }): Promise<void> {
    await api.delete(`/containers/images/${id}`, { params });
  },

  // ── Docker 监控 ──

  /** 获取集群快照 */
  async getClusterSnapshot(): Promise<ClusterSnapshot> {
    const { data } = await api.get('/docker-monitor/cluster-snapshot');
    return data.data;
  },

  /** 启动容器监控 */
  async startMonitor(containerId: string): Promise<void> {
    await api.post(`/docker-monitor/start/${containerId}`);
  },

  /** 停止容器监控 */
  async stopMonitor(containerId: string): Promise<void> {
    await api.post(`/docker-monitor/stop/${containerId}`);
  },

  // ── 虚拟机平台 ──

  /** 获取虚拟化平台列表 */
  async listPlatforms(): Promise<VmPlatform[]> {
    const { data } = await api.get('/virtual-machines/platforms');
    return data.data;
  },

  /** 添加虚拟化平台 */
  async createPlatform(input: VmPlatformInput): Promise<unknown> {
    const { data } = await api.post('/virtual-machines/platforms', input);
    return data;
  },

  /** 删除虚拟化平台 */
  async deletePlatform(id: string): Promise<void> {
    await api.delete(`/virtual-machines/platforms/${id}`);
  },

  /** 测试平台连接 */
  async testPlatform(id: string): Promise<{ message?: string }> {
    const { data } = await api.post(`/virtual-machines/platforms/${id}/test`);
    return data.data;
  },

  // ── 虚拟机 ──

  /** 获取虚拟机列表（分页） */
  async listVMs(params?: VmListParams): Promise<VmListResult> {
    const { data } = await api.get('/virtual-machines', { params });
    return data;
  },

  /** 创建虚拟机 */
  async createVM(input: VmInput): Promise<unknown> {
    const { data } = await api.post('/virtual-machines', input);
    return data;
  },

  /** 更新虚拟机 */
  async updateVM(id: string, input: VmInput): Promise<unknown> {
    const { data } = await api.put(`/virtual-machines/${id}`, input);
    return data;
  },

  /** 删除虚拟机 */
  async deleteVM(id: string): Promise<void> {
    await api.delete(`/virtual-machines/${id}`);
  },

  /** 虚拟机电源操作（start/stop/restart） */
  async vmAction(id: string, action: string): Promise<unknown> {
    const { data } = await api.post(`/virtual-machines/${id}/${action}`);
    return data;
  },

  /** 克隆虚拟机 */
  async cloneVM(id: string, input: CloneInput): Promise<unknown> {
    const { data } = await api.post(`/virtual-machines/${id}/clone`, input);
    return data;
  },

  /** 同步虚拟机 */
  async syncVMs(params?: { platformId?: string }): Promise<{ synced?: number }> {
    const { data } = await api.post('/virtual-machines/sync', params);
    return data.data;
  },

  /** 获取聚合统计 */
  async getAggregatedStats(): Promise<AggregatedStats> {
    const { data } = await api.get('/virtual-machines/stats');
    return data.data;
  },

  /** 获取虚拟机性能统计 */
  async getVMStats(id: string): Promise<VmStats> {
    const { data } = await api.get(`/virtual-machines/${id}/stats`);
    return data.data;
  },

  // ── 虚拟机快照 ──

  /** 获取快照列表 */
  async listSnapshots(vmId: string): Promise<VmSnapshot[]> {
    const { data } = await api.get(`/virtual-machines/${vmId}/snapshots`);
    return data.data;
  },

  /** 创建快照 */
  async createSnapshot(vmId: string, input: SnapshotInput): Promise<unknown> {
    const { data } = await api.post(`/virtual-machines/${vmId}/snapshots`, input);
    return data;
  },

  /** 恢复快照 */
  async restoreSnapshot(vmId: string, snapshotId: string): Promise<unknown> {
    const { data } = await api.post(`/virtual-machines/${vmId}/snapshots/${snapshotId}/restore`);
    return data;
  },

  /** 删除快照 */
  async deleteSnapshot(vmId: string, snapshotId: string): Promise<void> {
    await api.delete(`/virtual-machines/${vmId}/snapshots/${snapshotId}`);
  },

  // ── 存储卷（独立） ──

  /** 获取存储卷列表（分页） */
  async listVolumes(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResult<Volume>> {
    const { data } = await api.get('/volumes', { params });
    return data;
  },

  /** 创建存储卷 */
  async createVolume(input: VolumeInput): Promise<unknown> {
    const { data } = await api.post('/volumes', input);
    return data;
  },

  /** 更新存储卷 */
  async updateVolume(id: string, input: VolumeInput): Promise<unknown> {
    const { data } = await api.put(`/volumes/${id}`, input);
    return data;
  },

  /** 删除存储卷 */
  async deleteVolume(id: string): Promise<void> {
    await api.delete(`/volumes/${id}`);
  },

  /** 同步存储卷 */
  async syncVolumes(serverId?: string): Promise<{ synced?: number }> {
    const { data } = await api.post('/volumes/sync', { serverId });
    return data.data;
  },

  // ── 镜像（独立） ──

  /** 获取镜像列表（分页） */
  async listImages(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResult<Image>> {
    const { data } = await api.get('/images', { params });
    return data;
  },

  /** 同步镜像 */
  async syncImages(serverId?: string): Promise<{ synced?: number }> {
    const { data } = await api.post('/images/sync', { serverId });
    return data.data;
  },

  /** 拉取镜像 */
  async pullImage(input: PullImageInput): Promise<unknown> {
    const { data } = await api.post('/images/pull', input);
    return data;
  },

  /** 删除镜像 */
  async deleteImage(id: string): Promise<void> {
    await api.delete(`/images/${id}`);
  },

  // ── 镜像仓库 ──

  /** 获取镜像仓库列表 */
  async listRegistries(): Promise<Registry[]> {
    const { data } = await api.get('/registries');
    return data.data || [];
  },

  /** 添加镜像仓库 */
  async createRegistry(input: RegistryInput): Promise<unknown> {
    const { data } = await api.post('/registries', input);
    return data;
  },

  /** 更新镜像仓库 */
  async updateRegistry(id: string, input: RegistryInput): Promise<unknown> {
    const { data } = await api.put(`/registries/${id}`, input);
    return data;
  },

  /** 删除镜像仓库 */
  async deleteRegistry(id: string): Promise<void> {
    await api.delete(`/registries/${id}`);
  },

  /** 测试镜像仓库连接 */
  async testRegistry(id: string): Promise<void> {
    await api.post(`/registries/${id}/test`);
  },

  /** 获取仓库内镜像列表 */
  async listRegistryImages(id: string): Promise<RegistryImage[]> {
    const { data } = await api.get(`/registries/${id}/images`);
    return data.data || [];
  },

  // ── Compose 编排 ──

  /** 获取 Compose 项目列表（分页） */
  async listCompose(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResult<ComposeProject>> {
    const { data } = await api.get('/compose', { params });
    return data;
  },

  /** 创建 Compose 项目 */
  async createCompose(input: ComposeInput): Promise<unknown> {
    const { data } = await api.post('/compose', input);
    return data;
  },

  /** 更新 Compose 项目 */
  async updateCompose(id: string, input: ComposeInput): Promise<unknown> {
    const { data } = await api.put(`/compose/${id}`, input);
    return data;
  },

  /** 删除 Compose 项目 */
  async deleteCompose(id: string): Promise<void> {
    await api.delete(`/compose/${id}`);
  },

  /** Compose 项目操作（up/down/restart） */
  async composeAction(id: string, action: string): Promise<unknown> {
    const { data } = await api.post(`/compose/${id}/${action}`);
    return data;
  },

  /** 验证 YAML 语法 */
  async validateCompose(content: string): Promise<ComposeValidateResult> {
    const { data } = await api.post('/compose/validate', { content });
    return data;
  },

  /** 获取 Compose 服务列表 */
  async listComposeServices(id: string): Promise<ComposeService[]> {
    const { data } = await api.get(`/compose/${id}/services`);
    return data.data || [];
  },

  /** 获取 Compose 日志 */
  async getComposeLogs(id: string, params?: { tail?: number }): Promise<string> {
    const { data } = await api.get(`/compose/${id}/logs`, { params });
    return typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
  },

  // ── 快照策略 ──

  /** 获取快照策略列表（分页） */
  async listSnapshotPolicies(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedResult<SnapshotPolicy>> {
    const { data } = await api.get('/snapshot-policies', { params });
    return data;
  },

  /** 创建快照策略 */
  async createSnapshotPolicy(input: SnapshotPolicyInput): Promise<unknown> {
    const { data } = await api.post('/snapshot-policies', input);
    return data;
  },

  /** 更新快照策略 */
  async updateSnapshotPolicy(id: string, input: SnapshotPolicyInput): Promise<unknown> {
    const { data } = await api.put(`/snapshot-policies/${id}`, input);
    return data;
  },

  /** 删除快照策略 */
  async deleteSnapshotPolicy(id: string): Promise<void> {
    await api.delete(`/snapshot-policies/${id}`);
  },
};
