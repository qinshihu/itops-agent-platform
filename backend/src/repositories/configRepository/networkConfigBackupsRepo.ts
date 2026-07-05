/**
 * networkConfigBackupsRepo — network_config_backups 表的数据访问层
 *
 * 覆盖 configBackupService.ts 中直接 db.prepare 调用，包括：
 *   - save / saveFailed / list / getContent / cleanOld / getWithDeviceName
 */

import db from '../../../models/database';

// ── 类型定义 ──

export interface NetworkConfigBackupRecord {
  id: string;
  device_id: string;
  config_md5: string;
  config_text: string | null;
  config_size: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface NetworkConfigBackupWithDevice extends NetworkConfigBackupRecord {
  device_name: string;
}

export interface NetworkConfigBackupCreateInput {
  id: string;
  device_id: string;
  config_md5: string;
  config_text: string;
  config_size: number;
}

// ── repository 实现 ──

export const networkConfigBackupsRepo = {
  /** 保存成功备份 */
  save(input: NetworkConfigBackupCreateInput): void {
    db.prepare(`
      INSERT INTO network_config_backups (id, device_id, config_md5, config_text, config_size, status)
      VALUES (?, ?, ?, ?, ?, 'success')
    `).run(input.id, input.device_id, input.config_md5, input.config_text, input.config_size);
  },

  /** 保存失败备份记录 */
  saveFailed(id: string, deviceId: string, errorMessage: string): void {
    db.prepare(`
      INSERT INTO network_config_backups (id, device_id, config_md5, config_size, status, error_message)
      VALUES (?, ?, '', 0, 'failed', ?)
    `).run(id, deviceId, errorMessage);
  },

  /** 查询设备备份历史（含设备名） */
  listByDevice(deviceId: string, limit: number): NetworkConfigBackupWithDevice[] {
    return db.prepare(`
      SELECT cb.*, nd.name as device_name FROM network_config_backups cb
      JOIN network_devices nd ON nd.id = cb.device_id WHERE cb.device_id = ? ORDER BY cb.created_at DESC LIMIT ?
    `).all(deviceId, limit) as NetworkConfigBackupWithDevice[];
  },

  /** 查询备份列表（含设备名，LEFT JOIN） */
  listByDeviceLeft(deviceId: string, limit: number): NetworkConfigBackupWithDevice[] {
    return db.prepare(`
      SELECT cb.*, nd.name as device_name FROM network_config_backups cb
      LEFT JOIN network_devices nd ON nd.id = cb.device_id WHERE cb.device_id = ? ORDER BY cb.created_at DESC LIMIT ?
    `).all(deviceId, limit) as NetworkConfigBackupWithDevice[];
  },

  /** 获取备份详情（含设备名） */
  getWithDeviceName(id: string): NetworkConfigBackupWithDevice | undefined {
    return db.prepare(`
      SELECT cb.*, nd.name as device_name FROM network_config_backups cb
      LEFT JOIN network_devices nd ON nd.id = cb.device_id WHERE cb.id = ?
    `).get(id) as NetworkConfigBackupWithDevice | undefined;
  },

  /** 获取备份文本内容 */
  getContent(id: string): string | undefined {
    const row = db.prepare('SELECT config_text FROM network_config_backups WHERE id = ?').get(id) as { config_text: string } | undefined;
    return row?.config_text;
  },

  /** 清理旧备份（保留最近 N 条） */
  cleanOld(deviceId: string, keepCount: number): void {
    db.prepare(`
      DELETE FROM network_config_backups WHERE device_id = ? AND id NOT IN (
        SELECT id FROM network_config_backups WHERE device_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(deviceId, deviceId, keepCount);
  },
};