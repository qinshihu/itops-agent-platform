import { dockerService } from './dockerService';
import { logger } from '../../../utils/logger';
import type { Server as SocketIOServer } from 'socket.io';
import { getErrorMessage } from '../../../utils/errorHelpers';

class ContainerMonitorService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private io: SocketIOServer | null = null;

  setIO(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * 开始监控指定容器，定期推送统计信息到 WebSocket
   * @param containerId - Docker 容器 ID
   * @param intervalMs - 采集间隔（毫秒），默认 5000
   */
  startMonitoring(containerId: string, intervalMs = 5000): void {
    if (this.intervals.has(containerId)) return;
    
    logger.info(`📊 Starting container monitoring: ${containerId}`);
    
    const interval = setInterval(async () => {
      try {
        const stats = await dockerService.getContainerStats(containerId);
        const container = await dockerService.getContainer(containerId);
        
        if (this.io) {
          this.io.to(`container:${containerId}`).emit('container:stats', {
            containerId,
            name: container.name,
            ...stats,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        logger.error(`Monitor error for ${containerId}:`, getErrorMessage(err));
        this.stopMonitoring(containerId);
      }
    }, intervalMs);
    
    this.intervals.set(containerId, interval);
  }

  /**
   * 停止监控指定容器
   */
  stopMonitoring(containerId: string): void {
    const interval = this.intervals.get(containerId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(containerId);
      logger.info(`📊 Stopped container monitoring: ${containerId}`);
    }
  }

  /**
   * 停止所有监控
   */
  stopAll(): void {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
  }

  /**
   * 获取正在监控的容器列表
   */
  getMonitoredContainers(): string[] {
    return Array.from(this.intervals.keys());
  }

  /**
   * 获取所有运行中容器的摘要统计（一次性快照）
   */
  async getClusterSnapshot(): Promise<unknown> {
    try {
      const containers = await dockerService.listContainers(true);
      const statsPromises = containers
        .filter(c => c.state === 'running')
        .slice(0, 50) // 限制并发
        .map(async (c) => {
          try {
            const stats = await dockerService.getContainerStats(c.id);
            return { id: c.id, name: c.name, ...stats };
          } catch { return null; }
        });
      
      const results = (await Promise.all(statsPromises)).filter(Boolean);
      
      // 聚合计算
      let totalCpu = 0, totalMemUsage = 0, totalMemLimit = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results.forEach((r: any) => {
        totalCpu += parseFloat(r.cpuPercent || 0);
        totalMemUsage += r.memory?.usage || 0;
        totalMemLimit += r.memory?.limit || 0;
      });
      
      return {
        // 2026-07-23 字段名与前端 ClusterSnapshot 对齐：
        // containerCount/totalMemUsage/totalMemLimit → 与前端 totalContainers/totalMemoryUsage/totalMemoryLimit 不匹配
        // （axios 拦截器已解包 → 前端拿到的就是本对象）
        // 改为前端字段名（全栈对齐），同时保留旧字段作为 alias 以防其他调用方
        containerCount: containers.length,
        runningCount: containers.filter(c => c.state === 'running').length,
        totalContainers: containers.length,
        runningContainers: containers.filter(c => c.state === 'running').length,
        totalCpuPercent: totalCpu.toFixed(2),
        totalMemUsage,
        totalMemLimit,
        totalMemoryUsage: totalMemUsage,
        totalMemoryLimit: totalMemLimit,
        totalMemPercent: totalMemLimit > 0 ? ((totalMemUsage / totalMemLimit) * 100).toFixed(2) : '0',
        totalMemoryPercent: totalMemLimit > 0 ? ((totalMemUsage / totalMemLimit) * 100).toFixed(2) : '0',
        containers: results,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('Cluster snapshot error:', err);
      return null;
    }
  }
}

export const containerMonitorService = new ContainerMonitorService();
