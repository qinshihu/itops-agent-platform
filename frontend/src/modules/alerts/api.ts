/**
 * Alerts 模块 API 服务层
 * 封装所有告警相关端点的调用，参照 mcp/api.ts 模式
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

// ── 告警核心 ──

export interface Alert {
  id: string;
  source: string;
  severity: string;
  title: string;
  content: string;
  status: string;
  metadata: Record<string, unknown>;
  related_task_id?: string | null;
  created_at: string;
}

export interface AlertListParams {
  status?: string;
  severity?: string;
}

export interface AutomationLog {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

export interface ProcessResult {
  alertId: string;
  matchedPolicies: Array<{ id: string; name: string; execution_mode: string }>;
  mappingTasks?: Array<{
    taskId: string;
    mappingId: string;
    workflowId: string;
    workflowName: string;
  }>;
  executionIds: string[];
  error: string | null;
}

// ── AI 自动分析 ──

export interface AutoAnalysisResult {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: 'network_device' | 'server';
  status: 'pending' | 'running' | 'completed' | 'failed';
  diagnosis: string;
  summary: string;
  raw_output: string;
  commands_executed: string;
  error_message?: string;
  duration_ms: number;
  created_at: string;
}

export interface AutoAnalysisListParams {
  limit?: number;
}

// ── 告警关联聚合 ──

export interface CorrelationGroup {
  id: string;
  title: string;
  status: string;
  severity: string;
  alert_count: number;
  device_ids: string;
  root_alert_id?: string;
  auto_detected: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  member_count: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  alert_id: string;
  title?: string;
  content?: string;
  severity?: string;
  source?: string;
  status?: string;
  is_root: number;
  alert_created_at?: string;
}

export interface CorrelationGroupDetail {
  group: CorrelationGroup;
  members: GroupMember[];
}

export interface CorrelationStats {
  total_groups: number;
  open_groups: number;
  resolved_groups: number;
  auto_detected: number;
  avg_group_size: number;
}

export interface CorrelationGroupListParams {
  status?: string;
  limit?: number;
}

export interface AutoCorrelateResult {
  grouped?: number;
  [key: string]: unknown;
}

// ── 告警映射 ──

export interface AlertMapping {
  id: string;
  alert_source: string | null;
  alert_severity: string | null;
  alert_title_pattern: string | null;
  workflow_id: string;
  enabled: number;
  created_at: string;
  workflow_name: string;
}

export interface AlertMappingInput {
  alert_source?: string;
  alert_severity?: string;
  alert_title_pattern?: string;
  workflow_id: string;
  enabled?: boolean;
}

// ── 告警降噪 ──

export interface NoiseAlert {
  id: string;
  alert_fingerprint: string;
  alert_source: string;
  alert_title: string;
  occurrence_count: number;
  first_occurrence: string;
  last_occurrence: string;
  is_suppressed: boolean;
  suppression_reason?: string;
  suppression_until?: string;
}

export interface NoiseStats {
  totalAlerts: number;
  suppressedAlerts: number;
  duplicateCount: number;
  noiseReductionRate: number;
}

export interface SuppressParams {
  fingerprint: string;
  reason: string;
  durationMinutes: number;
}

// ── 告警源配置 ──

export interface AlertProvider {
  id: string;
  name: string;
  type: string;
  configSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      default?: unknown;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface AlertProviderConfig {
  id: string;
  provider_id: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertProviderConfigInput {
  provider_id: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface FetchProviderParams {
  provider: string;
  config: Record<string, unknown>;
}

// ── 巡检中心 ──

export interface InspectionItem {
  id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  source: 'inspection' | 'analysis';
  type: string;
  status: 'success' | 'failed' | 'partial';
  summary: string;
  duration_ms: number;
  created_at: string;
  raw: unknown;
}

export interface InspectionListParams {
  limit?: string;
  deviceId?: string;
}

export interface DashboardLinkage {
  remediations?: { total?: number } & Record<string, unknown>;
  [key: string]: unknown;
}

// ============================================================
// alertApi 对象
// ============================================================

export const alertApi = {
  // ── 告警核心 ──

  /** 获取告警列表 */
  async listAlerts(params?: AlertListParams): Promise<Alert[]> {
    const { data } = await api.get('/api/alerts', { params });
    return data;
  },

  /** 获取告警自动处理记录 */
  async getAutomationLogs(alertId: string): Promise<AutomationLog[]> {
    const { data } = await api.get(`/api/alerts/${alertId}/automation-logs`);
    return data;
  },

  /** 确认告警 */
  async acknowledgeAlert(alertId: string): Promise<void> {
    await api.put(`/api/alerts/${alertId}/acknowledge`);
  },

  /** 解决告警 */
  async resolveAlert(alertId: string): Promise<void> {
    await api.put(`/api/alerts/${alertId}/resolve`);
  },

  /** 处理告警（匹配映射+修复策略+根因分析） */
  async processAlert(alertId: string): Promise<ProcessResult> {
    const { data } = await api.post(`/api/alerts/${alertId}/process`);
    return data;
  },

  // ── AI 自动分析 ──

  /** 获取 AI 自动分析列表 */
  async listAutoAnalysis(params?: AutoAnalysisListParams): Promise<AutoAnalysisResult[]> {
    const { data } = await api.get('/api/alert-auto-analysis', { params });
    return data;
  },

  // ── 告警关联聚合 ──

  /** 获取关联组列表 */
  async listCorrelationGroups(params?: CorrelationGroupListParams): Promise<CorrelationGroup[]> {
    const { data } = await api.get('/api/alert-correlation/groups', { params });
    return data;
  },

  /** 获取关联统计 */
  async getCorrelationStats(): Promise<CorrelationStats> {
    const { data } = await api.get('/api/alert-correlation/stats');
    return data;
  },

  /** 获取关联组详情 */
  async getCorrelationGroup(groupId: string): Promise<CorrelationGroupDetail> {
    const { data } = await api.get(`/api/alert-correlation/groups/${groupId}`);
    return data;
  },

  /** 标记关联组为已解决 */
  async resolveCorrelationGroup(groupId: string): Promise<void> {
    await api.post(`/api/alert-correlation/groups/${groupId}/resolve`, {});
  },

  /** 删除关联组 */
  async deleteCorrelationGroup(groupId: string): Promise<void> {
    await api.delete(`/api/alert-correlation/groups/${groupId}`);
  },

  /** 触发自动关联 */
  async autoCorrelate(): Promise<AutoCorrelateResult> {
    const { data } = await api.post('/api/alert-correlation/auto');
    return data;
  },

  // ── 告警映射 ──

  /** 获取告警映射列表 */
  async listMappings(): Promise<AlertMapping[]> {
    const { data } = await api.get('/api/alert-mappings');
    return data;
  },

  /** 创建告警映射 */
  async createMapping(input: AlertMappingInput): Promise<AlertMapping> {
    const { data } = await api.post('/api/alert-mappings', input);
    return data;
  },

  /** 更新告警映射 */
  async updateMapping(id: string, input: AlertMappingInput): Promise<AlertMapping> {
    const { data } = await api.put(`/api/alert-mappings/${id}`, input);
    return data;
  },

  /** 删除告警映射 */
  async deleteMapping(id: string): Promise<void> {
    await api.delete(`/api/alert-mappings/${id}`);
  },

  // ── 告警降噪 ──

  /** 获取降噪统计 */
  async getNoiseStats(): Promise<NoiseStats> {
    const { data } = await api.get('/api/alert-noise/stats');
    return data;
  },

  /** 获取已抑制告警列表 */
  async getSuppressedAlerts(): Promise<NoiseAlert[]> {
    const { data } = await api.get('/api/alert-noise/suppressed');
    return data;
  },

  /** 抑制告警 */
  async suppressAlert(params: SuppressParams): Promise<void> {
    await api.post('/api/alert-noise/suppress', params);
  },

  /** 取消抑制告警 */
  async unsuppressAlert(fingerprint: string): Promise<void> {
    await api.post('/api/alert-noise/unsuppress', { fingerprint });
  },

  /** 清理降噪历史记录 */
  async cleanupNoise(daysToKeep: number): Promise<void> {
    await api.post('/api/alert-noise/cleanup', { daysToKeep });
  },

  // ── 告警源配置 ──

  /** 获取可用告警源列表 */
  async listProviders(params?: { type?: string }): Promise<AlertProvider[]> {
    const { data } = await api.get('/api/alerts/providers/list', { params });
    return data;
  },

  /** 获取告警源配置列表 */
  async listProviderConfigs(): Promise<AlertProviderConfig[]> {
    const { data } = await api.get('/api/alerts/providers/configs');
    return data;
  },

  /** 创建告警源配置 */
  async createProviderConfig(input: AlertProviderConfigInput): Promise<AlertProviderConfig> {
    const { data } = await api.post('/api/alerts/providers/configs', input);
    return data;
  },

  /** 更新告警源配置 */
  async updateProviderConfig(id: string, input: AlertProviderConfigInput): Promise<AlertProviderConfig> {
    const { data } = await api.put(`/api/alerts/providers/configs/${id}`, input);
    return data;
  },

  /** 删除告警源配置 */
  async deleteProviderConfig(id: string): Promise<void> {
    await api.delete(`/api/alerts/providers/configs/${id}`);
  },

  /** 测试/拉取告警源数据 */
  async fetchProvider(params: FetchProviderParams): Promise<unknown> {
    const { data } = await api.post('/api/alerts/providers/fetch', params);
    return data;
  },

  // ── 巡检中心 ──

  /** 获取巡检中心列表 */
  async listInspections(params?: InspectionListParams): Promise<InspectionItem[]> {
    const { data } = await api.get('/api/inspection-center', { params });
    return data;
  },

  /** 获取仪表盘联动数据 */
  async getDashboardLinkage(): Promise<DashboardLinkage> {
    const { data } = await api.get('/api/dashboard/linkage');
    return data;
  },
};

export default alertApi;
