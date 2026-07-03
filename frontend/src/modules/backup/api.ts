/**
 * Backup 模块 API 层
 * 封装数据库备份与恢复相关的 API 端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

export interface Backup {
  id: string;
  filename: string;
  size: number;
  has_encryption?: boolean;
  created_at: string;
  [key: string]: unknown;
}

// ============================================================
// backupApi 对象
// ============================================================

export const backupApi = {
  /** 创建备份 */
  async create(): Promise<Backup> {
    const { data } = await api.post('/api/backups');
    return data.data;
  },

  /** 获取备份列表 */
  async list(): Promise<Backup[]> {
    const { data } = await api.get('/api/backups');
    return data.data;
  },

  /** 恢复备份 */
  async restore(backupId: string): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post(`/api/backups/${backupId}/restore`);
    return data;
  },

  /** 删除备份 */
  async delete(backupId: string): Promise<void> {
    await api.delete(`/api/backups/${backupId}`);
  },

  /** 上传备份文件 */
  async upload(file: File): Promise<Backup> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/api/backups/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },
};
