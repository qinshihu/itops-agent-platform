/**
 * Infra 模块 API 服务层
 * 封装系统设置、脚本、工具链接、通知、审计日志、配置模板、审批相关端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

// ── 脚本 ──

export interface ScriptParameter {
  name: string;
  description: string;
  required: boolean;
}

export interface Script {
  id: string;
  name: string;
  description: string;
  type: string;
  content: string;
  parameters: ScriptParameter[];
  category: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ScriptInput {
  name: string;
  description?: string;
  type: string;
  content: string;
  parameters: ScriptParameter[];
  category: string;
}

export interface ScriptListParams {
  search?: string;
  category?: string;
}

// ── 工具链接 ──

export interface ToolLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  image_icon: string | null;
  category: string;
  description: string | null;
  sort_order: number;
  is_external: number;
}

export interface ToolLinkInput {
  name: string;
  url: string;
  icon: string;
  category: string;
  description?: string;
  sort_order: number;
  is_external: boolean;
}

export interface ToolLinkCategory {
  category: string;
  tools: ToolLink[];
}

// ── 通知 ──

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string | null;
  recipient: string | null;
  status: string;
  related_alert_id: string | null;
  related_task_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}

export interface NotificationStats {
  [key: string]: unknown;
}

// ── 通知配置 ──

export interface NotificationConfig {
  email_config?: Record<string, unknown>;
  dingtalk_config?: { webhook_url?: string; [key: string]: unknown };
  webhook_config?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── 审计日志 ──

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

// ── 配置模板 ──

export interface ConfigTemplate {
  id: string;
  name: string;
  type: string;
  target_type: string;
  version: number;
  tags?: string | string[];
  content: string;
  variables?: string | string[];
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ConfigTemplateInput {
  name: string;
  type: string;
  target_type: string;
  content: string;
  variables: string[];
  tags?: string[];
  description?: string;
}

export interface ConfigTemplateListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
}

export interface RenderResult {
  rendered: string;
  [key: string]: unknown;
}

// ── 审批 ──

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

// ── QAnything 配置 ──

export interface QAnythingConfig {
  enabled: boolean;
  apiBase: string;
  apiKey: string;
  kbId: string;
  mode: 'cloud' | 'local';
  topK: number;
}

// ── 备份 ──

export interface BackupRecord {
  id: string;
  [key: string]: unknown;
}

// ── 工具（Agent Tools） ──

export interface AgentTool {
  id: string;
  name: string;
  [key: string]: unknown;
}

// ============================================================
// infraApi 对象
// ============================================================

export const infraApi = {
  // ── 脚本 ──

  /** 获取脚本列表 */
  async listScripts(params?: ScriptListParams): Promise<Script[]> {
    const { data } = await api.get('/api/scripts', { params });
    return data.data;
  },

  /** 获取脚本分类 */
  async listScriptCategories(): Promise<string[]> {
    const { data } = await api.get('/api/scripts/categories');
    return data.data;
  },

  /** 创建脚本 */
  async createScript(input: ScriptInput): Promise<Script> {
    const { data } = await api.post('/api/scripts', input);
    return data.data;
  },

  /** 更新脚本 */
  async updateScript(id: string, input: ScriptInput): Promise<Script> {
    const { data } = await api.put(`/api/scripts/${id}`, input);
    return data.data;
  },

  /** 删除脚本 */
  async deleteScript(id: string): Promise<void> {
    await api.delete(`/api/scripts/${id}`);
  },

  // ── 工具链接 ──

  /** 获取工具链接分类分组 */
  async listToolLinkCategories(): Promise<ToolLinkCategory[]> {
    const { data } = await api.get('/api/tool-links/categories');
    return data.data;
  },

  /** 获取工具链接列表 */
  async listToolLinks(): Promise<ToolLink[]> {
    const { data } = await api.get('/api/tool-links');
    return data.data;
  },

  /** 创建工具链接 */
  async createToolLink(input: ToolLinkInput): Promise<ToolLink> {
    const { data } = await api.post('/api/tool-links', input);
    return data.data;
  },

  /** 更新工具链接 */
  async updateToolLink(id: string, input: Partial<ToolLinkInput>): Promise<ToolLink> {
    const { data } = await api.put(`/api/tool-links/${id}`, input);
    return data.data;
  },

  /** 删除工具链接 */
  async deleteToolLink(id: string): Promise<void> {
    await api.delete(`/api/tool-links/${id}`);
  },

  /** 上传工具链接图标 */
  async uploadToolLinkIcon(id: string, formData: FormData): Promise<ToolLink> {
    const { data } = await api.post(`/api/tool-links/${id}/upload-icon`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  /** 删除工具链接图标 */
  async deleteToolLinkIcon(id: string): Promise<void> {
    await api.delete(`/api/tool-links/${id}/icon`);
  },

  // ── 通知 ──

  /** 获取通知列表 */
  async listNotifications(params?: NotificationListParams): Promise<{ logs: Notification[]; total?: number }> {
    const { data } = await api.get('/api/notifications', { params });
    return data.data;
  },

  /** 获取通知统计 */
  async getNotificationStats(): Promise<NotificationStats> {
    const { data } = await api.get('/api/notifications/stats/summary');
    return data.data;
  },

  /** 标记通知为已发送 */
  async markNotificationSent(id: string): Promise<void> {
    await api.put(`/api/notifications/${id}/send`);
  },

  /** 删除通知 */
  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/api/notifications/${id}`);
  },

  // ── 通知配置 ──

  /** 获取通知配置 */
  async getNotificationConfig(): Promise<NotificationConfig> {
    const { data } = await api.get('/api/notification-config');
    return data.data;
  },

  /** 更新通知配置 */
  async updateNotificationConfig(config: NotificationConfig): Promise<unknown> {
    const { data } = await api.put('/api/notification-config', config);
    return data;
  },

  /** 测试通知渠道 */
  async testNotificationChannel(channel: string, body?: Record<string, unknown>): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data } = await api.post(`/api/notification-config/test/${channel}`, body);
    return data;
  },

  // ── 审计日志 ──

  /** 获取审计日志列表 */
  async listAuditLogs(params?: AuditListParams): Promise<AuditListResult> {
    const { data } = await api.get('/api/audit', { params });
    return data.data;
  },

  /** 获取审计统计 */
  async getAuditStats(): Promise<AuditStats> {
    const { data } = await api.get('/api/audit/stats/summary');
    return data.data;
  },

  // ── 配置模板 ──

  /** 获取配置模板列表（分页） */
  async listConfigTemplates(params?: ConfigTemplateListParams): Promise<{ data: ConfigTemplate[]; total: number }> {
    const { data } = await api.get('/api/config-templates', { params });
    return data;
  },

  /** 创建配置模板 */
  async createConfigTemplate(input: ConfigTemplateInput): Promise<ConfigTemplate> {
    const { data } = await api.post('/api/config-templates', input);
    return data.data;
  },

  /** 更新配置模板 */
  async updateConfigTemplate(id: string, input: ConfigTemplateInput): Promise<ConfigTemplate> {
    const { data } = await api.put(`/api/config-templates/${id}`, input);
    return data.data;
  },

  /** 删除配置模板 */
  async deleteConfigTemplate(id: string): Promise<void> {
    await api.delete(`/api/config-templates/${id}`);
  },

  /** 渲染配置模板预览 */
  async renderConfigTemplate(id: string, variables: Record<string, string>): Promise<RenderResult> {
    const { data } = await api.post(`/api/config-templates/${id}/render`, { variables });
    return data.data;
  },

  // ── 审批 ──

  /** 获取审批列表 */
  async listApprovals(params?: { status?: string }): Promise<ApprovalRequest[]> {
    const { data } = await api.get('/api/approvals', { params });
    return data.data;
  },

  /** 审批通过 */
  async approveRequest(approvalId: string, comment?: string): Promise<void> {
    await api.post(`/api/approvals/${approvalId}/approve`, { comment: comment || '审批通过' });
  },

  /** 审批拒绝 */
  async rejectRequest(approvalId: string, reason: string): Promise<void> {
    await api.post(`/api/approvals/${approvalId}/reject`, { reason });
  },

  // ── QAnything 知识库配置 ──

  /** 获取 QAnything 配置 */
  async getQAnythingConfig(): Promise<QAnythingConfig> {
    const { data } = await api.get('/api/knowledge/qanything/config');
    return data.data;
  },

  /** 更新 QAnything 配置 */
  async updateQAnythingConfig(config: QAnythingConfig): Promise<unknown> {
    const { data } = await api.post('/api/knowledge/qanything/config', config);
    return data;
  },

  /** 测试 QAnything 连接 */
  async testQAnything(): Promise<unknown> {
    const { data } = await api.post('/api/knowledge/qanything/test');
    return data;
  },

  /** 批量上传文档到 QAnything */
  async uploadQAnythingBatch(formData: FormData): Promise<unknown> {
    const { data } = await api.post('/api/knowledge/qanything/upload-batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // ── 备份管理 ──

  /** 创建备份 */
  async createBackup(): Promise<unknown> {
    const { data } = await api.post('/api/backups/create');
    return data;
  },

  /** 获取备份历史 */
  async listBackups(): Promise<BackupRecord[]> {
    const { data } = await api.get('/api/backups/history');
    return data.data;
  },

  /** 恢复备份 */
  async restoreBackup(backupId: string): Promise<unknown> {
    const { data } = await api.post(`/api/backups/restore/${backupId}`);
    return data;
  },

  /** 删除备份 */
  async deleteBackup(backupId: string): Promise<void> {
    await api.delete(`/api/backups/${backupId}`);
  },

  /** 上传备份文件 */
  async uploadBackup(formData: FormData): Promise<unknown> {
    const { data } = await api.post('/api/backups/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // ── Agent 工具 ──

  /** 获取 Agent 工具列表 */
  async listAgentTools(params?: Record<string, unknown>): Promise<AgentTool[]> {
    const { data } = await api.get('/api/agents/tools/list', { params });
    return data.data;
  },

  /** 测试 Agent 工具 */
  async testAgentTool(toolId: string, args: Record<string, unknown>): Promise<unknown> {
    const { data } = await api.post('/api/agents/tools/test', { toolId, args });
    return data;
  },
};

export default infraApi;
