// backend/src/repositories/types/alert.ts
// 来源: v001 + v009 + v014 + v018 + v040 + v043 + v053 + v054

/** 告警 — v001 alerts + v009 ALTER (alert_fingerprint UNIQUE) */
export interface Alert {
  id: string;
  source: string;
  severity: string;
  title: string;
  content: string | null;
  metadata: string | null;
  related_task_id: string | null;
  status: string;
  alert_fingerprint: string | null;
  created_at: string;
  updated_at: string;
}

/** 告警 Webhook 日志 — v001 alert_webhook_logs */
export interface AlertWebhookLog {
  id: string;
  source: string;
  status: string;
  alert_count: number;
  resolved_count: number;
  error_message: string | null;
  request_body: string | null;
  ip_address: string | null;
  user_agent: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

/** 告警降噪 — v001 alert_noise_reduction */
export interface AlertNoiseReduction {
  id: string;
  alert_fingerprint: string;
  alert_source: string;
  alert_title: string;
  occurrence_count: number;
  first_occurrence: string;
  last_occurrence: string;
  is_suppressed: number;
  suppression_reason: string | null;
  suppression_until: string | null;
}

/** 告警-工作流映射 — v001 alert_workflow_mappings */
export interface AlertWorkflowMapping {
  id: string;
  alert_source: string | null;
  alert_severity: string | null;
  alert_title_pattern: string | null;
  workflow_id: string;
  enabled: number;
  created_at: string;
}

/** 告警配置 — v001 alert_configs */
export interface AlertConfig {
  id: string;
  name: string;
  level: string;
  enabled: number;
  channels: string;                  // JSON string
  webhook_url: string | null;
  email_recipients: string | null;
  rate_limit_minutes: number;
  created_at: string;
  updated_at: string;
}

/** 告警通知记录 — v001 alert_notifications */
export interface AlertNotification {
  id: string;
  config_id: string;
  level: string;
  title: string;
  message: string | null;
  metadata: string | null;
  channels: string;                  // JSON string
  status: string;
  triggered_at: string;
}

/** 告警-设备关联 — v009 alert_device_associations */
export interface AlertDeviceAssociation {
  alert_id: string;
  device_type: string;
  device_id: string;
  match_method: string;
  confidence: number;
  created_at: string;
}

/** 设备匹配日志 — v009 alert_device_match_log */
export interface AlertDeviceMatchLog {
  id: string;
  alert_title: string | null;
  alert_hostname: string | null;
  match_method: string;
  matched: number;
  created_at: string;
}

/** 告警关联组 — v014 alert_correlation_groups */
export interface AlertCorrelationGroup {
  id: string;
  title: string;
  description: string | null;
  status: string;
  root_alert_id: string | null;
  root_cause: string | null;
  alert_count: number;
  device_ids: string;
  severity: string;
  auto_detected: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

/** 告警关联组成员 — v014 alert_correlation_members */
export interface AlertCorrelationMember {
  id: string;
  group_id: string;
  alert_id: string;
  is_root: number;
  created_at: string;
}

/** 自动响应日志 — v018 aars_response_logs */
export interface AarsResponseLog {
  id: string;
  alert_id: string;
  device_id: string | null;
  device_type: string | null;
  access_method: string | null;
  status: string;
  probes_used: string | null;        // JSON string
  diagnosis_result: string | null;
  root_cause: string | null;
  remediation_plan: string | null;
  verification_result: string | null;
  execution_status: string | null;
  approval_status: string;
  notification_sent: number;
  error_message: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** 自动响应配置 — v018 aars_config */
export interface AarsConfig {
  id: number;
  enabled: number;
  min_severity: string;
  auto_execute_enabled: number;
  approval_timeout_minutes: number;
  max_concurrent: number;
  ssh_timeout_sec: number;
  verify_interval_sec: number;
  notification_channels: string;     // JSON string
  auto_execute_whitelist: string;    // JSON string
  business_hours: string;            // JSON string
  created_at: string;
  updated_at: string;
}

/** 自动化信任度 — v018 automata_trust */
export interface AutomataTrust {
  operation_key: string;
  approval_count: number;
  rejection_count: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  last_updated: string | null;
}

/** 探针执行统计 — v018 probe_execution_stats */
export interface ProbeExecutionStats {
  probe_id: string;
  total_uses: number;
  successful_diagnoses: number;
  total_duration_ms: number;
  last_used_at: string | null;
  device_id: string | null;
  alert_type: string | null;
}

/** 告警 Provider 配置 — v040 alert_provider_configs */
export interface AlertProviderConfig {
  id: string;
  provider_id: string;
  name: string;
  config: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

/** 告警处理记录 — v043 alert_processing_records */
export interface AlertProcessingRecord {
  id: string;
  alert_id: string;
  strategy: string;
  decision_reason: string | null;
  execution_id: string | null;
  task_id: string | null;
  aars_log_id: string | null;
  remediation_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/** 升级历史 — v053 escalation_history */
export interface EscalationHistory {
  id: string;
  alert_id: string;
  stage: string;
  entered_at: string;
  reason: string | null;
  notified: number;
  resolved_at: string | null;
}

/** 告警自动分析 — v054 alert_auto_analysis */
export interface AlertAutoAnalysis {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: string;
  status: string;
  diagnosis: string | null;
  summary: string | null;
  raw_output: string | null;
  commands_executed: string | null;  // JSON string
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}
