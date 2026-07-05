/**
 * Auto 模块 API 服务层
 * 封装自动伸缩、修复策略、修复执行、修复审计、仪表盘统计相关端点
 */

import api from '@/lib/api';

// ============================================================
// 通用类型
// ============================================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

// ── 自动伸缩 ──

export interface ScaleRule {
  id: string;
  name: string;
  targetType: 'container' | 'vm';
  targetId: string;
  targetName: string;
  metricType: 'cpu' | 'memory' | 'pod_count';
  threshold: number;
  targetValue: number;
  minInstances: number;
  maxInstances: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  enabled: boolean;
  createdAt?: string;
}

export interface ScaleRuleInput {
  name?: string;
  targetType?: 'container' | 'vm';
  targetId?: string;
  targetName?: string;
  metricType?: 'cpu' | 'memory' | 'pod_count';
  threshold?: number;
  targetValue?: number;
  minInstances?: number;
  maxInstances?: number;
  scaleUpCooldown?: number;
  scaleDownCooldown?: number;
  enabled?: boolean;
}

export interface ScaleHistory {
  id: string;
  time: string;
  ruleName: string;
  target: string;
  action: 'scale_up' | 'scale_down';
  beforeCount: number;
  afterCount: number;
  metricValue: number;
  result: 'success' | 'failed';
  reason: string;
}

export interface ScaleHistoryListParams {
  page?: number;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
}

export interface ScaleSummary {
  activeRules: number;
  todayScaleUp: number;
  todayScaleDown: number;
  totalManagedInstances: number;
}

// ── 修复策略 ──

export interface RemediationPolicy {
  id: string;
  name: string;
  description?: string;
  alert_source: string;
  alert_severity: string;
  alert_keywords?: string | null;
  alert_tags?: string | null;
  execution_mode: 'auto' | 'approval' | 'suggestion';
  workflow_id: string;
  workflow_params?: string;
  max_executions_per_hour: number;
  cooldown_seconds: number;
  enable_verification: number;
  verification_workflow_id?: string;
  verification_params?: string;
  verification_timeout_seconds?: number;
  enable_rollback: number;
  rollback_workflow_id?: string;
  rollback_on_failure?: number;
  enabled?: number;
  created_at?: string;
  updated_at?: string;
}

export interface RemediationPolicyInput {
  name: string;
  description?: string;
  alert_source: string;
  alert_severity?: string;
  alert_keywords?: string | null;
  alert_tags?: string | null;
  execution_mode: 'auto' | 'approval' | 'suggestion';
  workflow_id: string;
  workflow_params?: string;
  max_executions_per_hour?: number;
  cooldown_seconds?: number;
  enable_verification?: boolean;
  verification_workflow_id?: string;
  verification_params?: string;
  verification_timeout_seconds?: number;
  enable_rollback?: boolean;
  rollback_workflow_id?: string;
  rollback_on_failure?: boolean;
}

export interface RemediationPolicyListParams {
  page?: number;
  limit?: number;
  enabled?: string;
}

export interface RemediationPolicyStats {
  total_triggers: number;
  success_rate: number;
  avg_duration_ms: number;
}

export interface RemediationPolicyListResult {
  policies: RemediationPolicy[];
}

// ── 修复执行 ──

export interface RemediationExecution {
  id: string;
  status: string;
  status_reason?: string;
  created_at: string;
  policy_name?: string;
  execution_mode?: string;
  alert_title?: string;
  alert_severity?: string;
  [key: string]: unknown;
}

export interface RemediationExecutionListParams {
  page?: number;
  limit?: number;
  status?: string;
}

export interface ApproveExecutionInput {
  action: 'approve' | 'reject';
}

// ── 修复审计 ──

export interface RemediationAudit {
  id: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface RemediationAuditListParams {
  page?: number;
  limit?: number;
}

export interface RejectAuditInput {
  action?: string;
  comment?: string;
}

// ── 仪表盘统计 ──

export interface RemediationStats {
  total_policies: number;
  enabled_policies: number;
  today: {
    total: number;
    success: number;
    failed: number;
    rolled_back: number;
    success_rate: number;
    avg_duration_ms: number;
  };
  waiting_approval: number;
  recent_executions: Array<{
    id: string;
    status: string;
    status_reason: string;
    created_at: string;
    policy_name: string;
    execution_mode: string;
    alert_title: string;
    alert_severity: string;
  }>;
}

export interface PolicyWithStats {
  id: string;
  name: string;
  enabled: number;
  alert_source: string;
  alert_severity: string;
  stats: {
    total_triggers: number;
    success_rate: number;
    avg_duration_ms: number;
  };
}

export interface AlertSourceStats {
  source: string;
  total_alerts: number;
  new_alerts: number;
  active_alerts: number;
  resolved_alerts: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

export interface ExecutionTrend {
  time_bucket: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
}

// ============================================================
// autoApi 对象
// ============================================================

export const autoApi = {
  // ── 自动伸缩 ──

  /** 获取伸缩规则列表 */
  async listScaleRules(): Promise<ScaleRule[]> {
    const { data } = await api.get('/auto-scale/rules');
    return data.data || [];
  },

  /** 创建伸缩规则 */
  async createScaleRule(input: ScaleRuleInput): Promise<void> {
    await api.post('/auto-scale/rules', input);
  },

  /** 更新伸缩规则 */
  async updateScaleRule(id: string, input: ScaleRuleInput): Promise<void> {
    await api.put(`/auto-scale/rules/${id}`, input);
  },

  /** 删除伸缩规则 */
  async deleteScaleRule(id: string): Promise<void> {
    await api.delete(`/auto-scale/rules/${id}`);
  },

  /** 获取伸缩历史 */
  async listScaleHistory(params?: ScaleHistoryListParams): Promise<PaginatedResult<ScaleHistory>> {
    const { data } = await api.get('/auto-scale/history', { params });
    return data;
  },

  /** 获取伸缩统计摘要 */
  async getScaleSummary(): Promise<ScaleSummary> {
    const { data } = await api.get('/auto-scale/summary');
    return data.data || { activeRules: 0, todayScaleUp: 0, todayScaleDown: 0, totalManagedInstances: 0 };
  },

  // ── 修复策略 ──

  /** 获取修复策略列表 */
  async listRemediationPolicies(params?: RemediationPolicyListParams): Promise<RemediationPolicyListResult> {
    const { data } = await api.get('/remediation-policies', { params });
    return data.data;
  },

  /** 获取修复策略详情 */
  async getRemediationPolicy(id: string): Promise<RemediationPolicy> {
    const { data } = await api.get(`/remediation-policies/${id}`);
    return data.data;
  },

  /** 创建修复策略 */
  async createRemediationPolicy(input: RemediationPolicyInput): Promise<void> {
    await api.post('/remediation-policies', input);
  },

  /** 更新修复策略 */
  async updateRemediationPolicy(id: string, input: RemediationPolicyInput): Promise<void> {
    await api.put(`/remediation-policies/${id}`, input);
  },

  /** 删除修复策略 */
  async deleteRemediationPolicy(id: string): Promise<void> {
    await api.delete(`/remediation-policies/${id}`);
  },

  /** 切换修复策略启用状态 */
  async toggleRemediationPolicy(id: string): Promise<void> {
    await api.patch(`/remediation-policies/${id}/toggle`);
  },

  /** 获取修复策略统计 */
  async getRemediationPolicyStats(id: string, params?: { days?: number }): Promise<RemediationPolicyStats> {
    const { data } = await api.get(`/remediation-policies/${id}/stats`, { params });
    return data.data;
  },

  // ── 修复执行 ──

  /** 获取修复执行列表 */
  async listRemediationExecutions(params?: RemediationExecutionListParams): Promise<RemediationExecution[]> {
    const { data } = await api.get('/remediation-executions', { params });
    return data.data;
  },

  /** 获取修复执行详情 */
  async getRemediationExecution(id: string): Promise<RemediationExecution> {
    const { data } = await api.get(`/remediation-executions/${id}`);
    return data.data;
  },

  /** 审批修复执行 */
  async approveRemediationExecution(id: string, input: ApproveExecutionInput): Promise<void> {
    await api.post(`/remediation-executions/${id}/approve`, input);
  },

  /** 重试修复执行 */
  async retryRemediationExecution(id: string): Promise<void> {
    await api.post(`/remediation-executions/${id}/retry`);
  },

  // ── 修复审计 ──

  /** 获取修复审计列表 */
  async listRemediationAudits(params?: RemediationAuditListParams): Promise<RemediationAudit[]> {
    const { data } = await api.get('/remediation-audits', { params });
    return data.data;
  },

  /** 获取修复审计详情 */
  async getRemediationAudit(id: string): Promise<RemediationAudit> {
    const { data } = await api.get(`/remediation-audits/${id}`);
    return data.data;
  },

  /** 审批修复审计 */
  async approveRemediationAudit(id: string, input?: RejectAuditInput): Promise<void> {
    await api.post(`/remediation-audits/${id}/approve`, input);
  },

  /** 执行修复审计 */
  async executeRemediationAudit(id: string): Promise<void> {
    await api.post(`/remediation-audits/${id}/execute`);
  },

  /** 回滚修复审计 */
  async rollbackRemediationAudit(id: string): Promise<void> {
    await api.post(`/remediation-audits/${id}/rollback`);
  },

  /** 验证修复审计 */
  async verifyRemediationAudit(id: string): Promise<void> {
    await api.post(`/remediation-audits/${id}/verify`);
  },

  // ── 仪表盘统计 ──

  /** 获取修复统计 */
  async getRemediationStats(): Promise<RemediationStats> {
    const { data } = await api.get('/dashboard/remediation-stats');
    return data.data;
  },

  /** 获取告警源统计 */
  async getAlertSourceStats(): Promise<AlertSourceStats[]> {
    const { data } = await api.get('/dashboard/alert-source-stats');
    return data.data.source_stats;
  },

  /** 获取任务趋势 */
  async getTaskTrends(hours: number): Promise<ExecutionTrend[]> {
    const { data } = await api.get('/dashboard/task-trends', { params: { hours } });
    return data.data;
  },
};

export default autoApi;
