import type { ComponentType, SVGProps } from 'react';

export interface Task {
  id: string;
  name: string;
  status: string;
  created_at: string;
  workflow_id?: string;
  execution_order?: string;
  node_results?: string;
  current_node_id?: string;
}

export interface TaskWithProgress extends Task {
  progress: number;
  completedNodes: number;
  totalNodes: number;
  executingNode: string;
}

export interface Alert {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

export interface ServerType {
  id: string;
  name: string;
  hostname: string;
  enabled: number;
  last_connected?: string;
}

export interface DashboardStats {
  servers: { total: number; enabled: number };
  agents: { total: number; enabled: number };
  tasks: {
    total: number;
    running: number;
    completed: number;
    failed: number;
    pending: number;
    successRate: number;
  };
  alerts: {
    total: number;
    active: number;
    critical: number;
    high: number;
  };
  workflows: { total: number; templates: number };
  knowledge: { total: number };
}

export interface DataPoint {
  timestamp: number;
  value: number;
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

export interface AgentStat {
  id: string;
  name: string;
  avatar: string;
  role: string;
  enabled: number;
  usage_count: number;
  total_executions: number;
  success_count: number;
  error_count: number;
  successRate: number | null;
}

export interface SlaStats {
  mttr_minutes: number;
  uptime_percentage: number;
  avg_response_seconds: number;
  alert_resolution_rate: number;
  total_alerts_today: number;
  resolved_today: number;
}

export interface ServerMetricsData {
  servers: Array<{
    server_id: string;
    server_name: string;
    cpu_usage: number | null;
    memory_usage: number | null;
    disk_usage: number | null;
    network_in_mbps: number | null;
    network_out_mbps: number | null;
    load_1min: number | null;
    collected_at: string | null;
  }>;
  has_real_data: boolean;
  cpu_history: Array<{ server_id: string; value: number; timestamp: string }>;
  memory_history: Array<{ server_id: string; value: number; timestamp: string }>;
  network_history: Array<{ server_id: string; value: number; timestamp: string }>;
  disk_history: Array<{ server_id: string; value: number; timestamp: string }>;
  /** 可选：当前选中的服务器 ID（单服务器模式） */
  selected_server_id?: string;
  /** 可用服务器列表（用于下拉选择器） */
  available_servers?: Array<{
    id: string;
    name: string;
    hostname: string;
    is_local: boolean;
  }>;
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
  recent_executions: Array<{
    id: string;
    status: string;
    status_reason?: string;
    created_at: string;
    policy_name: string;
    execution_mode: string;
    alert_title?: string;
    alert_severity?: string;
  }>;
}

export interface StatCardProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
  subValue?: string;
  color: { bg: string; fg: string };
  onClick?: () => void;
}

export const SERVER_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];
export const SERVER_METRICS_RANDOM_VALUES = Array.from({ length: 6 }, () => 30 + Math.random() * 50);

export function generateFallbackChartData(points: number, baseValue: number, variance: number): DataPoint[] {
  const data: DataPoint[] = [];
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    data.push({
      timestamp: now - i * 60000,
      value: baseValue + (Math.random() - 0.5) * variance,
    });
  }
  return data;
}