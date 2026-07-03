import Docker from 'dockerode';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import db from '../../../models/database';
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
      const rows = db.prepare('SELECT * FROM docker_endpoints WHERE status = ?').all('active') as any[];
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
        const opts: any = {
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

  async testConnection(config: any): Promise<{ success: boolean; message?: string }> {
    try {
      let docker: Docker;
      if (config.protocol === 'socket') {
        docker = new Docker({ socketPath: '/var/run/docker.sock' });
      } else {
        const opts: any = {
          host: config.host,
          port: config.port || 2375,
          protocol: config.protocol === 'tcp+tls' ? 'https' : 'http',
        };
        if (config.tlsCa || config.tls_ca) {
          opts.ca = Buffer.from(config.tlsCa || config.tls_ca);
          opts.cert = Buffer.from(config.tlsCert || config.tls_cert);
          opts.key = Buffer.from(config.tlsKey || config.tls_key);
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
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO docker_endpoints (id, name, host, port, protocol, tls_ca, tls_cert, tls_key, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, config.name, config.host, config.port, config.protocol, config.tlsCa || null, config.tlsCert || null, config.tlsKey || null, config.status, now, now);
    
    this.createDockerClient({ ...config, id });
    return this.getEndpoint(id)!;
  }

  async updateEndpoint(endpointId: string, updates: Partial<DockerEndpoint>): Promise<DockerEndpoint> {
    const existing = this.getEndpoint(endpointId);
    if (!existing) throw new Error('端点不存在');
    
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE docker_endpoints SET name=?, host=?, port=?, protocol=?, tls_ca=?, tls_cert=?, tls_key=?, status=?, updated_at=?
      WHERE id=?
    `).run(
      updates.name || existing.name, updates.host || existing.host, updates.port || existing.port,
      updates.protocol || existing.protocol, updates.tlsCa !== undefined ? updates.tlsCa : existing.tlsCa,
      updates.tlsCert !== undefined ? updates.tlsCert : existing.tlsCert,
      updates.tlsKey !== undefined ? updates.tlsKey : existing.tlsKey,
      updates.status || existing.status, now, endpointId
    );
    
    // 重建客户端
    this.endpoints.delete(endpointId);
    this.createDockerClient({ ...existing, ...updates, id: endpointId });
    
    return this.getEndpoint(endpointId)!;
  }

  async deleteEndpoint(endpointId: string): Promise<void> {
    this.endpoints.delete(endpointId);
    db.prepare('DELETE FROM docker_endpoints WHERE id = ?').run(endpointId);
  }

  getEndpoint(endpointId: string): DockerEndpoint | null {
    const row = db.prepare('SELECT * FROM docker_endpoints WHERE id = ?').get(endpointId) as any;
    if (!row) return null;
    return this.rowToEndpoint(row);
  }

  listEndpoints(): DockerEndpoint[] {
    const rows = db.prepare('SELECT * FROM docker_endpoints ORDER BY name').all() as any[];
    return rows.map((r: any) => this.rowToEndpoint(r));
  }

  private rowToEndpoint(row: any): DockerEndpoint {
    return {
      id: row.id, name: row.name, host: row.host, port: row.port,
      protocol: row.protocol, tlsCa: row.tls_ca, tlsCert: row.tls_cert, tlsKey: row.tls_key,
      status: row.status, errorMessage: row.error_message,
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
      
      db.prepare(`
        UPDATE docker_endpoints 
        SET status='active', error_message=NULL,
            containers_running=?, containers_total=?, images=?, cpu_count=?, memory_limit=?,
            updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(info.ContainersRunning, info.Containers, info.Images, info.NCPU, info.MemTotal, endpointId);
    } catch (err: unknown) {
      db.prepare(`
        UPDATE docker_endpoints SET status='error', error_message=?, updated_at=datetime('now','localtime') WHERE id=?
      `).run(getErrorMessage(err), endpointId);
    }
  }
}

export const multiHostDockerService = new MultiHostDockerService();
