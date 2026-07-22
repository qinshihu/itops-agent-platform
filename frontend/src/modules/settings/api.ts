/**
 * Settings 模块 API 服务层
 *
 * 从原 frontend infra/ 抽离（2026-07-08 增量-12 P1-6 frontend 同步）。
 *
 * 实际 settings 相关 API 分散在多个子域：
 * - /settings 端点（后端 settings 模块）
 * - /knowledge/qanything/* 端点（ai 模块子域）
 * - /notification-config 端点（notification 模块）
 * - /backups/* 端点（backup 模块）
 *
 * 本文件只封装最常用的 settings 表 CRUD 端点。其他端点的 API 封装在各自主模块。
 */

import api from '@/lib/api';

// ── 类型定义 ──

export interface Setting {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

export interface SettingInput {
  key: string;
  value: string;
  description?: string;
}

// ── API 对象 ──

export const settingsApi = {
  /** 获取所有设置项 */
  async listSettings(): Promise<Setting[]> {
    const { data } = await api.get('/settings');
    return data;
  },

  /** 获取单个设置项 */
  async getSetting(key: string): Promise<Setting | null> {
    const { data } = await api.get(`/settings/${key}`);
    return data;
  },

  /** 更新设置项 */
  async updateSetting(key: string, value: string): Promise<Setting> {
    const { data } = await api.put(`/settings/${key}`, { value });
    return data;
  },
};

export default settingsApi;
