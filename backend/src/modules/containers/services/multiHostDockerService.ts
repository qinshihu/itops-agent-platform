/* eslint-disable @typescript-eslint/no-explicit-any */
import Docker from 'dockerode';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { dockerEndpointRepository } from '../../../../repositories';
import { getErrorMessage } from '../../../utils/errorHelpers';

interface DockerEndpoint {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'socket' | 'tcp' | 'tcp+tls';
  tlsCa?: string;
  tlsCert?: string;
  tlsKey?: string;
  status: 'active' | 'inactive' | 'error';
  errorMessage?: string;
  containersRunning: number;
  containersTotal: number;
  images: number;
  cpuCount: number;
  memoryLimit: number;
  createdAt: string;
  updatedAt: string;
}

interface DockerEndpointRow {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  tls_ca?: string;
  tls_cert?: string;
  tls_key?: string;
  status: string;
  error_message?: string;
  containers_running: number;
  containers_total: number;
  images: number;
  cpu_count: number;
  memory_limit: number;
  created_at: string;
  updated_at: string;
}

class MultiHostDockerService {
  private endpoints: Map<string, Docker> = new Map();

  constructor() {
    // 表结构由 migration v046 维护；本服务的运行时端点加载由 initialize() 负责。
  }

  /**
   * 启动时加载已激活的 Docker 端点客户端
   * （原 ensureTables() 的运行时部分，schema 已下沉到 migration v046）
   */
  initialize() {
    this.loadEndpoints();
  }

  private loadEndpoints() {
    try {
      const rows = dockerEndpointRepository.listByStatus('active');
      for (const row of rows) {
        this.createDockerClient(row);
      }
      logger.info(`📋 Loaded ${rows.length} Docker endpoints`);
    } catch (err) {
      logger.error('Failed to load Docker endpoints:', err);
    }
  }

  private createDockerClient(config: any): Docker {
    try {
      let docker: Docker;
      if (config.protocol === 'socket') {
        docker = new Docker({ socketPath: '/var/run/docker.sock' });
      } else {
        const opts: Record<string, unknown> = {
          host: config.host,
          port: config.port || 2375,
          protocol: config.protocol === 'tcp+tls' ? 'https' : 'http',
        };
        if (config.tls_ca && config.tls_cert && config.tls_key) {
          opts.ca = Buffer.from(config.tls_ca);
          opts.cert = Buffer.from(config.tls_cert);
          opts.key = Buffer.from(config.tls_key);
        }
        docker = new Docker(opts);
      }
      this.endpoints.set(config.id, docker);
      return docker;
    } catch (err) {
      logger.error(`Failed to create Docker client for ${config.name}:`, err);
      throw err;
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
    try {
      let docker: Docker;
      if (config.protocol === 'socket') {
        docker = new Docker({ socketPath: '/var/run/docker.sock' });
      } else {
        const opts: Record<string, unknown> = {
          host: config.host,
          port: config.port || 2375,
          protocol: config.protocol === 'tcp+tls' ? 'https' : 'http',
        };
        if (config.tlsCa || config.tls_ca) {
          opts.ca = Buffer.from((config.tlsCa || config.tls_ca) as string);
          opts.cert = Buffer.from((config.tlsCert || config.tls_cert) as string);
          opts.key = Buffer.from((config.tlsKey || config.tls_key) as string);
        }
        docker = new Docker(opts);
      }
      await docker.ping();
      const info = await docker.info();
      return { success: true, message: `Docker ${info.ServerVersion} on ${info.OperatingSystem}` };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err) };
    }
  }

  async addEndpoint(config: Omit<DockerEndpoint, 'id' | 'containersRunning' | 'containersTotal' | 'images' | 'cpuCount' | 'memoryLimit' | 'createdAt' | 'updatedAt'>): Promise<DockerEndpoint> {
    const id = randomUUID();

    dockerEndpointRepository.create({
      id,
      name: config.name,
      host: config.host,
      port: config.port,
      protocol: config.protocol,
      tls_ca: config.tlsCa || null,
      tls_cert: config.tlsCert || null,
      tls_key: config.tlsKey || null,
      status: config.status,
    });

    this.createDockerClient({ ...config, id });
    return this.getEndpoint(id)!;
  }

  async updateEndpoint(endpointId: string, updates: Partial<DockerEndpoint>): Promise<DockerEndpoint> {
    const existing = this.getEndpoint(endpointId);
    if (!existing) throw new Error('端点不存在');

    const fields: Record<string, unknown> = {};
    if (updates.name !== undefined) fields.name = updates.name;
    if (updates.host !== undefined) fields.host = updates.host;
    if (updates.port !== undefined) fields.port = updates.port;
    if (updates.protocol !== undefined) fields.protocol = updates.protocol;
    if (updates.tlsCa !== undefined) fields.tls_ca = updates.tlsCa;
    if (updates.tlsCert !== undefined) fields.tls_cert = updates.tlsCert;
    if (updates.tlsKey !== undefined) fields.tls_key = updates.tlsKey;
    if (updates.status !== undefined) fields.status = updates.status;
    dockerEndpointRepository.update(endpointId, fields);

    // 重建客户端
    this.endpoints.delete(endpointId);
    this.createDockerClient({ ...existing, ...updates, id: endpointId });

    return this.getEndpoint(endpointId)!;
  }

  async deleteEndpoint(endpointId: string): Promise<void> {
    this.endpoints.delete(endpointId);
    dockerEndpointRepository.delete(endpointId);
  }

  getEndpoint(endpointId: string): DockerEndpoint | null {
    const row = dockerEndpointRepository.getById(endpointId);
    if (!row) return null;
    return this.rowToEndpoint(row);
  }

  listEndpoints(): DockerEndpoint[] {
    const rows = dockerEndpointRepository.list();
    return rows.map((r) => this.rowToEndpoint(r));
  }

  private rowToEndpoint(row: DockerEndpointRow): DockerEndpoint {
    return {
      id: row.id, name: row.name, host: row.host, port: row.port,
      protocol: row.protocol as DockerEndpoint['protocol'], tlsCa: row.tls_ca, tlsCert: row.tls_cert, tlsKey: row.tls_key,
      status: row.status as DockerEndpoint['status'], errorMessage: row.error_message,
      containersRunning: row.containers_running, containersTotal: row.containers_total,
      images: row.images, cpuCount: row.cpu_count, memoryLimit: row.memory_limit,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  getDockerClient(endpointId: string): Docker {
    const client = this.endpoints.get(endpointId);
    if (!client) throw new Error('Docker 端点未连接');
    return client;
  }

  async refreshEndpointInfo(endpointId: string): Promise<void> {
    try {
      const docker = this.getDockerClient(endpointId);
      await docker.ping();
      const info = await docker.info();

      dockerEndpointRepository.updateStatus(endpointId, 'active', {
        containersRunning: info.ContainersRunning,
        containersTotal: info.Containers,
        images: info.Images,
        cpuCount: info.NCPU,
        memoryLimit: info.MemTotal,
      });
    } catch (err: unknown) {
      dockerEndpointRepository.updateStatus(endpointId, 'error', {
        errorMessage: getErrorMessage(err),
      });
    }
  }
}

export const multiHostDockerService = new MultiHostDockerService();
