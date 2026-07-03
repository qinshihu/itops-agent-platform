import { Client } from 'ssh2';
import { serversRepo, sshKeysRepo } from '../../../../repositories/serverRepository';
import { decrypt } from '../../../auth/services/encryptionService';
import { logger } from '../../../../utils/logger';
import {
  type ServerInfo,
  type PooledConnection,
  DEFAULT_CONNECT_TIMEOUT,
  POOL_ACQUIRE_TIMEOUT,
  POOL_ACQUIRE_RETRY_INTERVAL,
  POOL_CONFIG,
  delay
} from './sshTypes';

// SSH 连接池管理类
export class SSHConnectionPool {
  private pool: Map<string, PooledConnection[]> = new Map();
  private totalConnections = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupCleanupOnShutdown();
    // Defer health check start to allow proper initialization
    // Use unref to not block process exit
    setTimeout(() => this.startHealthCheck(), 1000).unref();
  }

  private setupCleanupOnShutdown(): void {
    const cleanup = () => {
      this.closeAllConnections();
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('beforeExit', cleanup);
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, POOL_CONFIG.healthCheckInterval);
  }

  private performHealthCheck(): void {
    const now = Date.now();

    for (const [serverId, connections] of this.pool.entries()) {
      for (let i = connections.length - 1; i >= 0; i--) {
        const conn = connections[i];

        // 清理空闲超时连接
        if (!conn.inUse && (now - conn.lastUsedAt) > POOL_CONFIG.idleTimeout) {
          logger.debug(`🗑️ Closing idle SSH connection for server ${serverId}`);
          this.closeConnection(conn);
          connections.splice(i, 1);
          this.totalConnections--;
          continue;
        }

        // 健康检查：如果连续失败多次，关闭连接
        if (conn.healthCheckFailed >= 3) {
          logger.warn(`⚠️ Closing unhealthy SSH connection for server ${serverId}`);
          this.closeConnection(conn);
          connections.splice(i, 1);
          this.totalConnections--;
        }
      }

      // 清理空数组
      if (connections.length === 0) {
        this.pool.delete(serverId);
      }
    }
  }

  private closeConnection(conn: PooledConnection): void {
    try {
      conn.client.end();
    } catch {
      // Connection may already be closed
    }
  }

  private closeAllConnections(): void {
    for (const connections of this.pool.values()) {
      for (const conn of connections) {
        this.closeConnection(conn);
      }
    }
    this.pool.clear();
    this.totalConnections = 0;
    logger.info('🔌 All SSH connections closed');
  }

  private getConnectionKey(serverId: string, hostname: string, port: number, username: string): string {
    return `${serverId}:${hostname}:${port}:${username}`;
  }

  async acquire(serverId: string, options: { timeout?: number } = {}): Promise<Client> {
    const server = serversRepo.getById(serverId) as ServerInfo | undefined;
    if (!server) {
      throw new Error('Server not found');
    }

    const key = this.getConnectionKey(serverId, server.hostname, server.port || 22, server.username);
    const timeout = options.timeout ?? POOL_ACQUIRE_TIMEOUT;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const connections = this.pool.get(key) || [];

      // 查找可用的空闲连接
      for (const conn of connections) {
        if (!conn.inUse) {
          conn.inUse = true;
          conn.lastUsedAt = Date.now();
          logger.debug(`♻️ Reusing SSH connection for server ${serverId}`);
          return conn.client;
        }
      }

      // 检查是否可以创建新连接
      if (this.totalConnections < POOL_CONFIG.maxTotalConnections) {
        const serverConnections = this.pool.get(key) || [];
        if (serverConnections.length < POOL_CONFIG.maxConnectionsPerServer) {
          // 创建新连接
          logger.debug(`🔌 Creating new SSH connection for server ${serverId}`);
          const newClient = await this.createConnection(server, serverId);

          const pooledConn: PooledConnection = {
            client: newClient,
            serverId,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            inUse: true,
            healthCheckFailed: 0
          };

          if (!this.pool.has(key)) {
            this.pool.set(key, []);
          }
          this.pool.get(key)!.push(pooledConn);
          this.totalConnections++;

          return newClient;
        }
      }

      // 连接池已满，等待释放
      logger.debug(`⏳ SSH pool busy for server ${serverId}, waiting for connection release...`);
      await delay(POOL_ACQUIRE_RETRY_INTERVAL);
    }

    throw new Error(`SSH connection pool timeout: unable to acquire connection for server ${serverId} within ${timeout}ms`);
  }

  release(client: Client, success = true): void {
    for (const connections of this.pool.values()) {
      for (const conn of connections) {
        if (conn.client === client) {
          conn.inUse = false;
          conn.lastUsedAt = Date.now();

          if (!success) {
            conn.healthCheckFailed++;
            // If connection has failed multiple times, close and remove it from the pool
            if (conn.healthCheckFailed >= 3) {
              this.removeConnection(conn);
            }
          } else {
            conn.healthCheckFailed = 0;
          }

          return;
        }
      }
    }
  }

  private removeConnection(conn: PooledConnection): void {
    try {
      conn.client.end();
    } catch {
      // Ignore errors during cleanup
    }
    for (const [serverId, connections] of this.pool.entries()) {
      const idx = connections.indexOf(conn);
      if (idx !== -1) {
        connections.splice(idx, 1);
        if (connections.length === 0) {
          this.pool.delete(serverId);
        }
      }
    }
    this.totalConnections = Math.max(0, this.totalConnections - 1);
  }

  private async createConnection(server: ServerInfo, serverId: string): Promise<Client> {
    let decryptedPassword: string | undefined;
    let decryptedPrivateKey: string | undefined;
    let decryptedPassphrase: string | undefined;

    try {
      decryptedPassword = server.password ? decrypt(server.password) : undefined;
    } catch (error) {
      throw new Error(`Failed to decrypt password for server ${serverId}: ${(error as Error).message}`);
    }

    // 优先使用 ssh_key_id 从密钥表获取认证凭证
    if (server.ssh_key_id) {
      const sshKey = sshKeysRepo.getById(server.ssh_key_id) as { auth_type: string; private_key: string; passphrase?: string; username?: string; password?: string } | undefined;
      if (sshKey) {
        try {
          if (sshKey.auth_type === 'password') {
            // 密码类型：使用凭证表中的用户名和密码
            if (sshKey.password) {
              decryptedPassword = decrypt(sshKey.password);
            }
            if (sshKey.username) {
              // 更新服务器连接用户名为凭证中的用户名
              server.username = sshKey.username;
            }
          } else {
            // SSH 密钥类型
            decryptedPrivateKey = decrypt(sshKey.private_key);
            // 如果私钥有 passphrase，解密后传入 ssh2
            if (sshKey.passphrase) {
              decryptedPassphrase = decrypt(sshKey.passphrase);
            }
          }
        } catch (error) {
          throw new Error(`Failed to decrypt SSH credential for server ${serverId}: ${(error as Error).message}`);
        }
      }
    }
    // 回退到直接存储的私钥
    else if (server.private_key) {
      try {
        decryptedPrivateKey = decrypt(server.private_key);
      } catch (error) {
        throw new Error(`Failed to decrypt SSH key for server ${serverId}: ${(error as Error).message}`);
      }
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();
      let connectTimeout: NodeJS.Timeout | null = null;
      let isResolved = false;

      const safeResolve = (client: Client) => {
        if (!isResolved) {
          isResolved = true;
          if (connectTimeout) clearTimeout(connectTimeout);
          resolve(client);
        }
      };

      const safeReject = (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          if (connectTimeout) clearTimeout(connectTimeout);
          try {
            conn.end();
          } catch {
            // Connection may not be established
          }
          reject(error);
        }
      };

      connectTimeout = setTimeout(() => {
        safeReject(new Error('SSH connection timeout'));
      }, DEFAULT_CONNECT_TIMEOUT);

      conn.on('ready', () => {
        logger.debug(`✅ SSH connection established to ${server.hostname}:${server.port || 22}`);
        safeResolve(conn);
      }).on('error', (err) => {
        safeReject(new Error(`SSH connection error: ${err.message}`));
      }).on('timeout', () => {
        safeReject(new Error('SSH connection timeout'));
      });

      const connectConfig: Record<string, unknown> = {
        host: server.hostname,
        port: server.port || 22,
        username: server.username,
        readyTimeout: DEFAULT_CONNECT_TIMEOUT,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3
      };

      if (server.use_ssh_key && decryptedPrivateKey) {
        connectConfig.privateKey = decryptedPrivateKey;
        // 加密的私钥需要 passphrase 解密
        if (decryptedPassphrase) {
          connectConfig.passphrase = decryptedPassphrase;
        }
      } else if (decryptedPassword) {
        connectConfig.password = decryptedPassword;
      } else {
        safeReject(new Error('No authentication method configured'));
        return;
      }

      conn.connect(connectConfig);
    });
  }

  getPoolStats(): { total: number; inUse: number; idle: number; byServer: Record<string, number> } {
    let total = 0;
    let inUse = 0;
    let idle = 0;
    const byServer: Record<string, number> = {};

    for (const [key, connections] of this.pool.entries()) {
      const serverId = key.split(':')[0];
      byServer[serverId] = (byServer[serverId] || 0) + connections.length;

      for (const conn of connections) {
        total++;
        if (conn.inUse) {
          inUse++;
        } else {
          idle++;
        }
      }
    }

    return { total, inUse, idle, byServer };
  }
}

// 全局连接池实例
export const sshPool = new SSHConnectionPool();