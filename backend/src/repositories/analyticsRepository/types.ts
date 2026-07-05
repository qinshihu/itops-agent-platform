/**
 * analyticsRepository — 共享类型定义
 */

/** 分析查询返回的动态行类型（SQL 动态列） */
export type AnalyticsRow = Record<string, unknown>;

export interface InspectionCenterCounts {
  total: number;
  inspections: number;
  analyses: number;
  success: number;
  failed: number;
}

export interface InspectionCenterResult {
  results: Array<AnalyticsRow>;
  counts: InspectionCenterCounts;
}

export interface DeviceOverview {
  device: {
    id: string;
    name: string;
    ip: string;
    type: string;
    vendor: string | null;
    username: string | null;
    ssh_port: number;
    snmp_enabled: boolean;
    snmp_credential_id: string | null;
  };
  alert_count: number;
  open_alert_count: number;
  alerts: Array<AnalyticsRow>;
  inspection_count: number;
  inspections: Array<AnalyticsRow>;
  analysis_count: number;
  analyses: Array<AnalyticsRow>;
  execution_count: number;
  executions: Array<AnalyticsRow>;
}

export interface DashboardLinkageStats {
  alerts: { total: number; open: number };
  analyses: { total: number };
  inspections: { total: number };
  remediations: { total: number };
  devices: { network_devices: number; servers: number };
}

export interface InspectionHistoryTrend {
  days: number;
  daily_inspections: Array<AnalyticsRow>;
  alert_trends: Array<AnalyticsRow>;
  remediation_trends: Array<AnalyticsRow>;
}

export interface DeviceTrend {
  device_id: string;
  days: number;
  metric: string;
  points: Array<AnalyticsRow>;
}

export interface TrendSummary {
  days: number;
  inspection_count: number;
  inspection_success_rate: number;
  inspection_failed: number;
  alert_count: number;
  alert_critical_count: number;
  avg_alerts_per_day: number;
}

// ── Dashboard 统计类型 ──

export interface DashboardStats {
  servers: { total: number; enabled: number };
  agents: { total: number; enabled: number };
  tasks: { total: number; running: number; completed: number; failed: number; pending: number; successRate: number };
  alerts: { total: number; active: number; critical: number; high: number };
  workflows: { total: number; templates: number };
  knowledge: { total: number };
}

export interface AlertTrendPoint {
  time_bucket: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TaskTrendPoint {
  time_bucket: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
}

export interface AgentStatItem {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string | null;
  enabled: number;
  usage_count?: number | null;
  total_executions: number;
  success_count: number;
  error_count: number;
  successRate: number | null;
}

export interface AgentStatsResult {
  agents: AgentStatItem[];
  overall: {
    totalExecutions: number;
    totalSuccess: number;
    overallSuccessRate: number;
    todayExecutions: number;
  };
}

export interface TaskDistribution {
  byStatus: Array<{ status: string; count: number }>;
  byWorkflow: Array<{ name: string; count: number }>;
}

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
  recent_executions: Array<AnalyticsRow>;
}

export interface SlaStats {
  mttr_minutes: number;
  uptime_percentage: number;
  avg_response_seconds: number;
  alert_resolution_rate: number;
  total_alerts_today: number;
  resolved_today: number;
}

export interface ServerMetricLatest {
  server_id: string;
  server_name: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  network_in_mbps: number | null;
  network_out_mbps: number | null;
  load_1min: number | null;
  collected_at: string | null;
}

export interface ServerMetricsDashboard {
  servers: ServerMetricLatest[];
  has_real_data: boolean;
  cpu_history: Array<{ server_id: string; value: number; timestamp: string }>;
  memory_history: Array<{ server_id: string; value: number; timestamp: string }>;
  network_history: Array<{ server_id: string; value: number; timestamp: string }>;
  disk_history: Array<{ server_id: string; value: number; timestamp: string }>;
}

export interface FullDashboard {
  stats: DashboardStats;
  recentTasks: Array<AnalyticsRow>;
  recentAlerts: Array<AnalyticsRow>;
  servers: Array<AnalyticsRow>;
}

export interface AlertSourceStats {
  source_stats: Array<AnalyticsRow>;
  webhook_logs_24h: Array<AnalyticsRow>;
  last_24h: Array<AnalyticsRow>;
  total: number;
  active: number;
}

export interface ReportAnalytics {
  alertTrends: Array<AnalyticsRow>;
  analysisStats: { total: number; completed: number; failed: number };
  remediationStats: { total: number; success_count: number; failed_count: number; rolled_back: number };
  topDiagnoses: Array<AnalyticsRow>;
}
