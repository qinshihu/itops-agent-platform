/**
 * Database 模块 API 服务层
 * 封装数据库连接管理相关端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

export interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  database: string;
  description?: string;
  tags?: string[];
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface DbConnectionInput {
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  database: string;
  description?: string;
  tags?: string[];
  enabled?: boolean;
}

export interface TestConnectResult {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

// ============================================================
// databaseApi 对象
// ============================================================

export const databaseApi = {
  // ── 数据库连接 ──

  /** 获取数据库连接列表 */
  async listConnections(): Promise<DbConnection[]> {
    const { data } = await api.get('/api/db-connections');
    return data.data;
  },

  /** 创建数据库连接 */
  async createConnection(input: DbConnectionInput): Promise<DbConnection> {
    const { data } = await api.post('/api/db-connections', input);
    return data;
  },

  /** 更新数据库连接 */
  async updateConnection(id: string, input: DbConnectionInput): Promise<DbConnection> {
    const { data } = await api.put(`/api/db-connections/${id}`, input);
    return data;
  },

  /** 删除数据库连接 */
  async deleteConnection(id: string): Promise<void> {
    await api.delete(`/api/db-connections/${id}`);
  },

  /** 测试连接（使用表单数据，未保存的连接） */
  async testConnect(input: DbConnectionInput): Promise<TestConnectResult> {
    const { data } = await api.post('/api/db-connections/test-connect', input);
    return data;
  },

  /** 测试已保存的连接 */
  async testSavedConnection(id: string): Promise<TestConnectResult> {
    const { data } = await api.post(`/api/db-connections/${id}/test`);
    return data;
  },
};

export default databaseApi;
