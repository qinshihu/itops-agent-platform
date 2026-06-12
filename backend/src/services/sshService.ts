import { Client } from 'ssh2';
import db from '../models/database';
import { randomUUID } from 'crypto';
import { decrypt } from './encryptionService';
import { generateCompletion } from './llmService';
import { withRetry, isRetryableError } from '../utils/retry';
import { logger } from '../utils/logger';
import { getCommandTemplates, OSType } from './commandDispatcher';

interface ServerInfo {
  id: string;
  hostname: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  ssh_key_id?: string;
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
const POOL_ACQUIRE_TIMEOUT = 30000; // 连接池等待超时 30 秒
const POOL_ACQUIRE_RETRY_INTERVAL = 500; // 连接池重试间隔 500ms

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
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as ServerInfo;
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

  release(client: Client, success: boolean = true): void {
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
      const sshKey = db.prepare('SELECT auth_type, private_key, passphrase, username, password FROM ssh_keys WHERE id = ?').get(server.ssh_key_id) as { auth_type: string; private_key: string; passphrase?: string; username?: string; password?: string } | undefined;
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
const sshPool = new SSHConnectionPool();

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出连接池供外部使用（如监控、管理）
export { sshPool };

// 根据操作系统类型获取合规检查列表
function getComplianceCheckList(osType: OSType) {
  const templates = getCommandTemplates(osType);
  const baseList = [
    { name: 'CPU Usage', command: templates.compliance.cpu },
    { name: 'Memory Usage', command: templates.compliance.memory },
    { name: 'Disk Usage', command: templates.compliance.disk },
    { name: 'Network Info', command: templates.compliance.network },
    { name: 'User List', command: templates.compliance.users },
    { name: 'Running Services', command: templates.compliance.services },
    { name: 'Uptime', command: templates.compliance.uptime },
    { name: 'OS Info', command: templates.compliance.os_info }
  ];
  
  // Windows 和 Linux 特有的检查
  if (osType === 'windows') {
    return baseList;
  }
  
  // Linux 特有的检查
  return [
    ...baseList,
    { name: 'SSH Config', command: 'cat /etc/ssh/sshd_config 2>/dev/null || echo "No SSH config found"' },
    { name: 'Firewall Status', command: 'iptables -L -n 2>/dev/null || ufw status 2>/dev/null || echo "No firewall info"' },
    { name: 'Last Logins', command: 'last -20' },
    { name: 'Cron Jobs', command: 'crontab -l 2>/dev/null || echo "No cron jobs" && ls -la /etc/cron.* 2>/dev/null' },
    { name: 'Package Updates', command: 'apt list --upgradable 2>/dev/null | head -30 || yum check-update 2>/dev/null | head -30 || echo "No package manager found"' }
  ];
}

// 导出默认 Linux 版本以保持向后兼容
const complianceCheckList = getComplianceCheckList('linux');
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
  db.prepare('UPDATE servers SET last_connected = datetime(\'now\',\'localtime\') WHERE id = ?').run(serverId);
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

    const result = await new Promise<CommandResult>((resolve, reject) => {
      let commandTimeout: NodeJS.Timeout | null = null;
      let isResolved = false;
      
      const safeResolve = (res: CommandResult) => {
        if (!isResolved) {
          isResolved = true;
          if (commandTimeout) clearTimeout(commandTimeout);
          resolve(res);
        }
      };

      try {
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

          const MAX_BUFFER_SIZE = 100 * 1024;
          const TRUNCATION_MARKER = '[Output truncated: exceeded 100KB limit]';
          let stdout = '';
          let stderr = '';
          let stdoutTruncated = false;
          let stderrTruncated = false;

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
            if (!stdoutTruncated) {
              stdout += data.toString();
              if (stdout.length > MAX_BUFFER_SIZE) {
                stdout = stdout.substring(0, MAX_BUFFER_SIZE) + '\n' + TRUNCATION_MARKER;
                stdoutTruncated = true;
              }
            }
          }).stderr.on('data', (data: Buffer) => {
            if (!stderrTruncated) {
              stderr += data.toString();
              if (stderr.length > MAX_BUFFER_SIZE) {
                stderr = stderr.substring(0, MAX_BUFFER_SIZE) + '\n' + TRUNCATION_MARKER;
                stderrTruncated = true;
              }
            }
          }).on('error', (err) => {
            stderr += `Stream error: ${err.message}\n`;
          });
        });
      } catch (execError) {
        reject(execError);
      }
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

// 批量 AI 分析合规检查结果
async function analyzeAllComplianceChecks(results: Record<string, CommandResult>): Promise<Record<string, string>> {
  const startTime = Date.now();
  const analysisResults: Record<string, string> = {};
  
  try {
    logger.info(`🤖 [Compliance AI] 开始批量分析 ${Object.keys(results).length} 个检查项`);
    
    // 构建批量分析的 prompt
    let prompt = '作为一个专业的服务器运维专家，请分析以下合规检查结果，并为每个检查项给出专业的评估和建议。\n\n';
    
    let index = 1;
    for (const [checkName, result] of Object.entries(results)) {
      prompt += `【检查项 ${index}: ${checkName}】\n`;
      prompt += `执行状态：${result.success ? '成功' : '失败'}\n`;
      prompt += `执行命令：${result.command}\n`;
      prompt += `输出摘要：\n${result.stdout.substring(0, 500)}\n\n`;
      index++;
    }
    
    prompt += `请为每个检查项分别进行分析，格式如下：
---检查项名称: [检查项名称]---
分析：[你的分析，简洁专业]
风险等级：[低/中/高]
建议：[具体改进建议]

请使用中文回答，每个检查项的分析控制在 150 字以内。`;

    const systemPrompt = '你是一个专业的服务器运维安全专家，擅长分析系统合规检查结果，识别安全风险并提供改进建议。你的回答要简洁、专业、有针对性。';
    
    const aiResponse = await generateCompletion(prompt, systemPrompt, 0.6, undefined, 'compliance-batch');
    
    // 解析 AI 返回的批量分析结果
    const analysisPattern = /---检查项名称:\s*(.+?)---/g;
    const sections = aiResponse.split(analysisPattern);
    
    let checkIndex = 0;
    const checkNames = Object.keys(results);
    
    for (let i = 1; i < sections.length; i += 2) {
      const name = sections[i]?.trim() || checkNames[checkIndex] || `未知检查项${checkIndex}`;
      const content = sections[i + 1]?.trim() || aiResponse;
      
      // 尝试匹配最接近的检查项名称
      const matchedName = checkNames.find(n => 
        name.includes(n) || n.includes(name)
      ) || checkNames[checkIndex] || name;
      
      analysisResults[matchedName] = content;
      checkIndex++;
    }
    
    // 如果解析失败，为每个检查项使用相同的通用分析
    if (Object.keys(analysisResults).length === 0) {
      logger.warn(`🤖 [Compliance AI] 批量解析失败，使用统一分析结果`);
      for (const name of checkNames) {
        analysisResults[name] = aiResponse;
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info(`🤖 [Compliance AI] 批量分析完成，耗时: ${duration}ms，分析了 ${Object.keys(analysisResults).length} 个检查项`);
    
    return analysisResults;
  } catch (error) {
    logger.error(`❌ [Compliance AI] 批量分析失败`, error instanceof Error ? error : new Error(String(error)));
    // 失败时返回统一的提示
    const fallbackAnalysis = 'AI 分析暂不可用，请查看原始输出。';
    for (const name of Object.keys(results)) {
      analysisResults[name] = fallbackAnalysis;
    }
    return analysisResults;
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
  const totalStartTime = Date.now();
  const checkId = randomUUID();
  const results: Record<string, CommandResult> = {};
  const useAI = options.useAI !== false;
  const concurrency = options.concurrency ?? 5;
  
  logger.info(`🚀 [Compliance Check] 开始合规检查，服务器: ${serverId}，并发数: ${concurrency}，AI分析: ${useAI}`);
  
  // 获取服务器的 os_type
  const server = db.prepare('SELECT os_type FROM servers WHERE id = ?').get(serverId) as { os_type?: string };
  const osType = (server?.os_type || 'linux') as OSType;
  
  // 获取对应操作系统的合规检查列表
  const checks = getComplianceCheckList(osType);
  logger.info(`📋 [Compliance Check] 检查项数量: ${checks.length}，操作系统: ${osType}`);
  
  if (options.saveResults) {
    db.prepare(`
      INSERT INTO compliance_checks 
      (id, server_id, check_name, check_results, status, started_at)
      VALUES (?, ?, 'Full Compliance Check', '[]', 'running', datetime('now','localtime'))
    `).run(checkId, serverId);
  }
  
  // 第一步：并发执行所有 SSH 命令，不进行 AI 分析
  const commandStartTime = Date.now();
  
  const executeCheckOnly = async (check: typeof checks[0]): Promise<[string, CommandResult]> => {
    const result = await executeCommand(serverId, check.command, {
      logHistory: false,
      executedBy: 'compliance-check'
    });
    return [check.name, result];
  };
  
  for (let i = 0; i < checks.length; i += concurrency) {
    const batch = checks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(executeCheckOnly));
    batchResults.forEach(([name, result]) => {
      results[name] = result;
    });
    logger.info(`✅ [Compliance Check] 完成批次 ${Math.floor(i / concurrency) + 1}/${Math.ceil(checks.length / concurrency)}，已完成 ${Object.keys(results).length}/${checks.length}`);
  }
  
  const commandDuration = Date.now() - commandStartTime;
  logger.info(`⚡ [Compliance Check] 所有命令执行完成，耗时: ${commandDuration}ms`);
  
  // 第二步：批量 AI 分析（一次 LLM 调用）
  if (useAI) {
    const aiStartTime = Date.now();
    const analysisResults = await analyzeAllComplianceChecks(results);
    
    // 将分析结果分配到每个检查项
    for (const [name, analysis] of Object.entries(analysisResults)) {
      if (results[name]) {
        results[name].aiAnalysis = analysis;
      }
    }
    
    const aiDuration = Date.now() - aiStartTime;
    logger.info(`🤖 [Compliance Check] AI 分析完成，耗时: ${aiDuration}ms`);
  }
  
  if (options.saveResults) {
    db.prepare(`
      UPDATE compliance_checks 
      SET check_results = ?, status = 'completed', completed_at = datetime('now','localtime')
      WHERE id = ?
    `).run(JSON.stringify(results), checkId);
  }
  
  const totalDuration = Date.now() - totalStartTime;
  logger.info(`🏁 [Compliance Check] 全部完成，总耗时: ${totalDuration}ms，命令执行: ${commandDuration}ms，AI分析: ${useAI ? `${totalDuration - commandDuration}ms` : '跳过'}`);
  
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
