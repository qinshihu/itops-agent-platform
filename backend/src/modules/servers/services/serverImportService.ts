import { Client } from 'ssh2';
import { randomUUID } from 'crypto';
import { serversRepo } from '../../../repositories/serverRepository';
import { encrypt } from '../../auth/services/encryptionService';

interface ImportServer {
  name: string;
  hostname: string;
  port?: number;
  username: string;
  password?: string;
  private_key?: string;
  use_ssh_key?: number;
  description?: string;
  tags?: string[];
  group_id?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  details: Array<{
    name: string;
    hostname: string;
    status: 'success' | 'failed' | 'skipped' | 'duplicate';
    error?: string;
  }>;
}

class ServerImportService {
  private static readonly CONNECT_TIMEOUT = 8000;

  validateServers(servers: ImportServer[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    servers.forEach((s, i) => {
      const prefix = `第 ${i + 1} 行`;
      if (!s.name) errors.push(`${prefix}: 服务器名称不能为空`);
      if (!s.hostname) errors.push(`${prefix}: 主机地址不能为空`);
      if (!s.username) errors.push(`${prefix}: 用户名不能为空`);
      const port = s.port || 22;
      if (port < 1 || port > 65535) errors.push(`${prefix}: 端口号无效 (${port})`);
      if (!s.use_ssh_key && !s.password && !s.private_key) {
        errors.push(`${prefix}: 请提供密码或 SSH 密钥`);
      }
      if (s.use_ssh_key && !s.private_key) {
        errors.push(`${prefix}: 使用 SSH 密钥时需提供私钥`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  async importServers(
    servers: ImportServer[],
    testConnection = true
  ): Promise<ImportResult> {
    const validation = this.validateServers(servers);
    if (!validation.valid) {
      return { success: 0, failed: 0, skipped: 0, details: [], };
    }

    const result: ImportResult = { success: 0, failed: 0, skipped: 0, details: [] };

    for (const server of servers) {
      const existing = serversRepo.checkDuplicateByHostnameAndPort(server.hostname, server.port || 22);

      if (existing) {
        result.skipped++;
        result.details.push({
          name: server.name,
          hostname: server.hostname,
          status: 'duplicate',
          error: '服务器已存在'
        });
        continue;
      }

      try {
        const id = randomUUID();
        const encryptedPassword = server.password ? encrypt(server.password) : null;
        const encryptedPrivateKey = server.private_key ? encrypt(server.private_key) : null;

        serversRepo.insertImport({
          id,
          name: server.name,
          hostname: server.hostname,
          port: server.port || 22,
          username: server.username,
          password: encryptedPassword,
          private_key: encryptedPrivateKey,
          use_ssh_key: server.use_ssh_key ? 1 : 0,
          description: server.description || null,
          tags: server.tags ? JSON.stringify(server.tags) : null,
        });

        if (server.group_id) {
          serversRepo.addGroupMapping(id, server.group_id);
        }

        if (testConnection) {
          const testResult = await this.testServerConnection({
            hostname: server.hostname,
            port: server.port || 22,
            username: server.username,
            password: server.password || null,
            private_key: server.private_key || null,
            use_ssh_key: server.use_ssh_key || 0
          });

          if (!testResult.success) {
            serversRepo.removeGroupMappingByServerId(id);
            serversRepo.delete(id);
            result.failed++;
            result.details.push({
              name: server.name,
              hostname: server.hostname,
              status: 'failed',
              error: testResult.error || '连接测试失败'
            });
            continue;
          }
        }

        result.success++;
        result.details.push({
          name: server.name,
          hostname: server.hostname,
          status: 'success'
        });
      } catch (err) {
        result.failed++;
        result.details.push({
          name: server.name,
          hostname: server.hostname,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  private testServerConnection(config: {
    hostname: string;
    port: number;
    username: string;
    password: string | null;
    private_key: string | null;
    use_ssh_key: number;
  }): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const conn = new Client();
      let isResolved = false;

      const safeResolve = (result: { success: boolean; error?: string }) => {
        if (!isResolved) {
          isResolved = true;
          try { conn.end(); } catch { /* ignore */ }
          resolve(result);
        }
      };

      conn.on('ready', () => {
        safeResolve({ success: true });
      });

      conn.on('error', (err) => {
        safeResolve({ success: false, error: err.message });
      });

      conn.on('timeout', () => {
        safeResolve({ success: false, error: 'Connection timeout' });
      });

      const connectConfig: Record<string, unknown> = {
        host: config.hostname,
        port: config.port,
        username: config.username,
        readyTimeout: ServerImportService.CONNECT_TIMEOUT,
        maxTries: 1
      };

      if (config.use_ssh_key && config.private_key) {
        connectConfig.privateKey = config.private_key;
      } else if (config.password) {
        connectConfig.password = config.password;
      }

      conn.connect(connectConfig);
    });
  }
}

export const serverImportService = new ServerImportService();
