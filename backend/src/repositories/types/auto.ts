// backend/src/repositories/types/auto.ts
// 来源: v001 + v048

/** 修复策略 — v001 remediation_policies */
export interface RemediationPolicy {
  id: string;
  name: string;
  description: string | null;
  alert_source: string;
  alert_severity: string | null;
  alert_keywords: string | null;
  alert_tags: string | null;
  execution_mode: string;
  workflow_id: string | null;
  workflow_params: string | null;    // JSON string
  max_executions_per_hour: number;
  cooldown_seconds: number;
  require_confirmation: string | null;
  enable_verification: number;
  verification_workflow_id: string | null;
  verification_params: string | null;
  verification_timeout_seconds: number;
  enable_rollback: number;
  rollback_workflow_id: string | null;
  rollback_on_failure: number;
  enabled: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 修复执行 — v001 remediation_executions */
export interface RemediationExecution {
  id: string;
  policy_id: string;
  alert_id: string;
  alert_snapshot: string | null;
  status: string;
  status_reason: string | null;
  approval_required: number;
  approved_by: string | null;
  approved_at: string | null;
  approval_comment: string | null;
  workflow_execution_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  execution_result: string | null;
  verification_status: string | null;
  verification_result: string | null;
  verification_completed_at: string | null;
  rollback_triggered: number;
  rollback_execution_id: string | null;
  rollback_completed_at: string | null;
  rollback_result: string | null;
  execution_duration_ms: number | null;
  created_at: string;
}

/** 修复历史 — v001 remediation_history */
export interface RemediationHistory {
  id: string;
  policy_id: string;
  alert_source: string | null;
  alert_severity: string | null;
  execution_status: string | null;
  root_cause: string | null;
  resolution: string | null;
  duration_ms: number | null;
  created_at: string;
}

/** 修复审计 — v001 remediation_audits */
export interface RemediationAudit {
  id: string;
  rca_id: string;
  policy_id: string | null;
  server_id: string;
  risk_level: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  execution_log: string | null;
  result: string | null;
  is_rollback: number;
  created_at: string;
  completed_at: string | null;
}

/** 修复冷却 — v001 remediation_cooldowns */
export interface RemediationCooldown {
  policy_id: string;
  alert_id: string;
  cooldown_until: string;
  created_at: string;
}

/** 自动伸缩规则 — v048 auto_scale_rules */
export interface AutoScaleRule {
  id: string;
  name: string;
  target_type: string;
  target_id: string;
  target_name: string | null;
  metric_type: string;
  threshold: number;
  target_value: number;
  min_instances: number;
  max_instances: number;
  scale_up_cooldown: number;
  scale_down_cooldown: number;
  enabled: number;
  last_scale_time: string | null;
  created_at: string;
  updated_at: string;
}

/** 自动伸缩历史 — v048 auto_scale_history */
export interface AutoScaleHistory {
  id: string;
  rule_id: string | null;
  rule_name: string | null;
  target_type: string | null;
  target_id: string | null;
  action: string | null;
  previous_count: number | null;
  current_count: number | null;
  metric_value: number | null;
  result: string | null;
  reason: string | null;
  timestamp: string;
}
