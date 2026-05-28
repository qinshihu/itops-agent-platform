import { randomUUID } from 'crypto';
import { Client } from 'ssh2';
import db from '../models/database';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from './encryptionService';
import { VendorType } from './vendorAdapter';

export interface NetworkDevice {
  id: string;
  name: string;
  ip_address: string;
  vendor: VendorType;
  model?: string;
  os_version?: string;
  ssh_port: number;
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
}

export interface CreateDeviceRequest {
  name: string;
  ip_address: string;
  vendor: VendorType;
  model?: string;
  os_version?: string;
  ssh_port?: number;
  username: string;
  password: string;
  enable_password?: string;
  location?: string;
  role?: string;
}

export interface UpdateDeviceRequest {
  name?: string;
  model?: string;
  os_version?: string;
  ssh_port?: number;
  username?: string;
  password?: string;
  enable_password?: string;
  location?: string;
  role?: string;
}

class NetworkDeviceService {
  getAllDevices(): Array<NetworkDevice> {
    const devices = db.prepare(
      'SELECT * FROM network_devices ORDER BY created_at DESC'
    ).all() as Array<NetworkDevice>;

    return devices.map(d => this.sanitizeDevice(d));
  }

  getDeviceById(id: string): NetworkDevice | undefined {
    const device = db.prepare(
      'SELECT * FROM network_devices WHERE id = ?'
    ).get(id) as NetworkDevice | undefined;

    return device ? this.sanitizeDevice(device) : undefined;
  }

  createDevice(data: CreateDeviceRequest): NetworkDevice {
    const id = randomUUID();
    const encryptedPassword = encrypt(data.password);
    const encryptedEnablePassword = data.enable_password ? encrypt(data.enable_password) : null;

    db.prepare(
      `INSERT INTO network_devices 
      (id, name, ip_address, vendor, model, os_version, ssh_port, username, password, enable_password, location, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.name,
      data.ip_address,
      data.vendor,
      data.model || null,
      data.os_version || null,
      data.ssh_port || 22,
      data.username,
      encryptedPassword,
      encryptedEnablePassword,
      data.location || null,
      data.role || null,
      'online'
    );

    logger.info(`Network device created: ${data.name} (${data.ip_address})`);

    return this.getDeviceById(id)!;
  }

  updateDevice(id: string, data: UpdateDeviceRequest): NetworkDevice | undefined {
    const existing = db.prepare(
      'SELECT * FROM network_devices WHERE id = ?'
    ).get(id) as NetworkDevice | undefined;

    if (!existing) {
      return undefined;
    }

    const updates: Array<{ column: string; value: unknown }> = [];
    
    if (data.name !== undefined) updates.push({ column: 'name', value: data.name });
    if (data.model !== undefined) updates.push({ column: 'model', value: data.model });
    if (data.os_version !== undefined) updates.push({ column: 'os_version', value: data.os_version });
    if (data.ssh_port !== undefined) updates.push({ column: 'ssh_port', value: data.ssh_port });
    if (data.username !== undefined) updates.push({ column: 'username', value: data.username });
    if (data.password !== undefined) updates.push({ column: 'password', value: encrypt(data.password) });
    if (data.enable_password !== undefined) updates.push({ column: 'enable_password', value: data.enable_password ? encrypt(data.enable_password) : null });
    if (data.location !== undefined) updates.push({ column: 'location', value: data.location });
    if (data.role !== undefined) updates.push({ column: 'role', value: data.role });

    if (updates.length > 0) {
      const setClause = updates.map(u => `${u.column} = ?`).join(', ');
      const values = [...updates.map(u => u.value), id];
      
      db.prepare(
        `UPDATE network_devices SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(...values);

      logger.info(`Network device updated: ${id}`);
    }

    return this.getDeviceById(id);
  }

  deleteDevice(id: string): boolean {
    const result = db.prepare(
      'DELETE FROM network_devices WHERE id = ?'
    ).run(id);

    if (result.changes > 0) {
      logger.info(`Network device deleted: ${id}`);
      return true;
    }

    return false;
  }

  async testConnection(deviceId: string): Promise<{ success: boolean; message: string; latency?: number }> {
    const device = db.prepare(
      'SELECT id, name, ip_address, ssh_port, username, password FROM network_devices WHERE id = ?'
    ).get(deviceId) as NetworkDevice | undefined;

    if (!device) {
      return { success: false, message: 'Device not found' };
    }

    return this.testConnectionToDevice(device);
  }

  async testTemporaryConnection(data: { ip_address: string; ssh_port: number; username: string; password: string }): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();
    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice({
        ip_address: data.ip_address,
        ssh_port: data.ssh_port || 22,
        username: data.username,
        password: data.password
      });
      const latency = Date.now() - startTime;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Command timeout')), 10000);
        
        conn!.exec('display version', (err: Error | undefined, stream) => {
          if (err) {
            clearTimeout(timeout);
            reject(err);
            return;
          }

          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          }).on('close', () => {
            clearTimeout(timeout);
            resolve();
          }).on('error', (err: Error) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      });

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
        try { conn.end(); } catch {}
      }
    }
  }

  private async testConnectionToDevice(device: Pick<NetworkDevice, 'ip_address' | 'ssh_port' | 'username' | 'password'>): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();
    let conn: Client | null = null;

    try {
      conn = await this.connectToDevice(device);
      const latency = Date.now() - startTime;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Command timeout')), 10000);
        
        conn!.exec('display version', (err: Error | undefined, stream) => {
          if (err) {
            clearTimeout(timeout);
            reject(err);
            return;
          }

          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          }).on('close', () => {
            clearTimeout(timeout);
            resolve();
          }).on('error', (err: Error) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      });

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
        try { conn.end(); } catch {}
      }
    }
  }

  getInspectionHistory(deviceId: string, limit: number = 20): Array<any> {
    return db.prepare(
      'SELECT * FROM network_inspection_history WHERE device_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(deviceId, limit) as Array<any>;
  }

  getInspectionDetail(inspectionId: string): any {
    return db.prepare(
      'SELECT * FROM network_inspection_history WHERE id = ?'
    ).get(inspectionId) as any;
  }

  private sanitizeDevice(device: NetworkDevice): NetworkDevice {
    return {
      ...device,
      password: '',
      enable_password: ''
    };
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
          try { conn.end(); } catch {}
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
