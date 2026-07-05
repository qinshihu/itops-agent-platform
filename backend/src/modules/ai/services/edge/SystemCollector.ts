/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'os';
import { logger } from '../../../../utils/logger';
import type {
  HostInfo,
  HostLoad,
  ProcessListResponse,
  CollectorOutput,
  PromSample
} from './types';

/**
 * 系统指标收集器
 */
export class SystemCollector {
  private previousStats: {
    timestamp: number;
    networkBytesIn: number;
    networkBytesOut: number;
  } | null = null;

  /**
   * 收集所有指标
   */
  async collectAll(): Promise<CollectorOutput[]> {
    const outputs: CollectorOutput[] = [];

    try {
      const hostLoad = await this.getHostLoad();
      const samples = this.toPromSamples(hostLoad);

      outputs.push({
        source: 'system',
        hostPoint: {
          timestamp: hostLoad.timestamp,
          cpuUsage: hostLoad.cpuUsage,
          memoryUsage: hostLoad.memoryUsage,
          diskUsage: hostLoad.diskUsage,
          networkIn: hostLoad.networkIn,
          networkOut: hostLoad.networkOut,
          load1: hostLoad.load1,
          load5: hostLoad.load5,
          load15: hostLoad.load15
        },
        samples
      });
    } catch (error) {
      logger.warn('[SystemCollector] Failed to collect metrics', error);
    }

    return outputs;
  }

  /**
   * 获取主机信息
   */
  async getHostInfo(): Promise<HostInfo> {
    // 这里使用简化的实现，实际项目可以使用 systeminformation 库
    return {
      hostname: os.hostname(),
      os: os.type(),
      osVersion: os.release(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      totalDisk: 1000000000000, // 1TB 占位
      ipAddresses: this.getIPAddresses(),
      uptime: Math.floor(os.uptime()),
      bootTime: Math.floor(Date.now() / 1000 - os.uptime())
    };
  }

  /**
   * 获取主机负载
   */
  async getHostLoad(): Promise<HostLoad> {
    const now = Date.now();
    const timestamp = Math.floor(now / 1000);

    // CPU 使用率
    const cpus = os.cpus();
    const cpuUsage = this.calculateCpuUsage(cpus);

    // 内存
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    // 负载
    const loadAvg = os.loadavg();

    // 网络流量（简化实现）
    let networkIn = 0;
    let networkOut = 0;

    if (this.previousStats) {
      // 这里简化处理，实际应该读取网络接口统计
      // 示例：随机值模拟网络流量
      networkIn = Math.floor(Math.random() * 1000000);
      networkOut = Math.floor(Math.random() * 1000000);
    }

    this.previousStats = {
      timestamp,
      networkBytesIn: networkIn,
      networkBytesOut: networkOut
    };

    return {
      timestamp,
      cpuUsage,
      cpuCores: cpus.length,
      memoryUsage,
      memoryTotal: totalMemory,
      memoryUsed: usedMemory,
      swapUsage: 0,
      diskUsage: 50, // 占位值
      diskTotal: 1000000000000,
      diskUsed: 500000000000,
      networkIn,
      networkOut,
      load1: loadAvg[0],
      load5: loadAvg[1],
      load15: loadAvg[2],
      processCount: 0
    };
  }

  /**
   * 获取进程列表
   */
  async getProcessList(_topN = 20, _sortBy = 'cpu'): Promise<ProcessListResponse> {
    // 简化实现，返回空列表
    return {
      sampledAt: Math.floor(Date.now() / 1000),
      processes: [],
      totalProcesses: 0
    };
  }

  /**
   * 计算 CPU 使用率
   */
  private calculateCpuUsage(cpus: any[]): number {
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  /**
   * 获取 IP 地址
   */
  private getIPAddresses(): string[] {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    for (const name in interfaces) {
      const iface = interfaces[name];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1') {
          addresses.push(alias.address);
        }
      }
    }

    return addresses;
  }

  /**
   * 转换为 Prometheus 样本格式
   */
  private toPromSamples(hostLoad: HostLoad): PromSample[] {
    const samples: PromSample[] = [];
    const timestamp = hostLoad.timestamp;

    samples.push({
      name: 'node_cpu_usage_percent',
      labels: {},
      value: hostLoad.cpuUsage,
      timestamp
    });

    samples.push({
      name: 'node_memory_usage_percent',
      labels: {},
      value: hostLoad.memoryUsage,
      timestamp
    });

    samples.push({
      name: 'node_memory_used_bytes',
      labels: {},
      value: hostLoad.memoryUsed,
      timestamp
    });

    samples.push({
      name: 'node_memory_total_bytes',
      labels: {},
      value: hostLoad.memoryTotal,
      timestamp
    });

    samples.push({
      name: 'node_disk_usage_percent',
      labels: {},
      value: hostLoad.diskUsage,
      timestamp
    });

    samples.push({
      name: 'node_load1',
      labels: {},
      value: hostLoad.load1,
      timestamp
    });

    samples.push({
      name: 'node_load5',
      labels: {},
      value: hostLoad.load5,
      timestamp
    });

    samples.push({
      name: 'node_load15',
      labels: {},
      value: hostLoad.load15,
      timestamp
    });

    samples.push({
      name: 'node_network_receive_bytes',
      labels: {},
      value: hostLoad.networkIn,
      timestamp
    });

    samples.push({
      name: 'node_network_transmit_bytes',
      labels: {},
      value: hostLoad.networkOut,
      timestamp
    });

    return samples;
  }
}
