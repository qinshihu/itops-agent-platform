/**
 * Change Management 模块 API 层
 * 封装 IT 变更管理与审批相关的 API 端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

export interface ApprovalRequest {
  id: string;
  task_id: string;
  node_id: string;
  node_label: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  reject_reason?: string;
  timeout_at?: string;
  timeout_action: 'reject' | 'wait';
  created_at: string;
  updated_at: string;
}

// ============================================================
// changeManagementApi 对象
// ============================================================

export const changeManagementApi = {
  /** 获取审批列表 */
  async listApprovals(params?: { status?: string }): Promise<ApprovalRequest[]> {
    const query = params?.status && params.status !== 'all' ? `?status=${params.status}` : '';
    const { data } = await api.get(`/api/approvals${query}`);
    return data.data;
  },

  /** 通过审批 */
  async approve(approvalId: string, comment?: string): Promise<void> {
    await api.post(`/api/approvals/${approvalId}/approve`, { comment: comment || '审批通过' });
  },

  /** 拒绝审批 */
  async reject(approvalId: string, reason: string): Promise<void> {
    await api.post(`/api/approvals/${approvalId}/reject`, { reason });
  },
};
