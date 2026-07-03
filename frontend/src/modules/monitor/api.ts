/**
 * Monitor 模块 API 服务层
 * 封装仪表盘统计、报告管理、成本分析相关端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

// ── 仪表盘统计 ──

export interface DashboardFullData {
  [key: string]: unknown;
}

export interface AlertTrends {
  [key: string]: unknown;
}

export interface TaskTrends {
  [key: string]: unknown;
}

export interface AgentStats {
  [key: string]: unknown;
}

export interface TaskDistribution {
  [key: string]: unknown;
}

export interface RemediationStats {
  [key: string]: unknown;
}

export interface ServerMetrics {
  [key: string]: unknown;
}

export interface SlaStats {
  [key: string]: unknown;
}

// ── 报告 ──

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'incident' | 'inspection' | 'change';
  content: string;
  variables: string[];
  [key: string]: unknown;
}

export interface ReportTemplateInput {
  name: string;
  description?: string;
  type: 'incident' | 'inspection' | 'change';
  content: string;
  variables: string[];
}

export interface ReportRecord {
  id: string;
  [key: string]: unknown;
}

export interface ReportAnalytics {
  [key: string]: unknown;
}

export interface ScheduledReport {
  id: string;
  [key: string]: unknown;
}

export interface GenerateReportInput {
  templateId: string;
  variables: Record<string, string>;
  format?: string;
}

// ── 成本分析 ──

export interface ContainerCost {
  name: string;
  host: string;
  cpuCores: number;
  memoryMB: number;
  hourlyRate: number;
  dailyEstimate: number;
  monthlyEstimate: number;
}

export interface VMCost {
  name: string;
  platform: string;
  cpuCores: number;
  memoryGB: number;
  diskGB: number;
  hourlyRate: number;
  monthlyEstimate: number;
}

export interface CostRecommendation {
  id: string;
  type: 'idle' | 'downsize' | 'reserved';
  title: string;
  description: string;
  monthlySavings: number;
  resource: string;
}

export interface CostSummary {
  containerMonthly: number;
  vmMonthly: number;
  totalMonthly: number;
  idleWaste: number;
}

// ============================================================
// monitorApi 对象
// ============================================================

export const monitorApi = {
  // ── 仪表盘统计 ──

  /** 获取完整仪表盘数据 */
  async getDashboardFull(): Promise<DashboardFullData> {
    const { data } = await api.get('/api/dashboard/full');
    return data.data;
  },

  /** 获取告警趋势 */
  async getAlertTrends(): Promise<AlertTrends> {
    const { data } = await api.get('/api/dashboard/alert-trends');
    return data.data;
  },

  /** 获取任务趋势 */
  async getTaskTrends(): Promise<TaskTrends> {
    const { data } = await api.get('/api/dashboard/task-trends');
    return data.data;
  },

  /** 获取 Agent 统计 */
  async getAgentStats(): Promise<AgentStats> {
    const { data } = await api.get('/api/dashboard/agent-stats');
    return data.data;
  },

  /** 获取任务分布 */
  async getTaskDistribution(): Promise<TaskDistribution> {
    const { data } = await api.get('/api/dashboard/task-distribution');
    return data.data;
  },

  /** 获取修复统计 */
  async getRemediationStats(): Promise<RemediationStats> {
    const { data } = await api.get('/api/dashboard/remediation-stats');
    return data.data;
  },

  /** 获取服务器指标 */
  async getServerMetrics(): Promise<ServerMetrics> {
    const { data } = await api.get('/api/dashboard/server-metrics');
    return data.data;
  },

  /** 获取 SLA 统计 */
  async getSlaStats(): Promise<SlaStats> {
    const { data } = await api.get('/api/dashboard/sla-stats');
    return data.data;
  },

  /** 获取仪表盘联动数据 */
  async getDashboardLinkage(): Promise<unknown> {
    const { data } = await api.get('/api/dashboard/linkage');
    return data.data;
  },

  // ── 报告 ──

  /** 获取报告模板列表 */
  async listReportTemplates(): Promise<ReportTemplate[]> {
    const { data } = await api.get('/api/reports/templates');
    return data.data || [];
  },

  /** 获取报告列表 */
  async listReports(): Promise<ReportRecord[]> {
    const { data } = await api.get('/api/reports');
    return data.data || [];
  },

  /** 获取报告分析统计 */
  async getReportAnalytics(): Promise<ReportAnalytics> {
    const { data } = await api.get('/api/reports/analytics');
    return data.data;
  },

  /** 获取定时报告列表 */
  async listScheduledReports(): Promise<ScheduledReport[]> {
    const { data } = await api.get('/api/reports/scheduled/all');
    return data.data || [];
  },

  /** 创建报告模板 */
  async createReportTemplate(input: ReportTemplateInput): Promise<ReportTemplate> {
    const { data } = await api.post('/api/reports/templates', input);
    return data.data;
  },

  /** 生成报告 */
  async generateReport(input: GenerateReportInput): Promise<ReportRecord> {
    const { data } = await api.post('/api/reports/generate', input);
    return data.data;
  },

  /** 删除报告模板 */
  async deleteReportTemplate(id: string): Promise<void> {
    await api.delete(`/api/reports/templates/${id}`);
  },

  /** 导出报告（返回 Blob） */
  async exportReport(reportId: string, format: string): Promise<Blob> {
    const { data } = await api.get(`/api/reports/${reportId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return data;
  },

  // ── 成本分析 ──

  /** 获取容器成本 */
  async listContainerCosts(): Promise<ContainerCost[]> {
    const { data } = await api.get('/api/cost-analysis/containers');
    return data.data;
  },

  /** 获取虚拟机成本 */
  async listVmCosts(): Promise<VMCost[]> {
    const { data } = await api.get('/api/cost-analysis/vms');
    return data.data;
  },

  /** 获取成本优化建议 */
  async listCostRecommendations(): Promise<CostRecommendation[]> {
    const { data } = await api.get('/api/cost-analysis/recommendations');
    return data.data;
  },

  /** 获取成本汇总 */
  async getCostSummary(): Promise<CostSummary> {
    const { data } = await api.get('/api/cost-analysis/summary');
    return data.data;
  },
};

export default monitorApi;
