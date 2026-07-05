/**
 * =============================================================================
 * Docker 管理服务 - 容器操作
 * =============================================================================
 */

import type Docker from 'dockerode';
import type { DockerServiceClass, DockerContainer, DockerContainerDetail, DockerContainerStats } from './dockerService';
import { logger } from '../../../../utils/logger';

type DS = InstanceType<typeof DockerServiceClass>;

export async function impl_listContainers(service: DS, all = true): Promise<DockerContainer[]> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const containers = await service.docker.listContainers({ all });
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

export async function impl_getContainer(service: DS, id: string): Promise<DockerContainerDetail> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
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

export async function impl_startContainer(service: DS, id: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.start();
  logger.info(`Container ${id} started`);
}

export async function impl_stopContainer(service: DS, id: string, timeout = 10): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.stop({ t: timeout });
  logger.info(`Container ${id} stopped`);
}

export async function impl_restartContainer(service: DS, id: string, timeout = 10): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.restart({ t: timeout });
  logger.info(`Container ${id} restarted`);
}

export async function impl_removeContainer(service: DS, id: string, force = false, v = false): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.remove({ force, v });
  logger.info(`Container ${id} removed`);
}

export async function impl_getContainerLogs(service: DS, id: string, tail = 100, timestamps = true): Promise<string> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps,
  });
  
  return logs.toString('utf-8');
}

export async function impl_getContainerStats(service: DS, id: string): Promise<DockerContainerStats> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
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

export async function impl_pauseContainer(service: DS, id: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.pause();
  logger.info(`Container ${id} paused`);
}

export async function impl_unpauseContainer(service: DS, id: string): Promise<void> {
  if (!service.initialized) throw new Error('Docker service not available');
  
  const container = service.docker.getContainer(id);
  await container.unpause();
  logger.info(`Container ${id} unpaused`);
}