/**
 * Audit 模块 API 服务层
 *
 * 封装审计日志查询端点（从原 infra/ 模块抽离，2026-07-08 增量-12 P1-6 frontend 同步）。
 * backend P1-6 已建立独立的 modules/audit/ 模块（ADR-017），本文件是 frontend 对应。
 */

import api from '@/lib/api';

// ── 类型定义 ──

export interface AuditLog {
  id: string;
  user_id: string | null;
  username: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  result: string | null;
  status: string;
  created_at: string;
  completed_at: string;
}

export interface AuditListParams {
  page?: number;
  limit?: number;
  action?: string;
  resource_type?: string;
}

export interface AuditListResult {
  logs: AuditLog[];
  total?: number;
  [key: string]: unknown;
}

export interface AuditStats {
  [key: string]: unknown;
}

// ── API 对象 ──

export const auditApi = {
  /** 获取审计日志列表 */
  async listAuditLogs(params?: AuditListParams): Promise<AuditListResult> {
    const { data } = await api.get('/audit', { params });
    return data;
  },

  /** 获取审计统计 */
  async getAuditStats(): Promise<AuditStats> {
    const { data } = await api.get('/audit/stats/summary');
    return data;
  },
};

export default auditApi;
