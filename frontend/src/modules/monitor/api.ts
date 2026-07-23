/**
 * monitor 模块 API 封装
 *
 * 仅封装 monitor 域的接口（/dashboard/*、/cost-analysis/*、/monitor/zabbix/*、
 *   /monitor/prometheus/*、/reports/*、/trends/*）。
 * 跨模块调用（如 /agents、/servers、/tasks、/alerts、/knowledge、/workflows）
 *   不在本文件，调用方应改用对应模块的 api（如 agentsApi、serversApi 等）。
 */

import api from '../../lib/api';

// ============================================================
// 类型定义
// ============================================================

// Dashboard / BigScreen
export interface DashboardStats {
  servers: { total: number; enabled: number };
  agents: { total: number; enabled: number };
  tasks: { total: number; running: number; completed: number; successRate: number };
  alerts: { active: number; critical: number; high: number };
}

export interface TaskSummary {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface AlertSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

export interface ServerSummary {
  id: string;
  name: string;
  enabled: number;
}

export interface DashboardFullResponse {
  stats: DashboardStats;
  recentTasks: TaskSummary[];
  recentAlerts: AlertSummary[];
  servers: ServerSummary[];
}

export interface TrendPoint {
  time_bucket: string;
  total: number;
}

export interface AgentStatEntry {
  id: string;
  name: string;
  avatar: string;
  enabled: number;
  total_executions: number;
  successRate?: number;
}

export interface AgentStatsResponse {
  agents: AgentStatEntry[];
  overall: {
    totalExecutions: number;
    totalSuccess: number;
    overallSuccessRate: number;
    todayExecutions: number;
  };
}

export interface TaskDistributionResponse {
  byStatus: Array<{ status: string; count: number }>;
  byWorkflow: Array<{ name: string; count: number }>;
}

export interface RemediationExecution {
  id: string;
  policy_name: string;
  status: string;
}

export interface RemediationStats {
  today: { total: number; success_rate: number; failed: number };
  waiting_approval: number;
  recent_executions: RemediationExecution[];
}

export interface ServerMetricRow {
  server_id: string;
  server_name: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  network_in_mbps: number | null;
  network_out_mbps: number | null;
  disk_usage: number | null;
}

export interface ServerHistoryPoint {
  server_id: string;
  value: number;
  timestamp: string;
}

export interface ServerMetricsData {
  has_real_data: boolean;
  available_servers: ServerMetricRow[];
  servers: ServerMetricRow[];
  cpu_history: ServerHistoryPoint[];
  memory_history: ServerHistoryPoint[];
  network_history: ServerHistoryPoint[];
  disk_history: ServerHistoryPoint[];
}

export interface SlaStats {
  mttr_minutes?: number;
  uptime_percentage?: number;
  avg_response_seconds?: number;
  alert_resolution_rate?: number;
}

// Cost Analysis
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

// Reports
export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  content: string;
  variables: string[];
  is_preset?: boolean;
}

export interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  format: string;
  content?: string;
  variables?: Record<string, string>;
  created_at: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  format: string;
  enabled: boolean;
  cron_expression: string;
  last_generated?: string;
  recipients?: string[];
}

export interface ReportAnalytics {
  total_reports: number;
  total_templates: number;
  by_type: Record<string, number>;
  by_format: Record<string, number>;
  recent_activity: Array<{ date: string; count: number }>;
}

// Trends（components/TrendCharts 使用）
export interface InspectionTrendPoint {
  date: string;
  total: number;
  passed: number;
  failed: number;
}

export interface TrendSummary {
  total_inspections: number;
  pass_rate: number;
  avg_duration_seconds: number;
}

// Prometheus
export interface PromAuthConfig {
  url: string;
  username?: string;
  password?: string;
  bearerToken?: string;
  timeoutMs?: string | number;
}

export interface PromResponse {
  status: 'success' | 'error';
  data?: { resultType: string; result: Array<Record<string, unknown>> };
  errorType?: string;
  error?: string;
}

// Zabbix
export interface ZabbixAuthConfig {
  url: string;
  username?: string;
  password?: string;
  apiToken?: string;
  authMode: 'password' | 'token';
  timeoutMs: number;
}

export interface ZabbixResponse<T = unknown> {
  result: T[];
  error?: string;
}

export interface ZabbixHost { hostid: string; host: string; name: string; status?: string; }
export interface ZabbixItem { itemid: string; hostid: string; name: string; key_: string; }
export interface ZabbixTrigger { triggerid: string; description: string; priority: string; value?: string; }
export interface ZabbixProblem { eventid: string; name: string; severity: string; acknowledged?: string; }
export interface ZabbixHistoryRow { itemid: string; value: string; clock: string; ns?: string; }

// ============================================================
// API 封装
// ============================================================

export const monitorApi = {
  // ---------- Dashboard / BigScreen ----------
  async getFullDashboard(): Promise<DashboardFullResponse> {
    const { data } = await api.get('/dashboard/full');
    return data;
  },

  async getAlertTrends(): Promise<TrendPoint[]> {
    const { data } = await api.get('/dashboard/alert-trends');
    return data;
  },

  async getTaskTrends(): Promise<TrendPoint[]> {
    const { data } = await api.get('/dashboard/task-trends');
    return data;
  },

  async getAgentStats(): Promise<AgentStatsResponse> {
    const { data } = await api.get('/dashboard/agent-stats');
    return data;
  },

  async getTaskDistribution(): Promise<TaskDistributionResponse> {
    const { data } = await api.get('/dashboard/task-distribution');
    return data;
  },

  async getRemediationStats(): Promise<RemediationStats> {
    const { data } = await api.get('/dashboard/remediation-stats');
    return data;
  },

  /**
   * 服务器资源监控数据
   * @param serverId 'auto' = 后端自动选本机；'__all__' 或 undefined = 全部聚合；具体 id = 单服务器
   */
  async getServerMetrics(serverId: 'auto' | '__all__' | string = '__all__'): Promise<ServerMetricsData> {
    let url = '/dashboard/server-metrics';
    if (serverId === 'auto') {
      url += '?autoSelectLocal=1';
    } else if (serverId !== '__all__') {
      url += `?serverId=${encodeURIComponent(serverId)}`;
    }
    const { data } = await api.get(url);
    return data;
  },

  async getSlaStats(): Promise<SlaStats> {
    const { data } = await api.get('/dashboard/sla-stats');
    return data;
  },

  // ---------- Cost Analysis ----------
  async getContainerCosts(): Promise<ContainerCost[]> {
    const { data } = await api.get('/cost-analysis/containers');
    return data || [];
  },

  async getVMCosts(): Promise<VMCost[]> {
    const { data } = await api.get('/cost-analysis/vms');
    return data || [];
  },

  async getCostRecommendations(): Promise<CostRecommendation[]> {
    const { data } = await api.get('/cost-analysis/recommendations');
    return data || [];
  },

  async getCostSummary(): Promise<CostSummary> {
    const { data } = await api.get('/cost-analysis/summary');
    return data || { containerMonthly: 0, vmMonthly: 0, totalMonthly: 0, idleWaste: 0 };
  },

  // ---------- Reports ----------
  async listReportTemplates(): Promise<ReportTemplate[]> {
    const { data } = await api.get('/reports/templates');
    return data || [];
  },

  async createReportTemplate(template: Omit<ReportTemplate, 'id' | 'is_preset'>): Promise<ReportTemplate> {
    const { data } = await api.post('/reports/templates', template);
    return data;
  },

  async deleteReportTemplate(id: string): Promise<void> {
    await api.delete(`/reports/templates/${id}`);
  },

  async listReports(): Promise<GeneratedReport[]> {
    const { data } = await api.get('/reports');
    return data || [];
  },

  async generateReport(params: {
    templateId: string;
    variables: Record<string, string>;
    format?: 'markdown' | 'pdf' | 'word';
  }): Promise<GeneratedReport> {
    const { data } = await api.post('/reports/generate', { ...params, format: params.format || 'markdown' });
    return data;
  },

  async exportReport(reportId: string, format: 'markdown' | 'pdf' | 'word' = 'markdown'): Promise<Blob> {
    const response = await api.get(`/reports/${reportId}/export?format=${format}`, { responseType: 'blob' });
    return response.data;
  },

  async getReportAnalytics(): Promise<ReportAnalytics> {
    const { data } = await api.get('/reports/analytics');
    return data;
  },

  async listScheduledReports(): Promise<ScheduledReport[]> {
    const { data } = await api.get('/reports/scheduled/all');
    return data || [];
  },

  // ---------- Trends（TrendCharts 组件使用）----------
  async getInspectionHistory(params: { days?: number } = {}): Promise<InspectionTrendPoint[]> {
    const { data } = await api.get('/trends/inspection-history', { params });
    return data || [];
  },

  async getTrendSummary(): Promise<TrendSummary> {
    const { data } = await api.get('/trends/summary');
    return data;
  },

  // ---------- Prometheus ----------
  async testPrometheus(auth: PromAuthConfig): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/monitor/prometheus/test', auth);
    return data;
  },

  async queryPrometheus(
    auth: PromAuthConfig,
    promql: string,
    range?: { start: string; end: string; step: string },
  ): Promise<PromResponse> {
    const endpoint = range ? '/monitor/prometheus/query-range' : '/monitor/prometheus/query';
    const body = range ? { ...auth, query: promql, ...range } : { ...auth, query: promql };
    const { data } = await api.post(endpoint, body);
    return data;
  },

  // ---------- Zabbix ----------
  async callZabbix<T = unknown>(
    endpoint: 'test' | 'hosts' | 'items' | 'triggers' | 'problems' | 'history',
    payload: Record<string, unknown>,
  ): Promise<T[]> {
    const { data } = await api.post(`/monitor/zabbix/${endpoint}`, payload);
    // axios 拦截器已解包 → data 本身就是 ZabbixResponse
    const body = data as ZabbixResponse<T>;
    if (!body) {
      throw new Error('Zabbix 请求失败：响应为空');
    }
    if (body.error) {
      throw new Error(body.error);
    }
    return body.result ?? [];
  },
};

export default monitorApi;