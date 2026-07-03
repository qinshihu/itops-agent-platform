import Docker from 'dockerode';
import { logger } from '../../../utils/logger';

/**
 * Docker 管理服务
 * 提供容器、镜像、卷、网络的监控和管理功能
 * 参考 Portainer、Dockge 等成熟开源项目设计
 */

class DockerService {
  private docker: Docker;
  private initialized = false;

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

  // ==================== 容器管理 ====================

  /**
   * 获取所有容器列表
   */
  async listContainers(all = true): Promise<any[]> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const containers = await this.docker.listContainers({ all });
    return containers.map(c => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || 'unnamed',
      image: c.Image,
      imageId: c.ImageID,
      state: c.State,
      status: c.Status,
      ports: c.Ports,
      created: c.Created,
      labels: c.Labels,
      networkSettings: c.NetworkSettings,
      mountLabel: (c as Docker.ContainerInfo & { MountLabel?: string }).MountLabel || '',
    }));
  }

  /**
   * 获取容器详情
   */
  async getContainer(id: string): Promise<Record<string, unknown>> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    const info = await container.inspect();
    
    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ''),
      image: info.Config.Image,
      imageId: info.Image,
      state: {
        status: info.State.Status,
        running: info.State.Running,
        paused: info.State.Paused,
        restarting: info.State.Restarting,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt,
        exitCode: info.State.ExitCode,
        error: info.State.Error,
      },
      created: info.Created,
      config: {
        hostname: info.Config.Hostname,
        env: info.Config.Env,
        cmd: info.Config.Cmd,
        workingDir: info.Config.WorkingDir,
        labels: info.Config.Labels,
      },
      networkSettings: {
        ipAddress: (info.NetworkSettings as Record<string, unknown>).IPAddress as string || '',
        gateway: (info.NetworkSettings as Record<string, unknown>).Gateway as string || '',
        networks: info.NetworkSettings.Networks,
        ports: info.NetworkSettings.Ports,
      },
      mounts: info.Mounts,
      hostConfig: {
        restartPolicy: info.HostConfig.RestartPolicy,
        memory: info.HostConfig.Memory,
        cpuShares: info.HostConfig.CpuShares,
        privileged: info.HostConfig.Privileged,
      },
    };
  }

  /**
   * 启动容器
   */
  async startContainer(id: string): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    await container.start();
    logger.info(`Container ${id} started`);
  }

  /**
   * 停止容器
   */
  async stopContainer(id: string, timeout = 10): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    await container.stop({ t: timeout });
    logger.info(`Container ${id} stopped`);
  }

  /**
   * 重启容器
   */
  async restartContainer(id: string, timeout = 10): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    await container.restart({ t: timeout });
    logger.info(`Container ${id} restarted`);
  }

  /**
   * 删除容器
   */
  async removeContainer(id: string, force = false, v = false): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    await container.remove({ force, v });
    logger.info(`Container ${id} removed`);
  }

  /**
   * 获取容器日志
   */
  async getContainerLogs(id: string, tail = 100, timestamps = true): Promise<string> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps,
    });
    
    return logs.toString('utf-8');
  }

  /**
   * 获取容器统计信息（CPU、内存、网络等）
   */
  async getContainerStats(id: string): Promise<any> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    const stats = await container.stats({ stream: false });
    
    // 计算 CPU 使用率
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
    
    // 计算内存使用
    const memoryUsage = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);
    const memoryLimit = stats.memory_stats.limit;
    const memoryPercent = (memoryUsage / memoryLimit) * 100;
    
    return {
      cpuPercent: cpuPercent.toFixed(2),
      memory: {
        usage: memoryUsage,
        limit: memoryLimit,
        percent: memoryPercent.toFixed(2),
      },
      network: stats.networks,
      pids: stats.pids_stats?.current || 0,
      read: stats.read,
    };
  }

  /**
   * 暂停容器
   */
  async pauseContainer(id: string): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    await container.pause();
    logger.info(`Container ${id} paused`);
  }

  /**
   * 恢复容器
   */
  async unpauseContainer(id: string): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const container = this.docker.getContainer(id);
    await container.unpause();
    logger.info(`Container ${id} unpaused`);
  }

  // ==================== 镜像管理 ====================

  /**
   * 获取所有镜像列表
   */
  async listImages(): Promise<any[]> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const images = await this.docker.listImages();
    return images.map(img => ({
      id: img.Id,
      tags: img.RepoTags || [],
      repository: img.RepoTags?.[0]?.split(':')[0] || '<none>',
      tag: img.RepoTags?.[0]?.split(':')[1] || '<none>',
      size: img.Size,
      created: img.Created,
      virtualSize: img.VirtualSize,
      labels: img.Labels,
    }));
  }

  /**
   * 拉取镜像
   */
  async pullImage(imageName: string, onProgress?: (progress: any) => void): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    logger.info(`Pulling image: ${imageName}`);
    
    return new Promise((resolve, reject) => {
      this.docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.docker.modem.followProgress(stream, (err: Error | null, _output: unknown[]) => {
          if (err) {
            reject(err);
            return;
          }
          logger.info(`Image ${imageName} pulled successfully`);
          resolve();
        }, onProgress);
      });
    });
  }

  /**
   * 删除镜像
   */
  async removeImage(id: string, force = false, noprune = false): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const image = this.docker.getImage(id);
    await image.remove({ force, noprune });
    logger.info(`Image ${id} removed`);
  }

  /**
   * 获取镜像详情
   */
  async getImageInfo(id: string): Promise<any> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const image = this.docker.getImage(id);
    const info = await image.inspect();
    
    return {
      id: info.Id,
      tags: info.RepoTags || [],
      size: info.Size,
      virtualSize: info.VirtualSize,
      created: info.Created,
      architecture: info.Architecture,
      os: info.Os,
      config: info.Config,
    };
  }

  // ==================== 卷管理 ====================

  /**
   * 获取所有卷列表
   */
  async listVolumes(): Promise<any[]> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const result = await this.docker.listVolumes();
    return (result.Volumes || []).map((vol: any) => ({
      name: vol.Name,
      driver: vol.Driver,
      mountpoint: vol.Mountpoint,
      labels: vol.Labels,
      options: vol.Options,
      scope: vol.Scope,
      created: vol.CreatedAt,
    }));
  }

  /**
   * 创建卷
   */
  async createVolume(name: string, driver = 'local', labels: Record<string, string> = {}): Promise<Record<string, unknown>> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const volume = await this.docker.createVolume({
      Name: name,
      Driver: driver,
      Labels: labels,
    });
    
    logger.info(`Volume ${name} created`);
    return {
      name: volume.Name,
      driver: volume.Driver,
      mountpoint: volume.Mountpoint,
      labels: volume.Labels,
    };
  }

  /**
   * 删除卷
   */
  async removeVolume(name: string, force = false): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const volume = this.docker.getVolume(name);
    await volume.remove({ force });
    logger.info(`Volume ${name} removed`);
  }

  /**
   * 获取卷详情
   */
  async getVolume(name: string): Promise<any> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const volume = this.docker.getVolume(name);
    const info = await volume.inspect();
    
    return {
      name: info.Name,
      driver: info.Driver,
      mountpoint: info.Mountpoint,
      labels: info.Labels,
      options: info.Options,
      scope: info.Scope,
      created: (info as Record<string, unknown>).CreatedAt as string || '',
    };
  }

  // ==================== 网络管理 ====================

  /**
   * 获取所有网络列表
   */
  async listNetworks(): Promise<Record<string, unknown>[]> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const networks = await this.docker.listNetworks();
    return networks.map(net => ({
      id: net.Id,
      name: net.Name,
      driver: net.Driver,
      scope: net.Scope,
      internal: net.Internal,
      attachable: net.Attachable,
      ipam: net.IPAM,
      containers: net.Containers,
      options: net.Options,
      labels: net.Labels,
      created: net.Created,
    }));
  }

  /**
   * 创建网络
   */
  async createNetwork(name: string, driver = 'bridge', options: any = {}): Promise<any> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const network = await this.docker.createNetwork({
      Name: name,
      Driver: driver,
      ...options,
    });
    
    logger.info(`Network ${name} created`);
    return {
      id: network.id,
      name: name,
      driver: driver,
    };
  }

  /**
   * 删除网络
   */
  async removeNetwork(id: string): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const network = this.docker.getNetwork(id);
    await network.remove();
    logger.info(`Network ${id} removed`);
  }

  /**
   * 获取网络详情
   */
  async getNetwork(id: string): Promise<Record<string, unknown>> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const network = this.docker.getNetwork(id);
    const info = await network.inspect();
    
    return {
      id: info.Id,
      name: info.Name,
      driver: info.Driver,
      scope: info.Scope,
      internal: info.Internal,
      attachable: info.Attachable,
      ipam: info.IPAM,
      containers: info.Containers,
      options: info.Options,
      labels: info.Labels,
      created: info.Created,
    };
  }

  /**
   * 将容器连接到网络
   */
  async connectContainerToNetwork(networkId: string, containerId: string): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const network = this.docker.getNetwork(networkId);
    await network.connect({ Container: containerId });
    logger.info(`Container ${containerId} connected to network ${networkId}`);
  }

  /**
   * 将容器从网络断开
   */
  async disconnectContainerFromNetwork(networkId: string, containerId: string): Promise<void> {
    if (!this.initialized) throw new Error('Docker service not available');
    
    const network = this.docker.getNetwork(networkId);
    await network.disconnect({ Container: containerId });
    logger.info(`Container ${containerId} disconnected from network ${networkId}`);
  }

  // ==================== 系统信息 ====================

  /**
   * 获取 Docker 系统信息
   */
  async getSystemInfo(): Promise<any> {
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

  /**
   * 获取 Docker 版本信息
   */
  async getVersion(): Promise<any> {
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

export const dockerService = new DockerService();
