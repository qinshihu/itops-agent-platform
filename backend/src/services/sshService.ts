import { Client } from 'ssh2';
import db from '../models/database';
import { randomUUID } from 'crypto';
import { decrypt } from './encryptionService';
import { generateCompletion } from './llmService';
import { withRetry, isRetryableError } from '../utils/retry';
import { logger } from '../utils/logger';

interface ServerInfo {
  id: string;
  hostname: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  use_ssh_key: number;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
  error?: string;
  aiAnalysis?: string;
}

// 默认超时时间（毫秒）
const DEFAULT_CONNECT_TIMEOUT = 10000;
const DEFAULT_COMMAND_TIMEOUT = 30000;

// 连接池配置
const POOL_CONFIG = {
  maxConnectionsPerServer: 5, // 每台服务器最大连接数
  idleTimeout: 300000, // 空闲连接超时 5 分钟
  healthCheckInterval: 60000, // 健康检查间隔 1 分钟
  maxTotalConnections: 50 // 全局最大连接数
};

interface PooledConnection {
  client: Client;
  serverId: string;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
  healthCheckFailed: number;
}

// SSH 连接池管理类
class SSHConnectionPool {
  private pool: Map<string, PooledConnection[]> = new Map();
  private totalConnections = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHealthCheck();
    this.setupCleanupOnShutdown();
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

  async acquire(serverId: string): Promise<Client> {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as ServerInfo;
    if (!server) {
      throw new Error('Server not found');
    }

    const key = this.getConnectionKey(serverId, server.hostname, server.port || 22, server.username);
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

    // 检查是否超过限制
    if (this.totalConnections >= POOL_CONFIG.maxTotalConnections) {
      throw new Error('SSH connection pool exhausted. Total connections: ' + this.totalConnections);
    }

    const serverConnections = this.pool.get(key) || [];
    if (serverConnections.length >= POOL_CONFIG.maxConnectionsPerServer) {
      throw new Error(`Max connections reached for server ${serverId} (${POOL_CONFIG.maxConnectionsPerServer})`);
    }

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

  release(client: Client, success: boolean = true): void {
    for (const connections of this.pool.values()) {
      for (const conn of connections) {
        if (conn.client === client) {
          conn.inUse = false;
          conn.lastUsedAt = Date.now();
          
          if (!success) {
            conn.healthCheckFailed++;
          } else {
            conn.healthCheckFailed = 0;
          }
          
          return;
        }
      }
    }
  }

  private async createConnection(server: ServerInfo, serverId: string): Promise<Client> {
    const decryptedPassword = server.password ? decrypt(server.password) : undefined;
    const decryptedPrivateKey = server.private_key ? decrypt(server.private_key) : undefined;

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
const sshPool = new SSHConnectionPool();

// 导出连接池供外部使用（如监控、管理）
export { sshPool };

// 预定义的合规检查
const complianceCheckList = [
  { name: 'CPU Usage', command: 'top -bn1 | head -20' },
  { name: 'Memory Usage', command: 'free -h && cat /proc/meminfo | head -20' },
  { name: 'Disk Usage', command: 'df -h && du -sh /* 2>/dev/null | sort -rh | head -20' },
  { name: 'Network Info', command: 'ip addr && netstat -tulpn 2>/dev/null || ss -tulpn' },
  { name: 'User List', command: 'cat /etc/passwd | cut -d: -f1,3,6,7' },
  { name: 'Running Services', command: 'systemctl list-units --type=service --state=running 2>/dev/null || service --status-all 2>&1 | grep "+"' },
  { name: 'Uptime', command: 'uptime && w' },
  { name: 'OS Info', command: 'cat /etc/os-release && uname -a' },
  { name: 'SSH Config', command: 'cat /etc/ssh/sshd_config 2>/dev/null || echo "No SSH config found"' },
  { name: 'Firewall Status', command: 'iptables -L -n 2>/dev/null || ufw status 2>/dev/null || echo "No firewall info"' },
  { name: 'Last Logins', command: 'last -20' },
  { name: 'Cron Jobs', command: 'crontab -l 2>/dev/null || echo "No cron jobs" && ls -la /etc/cron.* 2>/dev/null' },
  { name: 'Package Updates', command: 'apt list --upgradable 2>/dev/null | head -30 || yum check-update 2>/dev/null | head -30 || echo "No package manager found"' }
];

export { complianceCheckList as complianceChecks };

// 记录命令历史
function logCommandHistory(
  serverId: string,
  command: string,
  result: CommandResult,
  executedBy: string = 'system'
): void {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO server_command_history 
    (id, server_id, command, stdout, stderr, success, execution_time_ms, executed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    serverId,
    command,
    result.stdout,
    result.stderr,
    result.success ? 1 : 0,
    result.duration,
    executedBy
  );
}

// 更新服务器最后连接时间
function updateLastConnected(serverId: string): void {
  db.prepare('UPDATE servers SET last_connected = CURRENT_TIMESTAMP WHERE id = ?').run(serverId);
}

export async function executeCommand(
  serverId: string,
  command: string,
  options: {
    timeout?: number;
    logHistory?: boolean;
    executedBy?: string;
  } = {}
): Promise<CommandResult> {
  const startTime = Date.now();
  const timeout = options.timeout || DEFAULT_COMMAND_TIMEOUT;
  const logHistory = options.logHistory !== false;
  let conn: Client | null = null;
  let connAcquired = false;

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as ServerInfo;
  if (!server) {
    const result: CommandResult = {
      success: false,
      stdout: '',
      stderr: 'Server not found',
      command,
      duration: Date.now() - startTime
    };
    if (logHistory) {
      logCommandHistory(serverId, command, result, options.executedBy || 'system');
    }
    return result;
  }

  try {
    conn = await sshPool.acquire(serverId);
    connAcquired = true;

    const result = await new Promise<CommandResult>((resolve) => {
      let commandTimeout: NodeJS.Timeout | null = null;
      let isResolved = false;
      
      const safeResolve = (res: CommandResult) => {
        if (!isResolved) {
          isResolved = true;
          if (commandTimeout) clearTimeout(commandTimeout);
          resolve(res);
        }
      };

      conn!.exec(command, (err, stream) => {
        if (err) {
          safeResolve({
            success: false,
            stdout: '',
            stderr: err.message,
            command,
            duration: Date.now() - startTime
          });
          return;
        }

        let stdout = '';
        let stderr = '';

        commandTimeout = setTimeout(() => {
          try { stream.destroy(); } catch { /* ignore */ }
          safeResolve({
            success: false,
            stdout: '',
            stderr: 'Command timeout',
            command,
            duration: Date.now() - startTime
          });
        }, timeout);

        stream.on('close', (code: number | null) => {
          safeResolve({
            success: code === 0,
            stdout,
            stderr,
            command,
            duration: Date.now() - startTime
          });
        }).on('data', (data: Buffer) => {
          stdout += data.toString();
        }).stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        }).on('error', (err) => {
          stderr += `Stream error: ${err.message}\n`;
        });
      });
    });

    if (logHistory) {
      logCommandHistory(serverId, command, result, options.executedBy || 'system');
    }
    
    if (result.success) {
      updateLastConnected(serverId);
    }

    return result;
  } catch (error) {
    const result: CommandResult = {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      command,
      duration: Date.now() - startTime
    };
    
    if (logHistory) {
      logCommandHistory(serverId, command, result, options.executedBy || 'system');
    }
    
    return result;
  } finally {
    if (connAcquired && conn) {
      sshPool.release(conn);
    }
  }
}

export async function testConnection(serverId: string): Promise<{ success: boolean; message: string }> {
  const result = await executeCommand(serverId, 'echo "Connection test successful"', { logHistory: false });
  return {
    success: result.success,
    message: result.success ? 'Connection successful' : result.stderr
  };
}

// AI 分析合规检查结果
async function analyzeComplianceCheck(checkName: string, result: CommandResult): Promise<string> {
  try {
    const prompt = `作为一个专业的服务器运维专家，请分析以下合规检查结果，并给出专业的评估和建议：

检查项目：${checkName}
执行命令：${result.command}
执行状态：${result.success ? '成功' : '失败'}

标准输出：
\`\`\`
${result.stdout.substring(0, 2000)}
\`\`\`

错误输出：
\`\`\`
${result.stderr.substring(0, 1000)}
\`\`\`

请用简洁、专业的语言分析：
1. 这项检查的结果说明了什么？
2. 是否存在需要关注的问题或风险？
3. 如果有问题，给出具体的改进建议。

请用中文回答，控制在 300 字以内。`;

    const analysis = await generateCompletion(prompt, '你是一个专业的服务器运维专家，擅长分析系统状态和提供优化建议。', 0.7);
    return analysis;
  } catch {
    return 'AI 分析暂不可用，请查看原始输出。';
  }
}

export async function runComplianceCheck(
  serverId: string,
  options: {
    saveResults?: boolean;
    useAI?: boolean;
    concurrency?: number;
  } = {}
): Promise<Record<string, CommandResult>> {
  const checkId = randomUUID();
  const results: Record<string, CommandResult> = {};
  const useAI = options.useAI !== false;
  const concurrency = options.concurrency ?? 3;
  
  if (options.saveResults) {
    db.prepare(`
      INSERT INTO compliance_checks 
      (id, server_id, check_name, check_results, status, started_at)
      VALUES (?, ?, 'Full Compliance Check', '[]', 'running', CURRENT_TIMESTAMP)
    `).run(checkId, serverId);
  }
  
  const executeCheckWithAI = async (check: typeof complianceCheckList[0]): Promise<[string, CommandResult]> => {
    const result = await executeCommand(serverId, check.command, {
      logHistory: false,
      executedBy: 'compliance-check'
    });
    
    if (useAI) {
      result.aiAnalysis = await analyzeComplianceCheck(check.name, result);
    }
    
    return [check.name, result];
  };
  
  for (let i = 0; i < complianceCheckList.length; i += concurrency) {
    const batch = complianceCheckList.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(executeCheckWithAI));
    batchResults.forEach(([name, result]) => {
      results[name] = result;
    });
  }
  
  if (options.saveResults) {
    db.prepare(`
      UPDATE compliance_checks 
      SET check_results = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(results), checkId);
  }
  
  return results;
}

// 获取合规检查历史
export function getComplianceHistory(serverId: string, limit: number = 20): Array<{
  id: string;
  server_id: string;
  check_name: string;
  check_results: string;
  status: string;
  created_at: string;
}> {
  return db.prepare(`
    SELECT * FROM compliance_checks 
    WHERE server_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(serverId, limit) as Array<{
    id: string;
    server_id: string;
    check_name: string;
    check_results: string;
    status: string;
    created_at: string;
  }>;
}

// 获取命令历史
export function getCommandHistory(serverId: string, limit: number = 50): Array<{
  id: string;
  server_id: string;
  command: string;
  stdout: string;
  stderr: string;
  success: number;
  execution_time_ms: number;
  executed_by: string;
}> {
  return db.prepare(`
    SELECT * FROM server_command_history 
    WHERE server_id = ? 
    ORDER BY executed_at DESC 
    LIMIT ?
  `).all(serverId, limit) as Array<{
    id: string;
    server_id: string;
    command: string;
    stdout: string;
    stderr: string;
    success: number;
    execution_time_ms: number;
    executed_by: string;
  }>;
}

export async function executeCommandWithRetry(
  serverId: string,
  command: string,
  options: {
    timeout?: number;
    logHistory?: boolean;
    executedBy?: string;
    maxRetries?: number;
    initialDelayMs?: number;
  } = {}
): Promise<CommandResult> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;

  return withRetry(
    () => executeCommand(serverId, command, options),
    {
      maxRetries,
      initialDelayMs,
      shouldRetry: (error: unknown) => {
        if (error instanceof Error && error.message.includes('No authentication method')) {
          return false;
        }
        return isRetryableError(error);
      },
      onRetry: (attempt: number, error: unknown, delayMs: number) => {
        logger.warn(
          `🔄 SSH command retry ${attempt}/${maxRetries} for server ${serverId}: ` +
          `${error instanceof Error ? error.message : String(error)}. ` +
          `Next attempt in ${delayMs}ms`
        );
      }
    }
  );
}

export async function testConnectionWithRetry(
  serverId: string,
  maxRetries: number = 2
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await executeCommandWithRetry(
      serverId,
      'echo "Connection test successful"',
      {
        logHistory: false,
        maxRetries,
        initialDelayMs: 500
      }
    );
    return {
      success: result.success,
      message: result.success ? 'Connection successful' : result.stderr
    };
  } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
  }
}
