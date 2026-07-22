/**
 * =============================================================================
 * Docker 管理服务（核心类）
 * =============================================================================
 * 提供容器、镜像、卷、网络的监控和管理功能
 * 方法实现分散在子文件中，通过 barrel export 统一导出。
 */

import Docker from 'dockerode';
import { logger } from '../../../../utils/logger';

// ── 本地类型定义 ──

/** Docker 容器摘要信息 */
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  imageId: string;
  state: string;
  status: string;
  ports: unknown;
  created: number;
  labels: Record<string, string>;
  networkSettings: unknown;
  mountLabel: string;
}

/** Docker 镜像摘要信息 */
export interface DockerImage {
  id: string;
  tags: string[];
  repository: string;
  tag: string;
  size: number;
  created: number | string;
  virtualSize: number;
  labels: Record<string, string> | undefined;
}

/** Docker 网络信息 */
export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  attachable: boolean;
  ipam: unknown;
  containers: unknown;
  options: Record<string, string> | undefined;
  labels: Record<string, string> | undefined;
  created: string;
}

/** Docker 卷信息 */
export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  labels: Record<string, string> | null;
  options: Record<string, string> | null;
  scope: string;
  created: string;
}

/** Docker 容器详情 */
export interface DockerContainerDetail {
  id: string;
  name: string;
  image: string;
  imageId: string;
  state: Record<string, unknown>;
  created: string;
  config: Record<string, unknown>;
  networkSettings: Record<string, unknown>;
  mounts: unknown;
  hostConfig: Record<string, unknown>;
}

/** Docker 镜像拉取进度回调 */
export type DockerPullProgress = (progress: Record<string, unknown>) => void;

/** Docker 创建网络选项 */
export type DockerNetworkOptions = Record<string, unknown>;

/** Docker 容器统计信息 */
export interface DockerContainerStats {
  cpuPercent: string;
  memory: Record<string, unknown>;
  network: unknown;
  pids: number;
  read: string;
}

/** Docker 系统信息 */
export interface DockerSystemInfo {
  id: string;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  driver: string;
  memoryLimit: boolean;
  swapLimit: boolean;
  cpus: number;
  os: string;
  osType: string;
  arch: string;
  kernelVersion: string;
  dockerVersion: string;
}

/** Docker 版本信息 */
export interface DockerVersion {
  version: string;
  apiVersion: string;
  minAPIVersion: string;
  gitCommit: string;
  goVersion: string;
  os: string;
  arch: string;
  kernelVersion: string;
  buildTime: Date;
}

// 从子文件导入方法实现
import {
  impl_listContainers,
  impl_getContainer,
  impl_startContainer,
  impl_stopContainer,
  impl_restartContainer,
  impl_removeContainer,
  impl_getContainerLogs,
  impl_getContainerStats,
  impl_pauseContainer,
  impl_unpauseContainer,
  impl_runContainer,
} from './containerOps';

import {
  impl_listImages,
  impl_pullImage,
  impl_removeImage,
  impl_getImageInfo,
} from './imageOps';

import {
  impl_listNetworks,
  impl_createNetwork,
  impl_removeNetwork,
  impl_getNetwork,
  impl_connectContainerToNetwork,
  impl_disconnectContainerFromNetwork,
} from './networkOps';

import {
  impl_listVolumes,
  impl_createVolume,
  impl_removeVolume,
  impl_getVolume,
} from './volumeOps';

export class DockerServiceClass {
  docker: Docker;
  initialized = false;

  constructor() {
    // 默认通过 /var/run/docker.sock 连接（Linux）或 npipe（Windows）
    this.docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
  }

  /**
   * 初始化并检查 Docker 连接
   */
  async init(): Promise<boolean> {
    try {
      await this.docker.ping();
      this.initialized = true;
      logger.info('✅ Docker service initialized');
      return true;
    } catch (_error) {
      logger.warn('⚠️ Docker socket not available, container management disabled');
      this.initialized = false;
      return false;
    }
  }

  /**
   * 检查 Docker 是否可用
   */
  isAvailable(): boolean {
    return this.initialized;
  }

  // ==================== 容器管理（委托给 containerOps.ts） ====================

  async listContainers(all = true): Promise<DockerContainer[]> {
    return impl_listContainers(this, all);
  }

  async getContainer(id: string): Promise<DockerContainerDetail> {
    return impl_getContainer(this, id);
  }

  async startContainer(id: string): Promise<void> {
    return impl_startContainer(this, id);
  }

  async stopContainer(id: string, timeout = 10): Promise<void> {
    return impl_stopContainer(this, id, timeout);
  }

  async restartContainer(id: string, timeout = 10): Promise<void> {
    return impl_restartContainer(this, id, timeout);
  }

  async removeContainer(id: string, force = false, v = false): Promise<void> {
    return impl_removeContainer(this, id, force, v);
  }

  async getContainerLogs(id: string, tail = 100, timestamps = true): Promise<string> {
    return impl_getContainerLogs(this, id, tail, timestamps);
  }

  async getContainerStats(id: string): Promise<DockerContainerStats> {
    return impl_getContainerStats(this, id);
  }

  async pauseContainer(id: string): Promise<void> {
    return impl_pauseContainer(this, id);
  }

  async unpauseContainer(id: string): Promise<void> {
    return impl_unpauseContainer(this, id);
  }

  async runContainer(
    image: string,
    name?: string,
    options: {
      env?: string[];
      ports?: Array<string | { hostPort: number; containerPort: number }>;
      restartPolicy?: string;
      labels?: Record<string, string>;
    } = {}
  ): Promise<{ id: string; name: string }> {
    return impl_runContainer(this, image, name, options);
  }

  // ==================== 镜像管理（委托给 imageOps.ts） ====================

  async listImages(): Promise<DockerImage[]> {
    return impl_listImages(this);
  }

  async pullImage(imageName: string, onProgress?: DockerPullProgress): Promise<void> {
    return impl_pullImage(this, imageName, onProgress);
  }

  async removeImage(id: string, force = false, noprune = false): Promise<void> {
    return impl_removeImage(this, id, force, noprune);
  }

  async getImageInfo(id: string): Promise<DockerImage> {
    return impl_getImageInfo(this, id);
  }

  // ==================== 卷管理（委托给 volumeOps.ts） ====================

  async listVolumes(): Promise<DockerVolume[]> {
    return impl_listVolumes(this);
  }

  async createVolume(name: string, driver = 'local', labels: Record<string, string> = {}): Promise<DockerVolume> {
    return impl_createVolume(this, name, driver, labels);
  }

  async removeVolume(name: string, force = false): Promise<void> {
    return impl_removeVolume(this, name, force);
  }

  async getVolume(name: string): Promise<DockerVolume> {
    return impl_getVolume(this, name);
  }

  // ==================== 网络管理（委托给 networkOps.ts） ====================

  async listNetworks(): Promise<DockerNetwork[]> {
    return impl_listNetworks(this);
  }

  async createNetwork(name: string, driver = 'bridge', options: DockerNetworkOptions = {}): Promise<DockerNetwork> {
    return impl_createNetwork(this, name, driver, options);
  }

  async removeNetwork(id: string): Promise<void> {
    return impl_removeNetwork(this, id);
  }

  async getNetwork(id: string): Promise<DockerNetwork> {
    return impl_getNetwork(this, id);
  }

  async connectContainerToNetwork(networkId: string, containerId: string): Promise<void> {
    return impl_connectContainerToNetwork(this, networkId, containerId);
  }

  async disconnectContainerFromNetwork(networkId: string, containerId: string): Promise<void> {
    return impl_disconnectContainerFromNetwork(this, networkId, containerId);
  }

  // ==================== 系统信息 ====================

  async getSystemInfo(): Promise<DockerSystemInfo> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const info = await this.docker.info();
    
    return {
      id: info.ID,
      containers: info.Containers,
      containersRunning: info.ContainersRunning,
      containersPaused: info.ContainersPaused,
      containersStopped: info.ContainersStopped,
      images: info.Images,
      driver: info.Driver,
      memoryLimit: info.MemoryLimit,
      swapLimit: info.SwapLimit,
      cpus: info.NCPU,
      os: info.OperatingSystem,
      osType: info.OSType,
      arch: info.Architecture,
      kernelVersion: info.KernelVersion,
      dockerVersion: info.ServerVersion,
    };
  }

  async getVersion(): Promise<DockerVersion> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const version = await this.docker.version();
    
    return {
      version: version.Version,
      apiVersion: version.ApiVersion,
      minAPIVersion: version.MinAPIVersion,
      gitCommit: version.GitCommit,
      goVersion: version.GoVersion,
      os: version.Os,
      arch: version.Arch,
      kernelVersion: version.KernelVersion,
      buildTime: version.BuildTime,
    };
  }
}

export const dockerService = new DockerServiceClass();