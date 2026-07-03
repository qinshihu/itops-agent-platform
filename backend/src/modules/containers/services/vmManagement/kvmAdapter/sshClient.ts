import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../../../../utils/logger';

const execAsync = promisify(exec);

export interface KvmConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  private_key?: string;
}

/**
 * KVM/libvirt SSH 客户端：封装 SSH 远程命令执行和连接管理。
 */
export class KvmSshClient {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly platformId: string;
  private password?: string;
  private privateKey?: string;
  private sshCommand: string;
  private _connected = false;

  constructor(platformId: string, config: KvmConfig) {
    this.platformId = platformId;
    this.host = config.host || '';
    this.port = config.port || 22;
    this.username = config.username || 'root';
    this.password = config.password;
    this.privateKey = config.privateKey || config.private_key;
    this.sshCommand = this.buildSSHCommand();
  }

  get connected(): boolean {
    return this._connected;
  }

  private buildSSHCommand(): string {
    const args: string[] = [
      'ssh',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', `ConnectTimeout=10`,
      '-p', String(this.port),
    ];

    if (this.password) {
      args.unshift('sshpass', '-p', `"${this.password}"`);
    } else if (this.privateKey) {
      args.push('-i', `"${this.privateKey}"`);
    }

    args.push(`"${this.username}@${this.host}"`);

    return args.join(' ');
  }

  async connect(): Promise<void> {
    try {
      logger.info(`🔌 正在连接 KVM/libvirt 主机: ${this.host}`);

      if (!this.host) {
        throw new Error('KVM 主机地址未配置');
      }

      const { stdout } = await this.execSSH('virsh version');
      logger.info(`✅ KVM/libvirt 连接成功 (${this.host}), 版本: ${stdout.trim()}`);
      this._connected = true;
    } catch (error) {
      logger.error('❌ KVM/libvirt 连接失败:', error);
      this._connected = false;
      throw new Error(error instanceof Error ? error.message : 'KVM SSH 连接失败');
    }
  }

  disconnect(): void {
    this._connected = false;
    logger.info('🔌 KVM/libvirt 已断开连接');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    } finally {
      this.disconnect();
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this._connected) await this.connect();
  }

  async execSSH(command: string): Promise<{ stdout: string; stderr: string }> {
    const fullCommand = `${this.sshCommand} "${command.replace(/"/g, '\\"')}"`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error) {
      if (error && typeof error === 'object') {
        const err = error as any;
        if (err.killed) {
          throw new Error('SSH 命令执行超时 (30s)');
        }
        if (err.stdout) {
          return { stdout: err.stdout.trim(), stderr: (err.stderr || '').trim() };
        }
        throw new Error(`SSH 命令失败: ${err.stderr || err.message || 'Unknown'}`);
      }
      throw error;
    }
  }

  async waitForState(vmId: string, expectedState: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await this.execSSH(`virsh domstate "${vmId}"`);
        if (stdout.trim().toLowerCase() === expectedState.toLowerCase()) {
          return;
        }
      } catch {
        // 查询失败忽略
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    logger.warn(`⚠️ KVM 虚拟机 ${vmId} 等待状态 ${expectedState} 超时`);
  }

  async getVMDetail(name: string): Promise<{ maxMem: number; vcpus: number }> {
    try {
      const { stdout } = await this.execSSH(`virsh dominfo "${name}"`);
      let maxMem = 0;
      let vcpus = 0;

      for (const line of stdout.split('\n')) {
        if (line.includes('Max memory:')) {
          maxMem = parseInt(line.replace(/\D/g, '')) || 0;
        }
        if (line.includes('CPU(s):')) {
          vcpus = parseInt(line.replace(/\D/g, '')) || 0;
        }
      }

      return { maxMem, vcpus };
    } catch {
      return { maxMem: 0, vcpus: 0 };
    }
  }
}
