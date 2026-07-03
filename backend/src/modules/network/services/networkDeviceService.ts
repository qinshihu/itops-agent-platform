import { randomUUID } from 'crypto';
import { Client } from 'ssh2';
import { logger } from '../../../utils/logger';
import { encrypt, decrypt } from '../../auth/services/encryptionService';
import type { VendorType } from './vendorAdapter';
import { networkDeviceRepository, sshKeysRepo, snmpInspectionRepo } from '../../../repositories';

export interface NetworkDevice {
  id: string;
  name: string;
  ip_address: string;
  vendor: VendorType;
  model?: string;
  os_version?: string;
  ssh_port: number;
  ssh_key_id?: string;
  username: string;
  password: string;
  enable_password?: string;
  location?: string;
  role?: string;
  status: string;
  last_inspection_at?: string;
  last_inspection_result?: string;
  created_at: string;
  updated_at: string;
  snmp_enabled?: number;
  snmp_credential_id?: string;
  snmp_credential_name?: string;
  snmp_port?: number;
  last_snmp_at?: string;
}

export interface CreateDeviceRequest {
  name: string;
  ip_address: string;
  vendor: VendorType;
  model?: string;
  os_version?: string;
  ssh_port?: number;
  ssh_key_id?: string;
  username?: string;
  password?: string;
  enable_password?: string;
  location?: string;
  role?: string;
  snmp_enabled?: number;
  snmp_credential_id?: string;
  snmp_port?: number;
}

export interface UpdateDeviceRequest {
  name?: string;
  model?: string;
  os_version?: string;
  ssh_port?: number;
  ssh_key_id?: string;
  username?: string;
  password?: string;
  enable_password?: string;
  location?: string;
  role?: string;
  snmp_enabled?: number;
  snmp_credential_id?: string;
  snmp_port?: number;
}

class NetworkDeviceService {
  private ensureSnmpCredIdColumn() {
    networkDeviceRepository.ensureSnmpCredIdColumn();
  }

  getAllDevices(): Array<NetworkDevice> {
    this.ensureSnmpCredIdColumn();
    const devices = networkDeviceRepository.list();

    return devices.map(d => this.sanitizeDevice(d as unknown as NetworkDevice));
  }

  getDeviceById(id: string): NetworkDevice | undefined {
    this.ensureSnmpCredIdColumn();
    const device = networkDeviceRepository.getByIdWithCredential(id);

    return device ? this.sanitizeDevice(device as unknown as NetworkDevice) : undefined;
  }

  createDevice(data: CreateDeviceRequest): NetworkDevice {
    const id = randomUUID();

    // 如果选择了凭证，从凭证表获取认证信息
    let finalUsername = data.username || '';
    let finalPassword = data.password || '';

    if (data.ssh_key_id) {
      const credential = sshKeysRepo.getById(data.ssh_key_id);

      if (credential) {
        if (credential.auth_type === 'password') {
          finalUsername = credential.username || '';
          finalPassword = credential.password ? decrypt(credential.password) : '';
        }
      }
    }

    const encryptedPassword = encrypt(finalPassword || data.password || '');
    const encryptedEnablePassword = data.enable_password ? encrypt(data.enable_password) : null;

    this.ensureSnmpCredIdColumn();
    networkDeviceRepository.create({
      id,
      name: data.name,
      ip_address: data.ip_address,
      vendor: data.vendor,
      model: data.model || null,
      os_version: data.os_version || null,
      ssh_port: data.ssh_port || 22,
      ssh_key_id: data.ssh_key_id || null,
      username: finalUsername || data.username || '',
      password: encryptedPassword,
      enable_password: encryptedEnablePassword,
      location: data.location || null,
      role: data.role || null,
      status: 'online',
      snmp_enabled: data.snmp_enabled ?? 1,
      snmp_credential_id: data.snmp_credential_id || null,
      snmp_port: data.snmp_port || 161,
    });

    logger.info(`Network device created: ${data.name} (${data.ip_address})`);

    return this.getDeviceById(id)!;
  }

  updateDevice(id: string, data: UpdateDeviceRequest): NetworkDevice | undefined {
    const existing = networkDeviceRepository.getById(id);

    if (!existing) {
      return undefined;
    }

    const fields: Record<string, unknown> = {};

    if (data.name !== undefined) fields.name = data.name;
    if (data.model !== undefined) fields.model = data.model;
    if (data.os_version !== undefined) fields.os_version = data.os_version;
    if (data.ssh_port !== undefined) fields.ssh_port = data.ssh_port;
    if (data.ssh_key_id !== undefined) fields.ssh_key_id = data.ssh_key_id || null;
    if (data.username !== undefined) fields.username = data.username;
    if (data.password !== undefined && data.password !== '') {
      fields.password = encrypt(data.password);
    }
    if (data.enable_password !== undefined) fields.enable_password = data.enable_password ? encrypt(data.enable_password) : null;
    if (data.location !== undefined) fields.location = data.location;
    if (data.role !== undefined) fields.role = data.role;
    if (data.snmp_enabled !== undefined) fields.snmp_enabled = data.snmp_enabled ? 1 : 0;
    if (data.snmp_credential_id !== undefined) fields.snmp_credential_id = data.snmp_credential_id || null;
    if (data.snmp_port !== undefined) fields.snmp_port = data.snmp_port;

    // 如果切换了凭证，更新认证信息
    if (data.ssh_key_id !== undefined && data.ssh_key_id) {
      const credential = sshKeysRepo.getById(data.ssh_key_id);

      if (credential?.auth_type === 'password') {
        fields.username = credential.username || '';
        fields.password = encrypt(credential.password ? decrypt(credential.password) : '');
      }
    }

    if (Object.keys(fields).length > 0) {
      networkDeviceRepository.update(id, fields as any);
      logger.info(`Network device updated: ${id}`);
    }

    return this.getDeviceById(id);
  }

  deleteDevice(id: string): boolean {
    const result = networkDeviceRepository.delete(id);

    if (result) {
      logger.info(`Network device deleted: ${id}`);
      return true;
    }

    return false;
  }

  async testConnection(deviceId: string): Promise<{ success: boolean; message: string; latency?: number }> {
    const device = networkDeviceRepository.getTestConnectionFields(deviceId);

    if (!device) {
      return { success: false, message: 'Device not found' };
    }

    return this.testConnectionToDevice(device);
  }

  async testTemporaryConnection(data: { ip_address: string; ssh_port: number; username: string; password: string }): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();
    let conn: Client | null = null;

    try {
      // 注意：data.password 是前端送来的明文，不能 decrypt
      // 用专门的 connectWithPlainPassword，否则会报 "Invalid encrypted data format"
      conn = await this.connectWithPlainPassword({
        ip_address: data.ip_address,
        ssh_port: data.ssh_port || 22,
        username: data.username,
        password: data.password
      });
      const latency = Date.now() - startTime;

      // 用交互式 shell 探活：等 prompt → 发 display version → 静默收尾
      // 比 conn.exec 更稳，兼容华为/华三的分页器、banner、prompt 变化等
      await this.runProbeCommand(conn, 'display version');

      return {
        success: true,
        message: 'Connection successful',
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Connection failed';

      return {
        success: false,
        message,
        latency
      };
    } finally {
      if (conn) {
        try { conn.end(); } catch { /* ignore cleanup errors */ }
      }
    }
  }

  private async testConnectionToDevice(device: Pick<NetworkDevice, 'ip_address' | 'ssh_port' | 'username' | 'password'>): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();
    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);
      const latency = Date.now() - startTime;

      // 同上：用交互式 shell 探活
      await this.runProbeCommand(conn, 'display version');

      return {
        success: true,
        message: 'Connection successful',
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Connection failed';

      return {
        success: false,
        message,
        latency
      };
    } finally {
      if (conn) {
        try { conn.end(); } catch { /* ignore cleanup errors */ }
      }
    }
  }

  getInspectionHistory(deviceId: string, limit = 20): Array<any> {
    return snmpInspectionRepo.listAllByDeviceId(deviceId, limit);
  }

  getInspectionDetail(inspectionId: string): any {
    return snmpInspectionRepo.getById(inspectionId);
  }

  private sanitizeDevice(device: NetworkDevice): NetworkDevice {
    return {
      ...device,
      password: '',
      enable_password: ''
    };
  }

  /**
   * 交互式 shell 探活：等 prompt → 发命令 → 读输出 → 静默收尾
   * 比 conn.exec 更稳，能处理华为/华三的 banner、prompt 变化、分页器
   * @param conn 已就绪的 SSH 连接
   * @param command 探测命令（默认 'display version'，各厂商通用）
   * @param timeoutMs 硬超时（默认 30s）
   */
  private runProbeCommand(
    conn: Client,
    command = 'display version',
    timeoutMs = 30000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const hardTimeout = setTimeout(() => {
        try { stream?.end(); } catch { /* ignore */ }
        reject(new Error('Command timeout'));
      }, timeoutMs);

      let stream: any = null;
      let buffer = '';
      let commandSent = false;
      let responseReceived = false;
      let silenceTimer: NodeJS.Timeout | null = null;

      const finish = (ok: boolean, msg?: string) => {
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
        clearTimeout(hardTimeout);
        try { stream?.end(); } catch { /* ignore */ }
        if (ok) resolve();
        else reject(new Error(msg || 'No response from device'));
      };

      const onData = (chunk: Buffer | string) => {
        const text = chunk.toString();
        buffer += text;

        // 阶段 1：等 shell prompt（行尾是 < > ] # 之类）
        if (!commandSent) {
          // 匹配常见 prompt：<HW-GW1> / [H3C] / Router# / Switch>
          if (/[<>\]][#>\s]?$/.test(buffer.trimEnd())) {
            commandSent = true;
            buffer = '';
            try {
              stream.write(command + '\n');
            } catch (_e) {
              finish(false, 'Failed to send command');
            }
          }
          return;
        }

        // 阶段 2：命令已发，1.5s 静默视为完成
        if (!responseReceived) {
          responseReceived = true;
          silenceTimer = setTimeout(() => finish(true), 1500);
        } else if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = setTimeout(() => finish(true), 1500);
        }
      };

      conn.shell((err: Error | undefined, shellStream: any) => {
        if (err) {
          clearTimeout(hardTimeout);
          reject(new Error(`Shell open error: ${err.message}`));
          return;
        }

        stream = shellStream;

        shellStream.on('data', onData);
        // 华为/华三部分固件会把错误信息走 stderr
        shellStream.stderr?.on('data', onData);
        shellStream.on('close', () => {
          // 关流时如果命令已发且收到响应，认为成功；否则算失败
          if (commandSent && responseReceived) finish(true);
          else finish(false, 'Shell closed before response');
        });
        shellStream.on('error', (err: Error) => finish(false, err.message));
      });
    });
  }

  /**
   * 用明文密码连接设备（用于"添加设备"前的临时测试连接，前端送的是明文）
   * 不要再调用 decrypt()，否则会触发 "Invalid encrypted data format"
   */
  private connectWithPlainPassword(device: {
    ip_address: string;
    ssh_port: number;
    username: string;
    password: string;
  }): Promise<Client> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let isResolved = false;
      let connectTimeout: NodeJS.Timeout | null = null;

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
          try { conn.end(); } catch { /* ignore cleanup errors */ }
          reject(error);
        }
      };

      connectTimeout = setTimeout(() => {
        safeReject(new Error('SSH connection timeout (10s)'));
      }, 10000);

      conn.on('ready', () => {
        safeResolve(conn);
      }).on('error', (err) => {
        safeReject(new Error(`SSH connection error: ${err.message}`));
      });

      // data.password 是明文，直接用，不再 decrypt
      conn.connect({
        host: device.ip_address,
        port: device.ssh_port || 22,
        username: device.username,
        password: device.password,
        readyTimeout: 10000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3
      });
    });
  }

  private connectToDevice(device: Pick<NetworkDevice, 'ip_address' | 'ssh_port' | 'username' | 'password'>): Promise<Client> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let isResolved = false;
      let connectTimeout: NodeJS.Timeout | null = null;

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
          try { conn.end(); } catch { /* ignore cleanup errors */ }
          reject(error);
        }
      };

      connectTimeout = setTimeout(() => {
        safeReject(new Error('SSH connection timeout (10s)'));
      }, 10000);

      conn.on('ready', () => {
        safeResolve(conn);
      }).on('error', (err) => {
        safeReject(new Error(`SSH connection error: ${err.message}`));
      });

      const decryptedPassword = decrypt(device.password);

      conn.connect({
        host: device.ip_address,
        port: device.ssh_port || 22,
        username: device.username,
        password: decryptedPassword,
        readyTimeout: 10000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3
      });
    });
  }
}

export const networkDeviceService = new NetworkDeviceService();
