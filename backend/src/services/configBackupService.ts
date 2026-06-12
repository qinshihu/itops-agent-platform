import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { Client } from 'ssh2';
import db from '../models/database';
import { logger } from '../utils/logger';
import { createVendorAdapter, VendorType } from './vendorAdapter';
import { decrypt } from './encryptionService';

// ================================================================
// 网络设备配置备份与对比服务
// ================================================================

export interface ConfigBackup {
  id: string;
  device_id: string;
  device_name: string;
  config_md5: string;
  config_text?: string;
  config_size: number;
  status: 'success' | 'failed' | 'partial';
  error_message?: string;
  created_at: string;
}

export interface ConfigDiff {
  backupIdA: string;
  backupIdB: string;
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
}

class ConfigBackupService {

  /**
   * 备份单台设备配置（保留最近 30 份，自动清理旧版本）
   */
  async backupDevice(deviceId: string): Promise<ConfigBackup> {
    const device = db.prepare(
      'SELECT id, name, ip_address, vendor, ssh_port, username, password FROM network_devices WHERE id = ?'
    ).get(deviceId) as any;
    if (!device) throw new Error(`Device not found: ${deviceId}`);

    const backupId = randomUUID();

    try {
      const decryptedPassword = decrypt(device.password);

      // 根据厂商选择抓取配置的命令
      const configCommand = this.getConfigCommand(device.vendor);

      const output = await this.executeSSHCommand(device.ip_address, device.ssh_port || 22, device.username, decryptedPassword, configCommand, 60000);

      if (!output || output.trim().length === 0) {
        throw new Error('Empty config output');
      }

      // 计算 MD5
      const md5 = createHash('md5').update(output).digest('hex');

      // 保存配置
      db.prepare(`
        INSERT INTO network_config_backups (id, device_id, config_md5, config_text, config_size, status)
        VALUES (?, ?, ?, ?, ?, 'success')
      `).run(backupId, deviceId, md5, output, Buffer.byteLength(output, 'utf-8'));

      // 清理旧配置（保留最近 30 份）
      this.cleanupOldBackups(deviceId, 30);

      // 更新设备最后备份时间
      db.prepare('UPDATE network_devices SET last_backup_at = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(deviceId);

      logger.info(`Config backup saved for ${device.name} (${md5.substring(0, 8)}..., ${(output.length / 1024).toFixed(1)}KB)`);

      return {
        id: backupId,
        device_id: deviceId,
        device_name: device.name,
        config_md5: md5,
        config_size: Buffer.byteLength(output, 'utf-8'),
        status: 'success',
        created_at: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error(`Config backup failed for ${device.name}: ${error.message}`);

      db.prepare(`
        INSERT INTO network_config_backups (id, device_id, config_md5, config_size, status, error_message)
        VALUES (?, ?, '', 0, 'failed', ?)
      `).run(backupId, deviceId, error.message.substring(0, 500));

      return {
        id: backupId,
        device_id: deviceId,
        device_name: device.name,
        config_md5: '',
        config_size: 0,
        status: 'failed',
        error_message: error.message,
        created_at: new Date().toISOString(),
      };
    }
  }

  /**
   * 批量备份所有在线设备
   */
  async backupAllOnlineDevices(): Promise<{ success: number; failed: number }> {
    const devices = db.prepare(
      "SELECT id FROM network_devices WHERE status IN ('online', 'unknown')"
    ).all() as { id: string }[];

    let success = 0;
    let failed = 0;

    for (const d of devices) {
      try {
        const result = await this.backupDevice(d.id);
        if (result.status === 'success') success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 获取设备备份历史
   */
  getBackupHistory(deviceId: string, limit: number = 30): ConfigBackup[] {
    return db.prepare(`
      SELECT cb.*, nd.name as device_name
      FROM network_config_backups cb
      JOIN network_devices nd ON nd.id = cb.device_id
      WHERE cb.device_id = ?
      ORDER BY cb.created_at DESC
      LIMIT ?
    `).all(deviceId, limit) as ConfigBackup[];
  }

  /**
   * 读取备份完整内容
   */
  getBackupContent(backupId: string): string | null {
    const row = db.prepare(
      'SELECT config_text FROM network_config_backups WHERE id = ?'
    ).get(backupId) as { config_text: string } | undefined;
    return row?.config_text || null;
  }

  /**
   * 对比两个备份版本的差异（逐行 diff）
   */
  diffBackups(backupIdA: string, backupIdB: string): ConfigDiff {
    const contentA = this.getBackupContent(backupIdA) || '';
    const contentB = this.getBackupContent(backupIdB) || '';

    const linesA = contentA.split('\n');
    const linesB = contentB.split('\n');

    // 简单 LCS 做逐行 diff（生产环境可使用 diff 库）
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    let unchanged = 0;

    const setA = new Set(linesA.map(l => l.trim()).filter(l => l));
    const setB = new Set(linesB.map(l => l.trim()).filter(l => l));

    for (const l of linesA) {
      const tl = l.trim();
      if (!tl) continue;
      if (setB.has(tl)) unchanged++;
      else removed.push(l);
    }

    for (const l of linesB) {
      const tl = l.trim();
      if (!tl) continue;
      if (!setA.has(tl)) added.push(l);
    }

    // 检查值变化（同名配置不同值）
    const configMapA = this.parseConfigPairs(linesA);
    const configMapB = this.parseConfigPairs(linesB);
    for (const [key, valA] of configMapA) {
      const valB = configMapB.get(key);
      if (valB !== undefined && valB !== valA && !removed.includes(valA) && !added.includes(valB)) {
        changed.push(`${key}: "${valA}" → "${valB}"`);
      }
    }

    return { backupIdA, backupIdB, added, removed, changed, unchanged };
  }

  /**
   * 检查配置是否发生变更（对比最近两次备份）
   */
  async checkConfigChange(deviceId: string): Promise<{ changed: boolean; diff?: ConfigDiff; backup?: ConfigBackup } | null> {
    const history = this.getBackupHistory(deviceId, 2);
    if (history.length === 0) {
      // 第一次备份
      const backup = await this.backupDevice(deviceId);
      return { changed: false, backup };
    }

    // 执行新一轮备份
    const newBackup = await this.backupDevice(deviceId);
    if (newBackup.status === 'failed') return null;

    // 对比最新两次
    const prev = history[0];
    if (newBackup.config_md5 !== prev.config_md5) {
      const diff = this.diffBackups(prev.id, newBackup.id);
      return { changed: true, diff, backup: newBackup };
    }

    return { changed: false, backup: newBackup };
  }

  // ── 私有 ──

  private getConfigCommand(vendor: string): string {
    switch (vendor) {
      case 'huawei':
      case 'h3c':
        return 'display current-configuration';
      case 'cisco':
        return 'show running-config';
      case 'ruijie':
      case 'ruijie_eg':
        return 'show running-config';
      case 'zte':  // ZTE ZXR10
        return 'show running-config';
      case 'fortinet':
        return 'show full-configuration';
      case 'paloalto':
        return 'show running config';
      case 'juniper':
        return 'show configuration | display set';
      case 'arista':
        return 'show running-config';
      case 'hpe':
        return 'show running-config';
      case 'mikrotik':
        return '/export verbose';
      case 'ubiquiti':
        return 'show configuration';
      case 'dell':
        return 'show running-config';
      case 'tplink':
        return 'show running-config';
      case 'f5':
        return 'tmsh list all-properties';
      default:
        return 'show running-config';
    }
  }

  private parseConfigPairs(lines: string[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const l of lines) {
      const match = l.trim().match(/^(set|ip|hostname|interface|vlan|router)\s+(.+)/i);
      if (match) {
        map.set(match[0].trim(), l.trim());
      }
    }
    return map;
  }

  private cleanupOldBackups(deviceId: string, keep: number): void {
    db.prepare(`
      DELETE FROM network_config_backups
      WHERE device_id = ? AND id NOT IN (
        SELECT id FROM network_config_backups
        WHERE device_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
    `).run(deviceId, deviceId, keep);
  }

  /**
   * 通过 SSH 在网络设备上执行命令并返回输出
   */
  private executeSSHCommand(host: string, port: number, username: string, password: string, command: string, timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let isResolved = false;
      let cmdTimeout: NodeJS.Timeout | null = null;

      const done = (err: Error | null, output?: string) => {
        if (isResolved) return;
        isResolved = true;
        if (cmdTimeout) clearTimeout(cmdTimeout);
        try { conn.end(); } catch { /* ignore */ }
        if (err) reject(err);
        else resolve(output || '');
      };

      cmdTimeout = setTimeout(() => done(new Error('SSH command timeout')), timeout);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) return done(new Error(`SSH exec: ${err.message}`));

          let stdout = '';
          let stderr = '';

          stream.on('data', (data: Buffer) => { stdout += data.toString(); });
          stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
          stream.on('close', (code: number | null) => {
            if (stderr && (!stdout || code !== 0)) {
              done(null, stdout || stderr);
            } else {
              done(null, stdout);
            }
          });
          stream.on('error', (e: any) => done(e));
        });
      });

      conn.on('error', (e: any) => done(e));

      conn.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 10000,
        keepaliveInterval: 10000,
      });
    });
  }
}

export const configBackupService = new ConfigBackupService();
