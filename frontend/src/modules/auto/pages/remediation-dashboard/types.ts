import type { ReactNode } from 'react';

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

export interface ExecutionTrendItem {
  time_bucket: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
}

export interface StatusBadgeItem {
  text: string;
  className: string;
  icon: ReactNode;
}

export type StatusBadgeMap = Record<string, StatusBadgeItem>;
