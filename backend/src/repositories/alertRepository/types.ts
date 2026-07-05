// ── alerts 表类型 ──

/** alerts 表查询过滤条件 */
export interface AlertFilters {
  status?: 'new' | 'acknowledged' | 'resolved';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  limit?: number;
}

/** alerts 表原始行（snake_case，metadata 为 JSON 字符串） */
export interface AlertRecord {
  id: string;
  title: string;
  content: string;
  severity: string;
  status: string;
  source: string;
  metadata?: string;
  related_task_id?: string | null;
  created_at: string;
  updated_at?: string;
}

/** alert_provider_configs 表原始行 */
export interface AlertProviderConfigRecord {
  id: string;
  provider_id: string;
  name: string;
  config: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

// ── alert_device_associations 表类型 ──

export interface AlertDeviceAssociationRecord {
  alert_id: string;
  device_type: 'server' | 'network_device';
  device_id: string;
  match_method: 'exact_hostname' | 'fuzzy_hostname' | 'ip_address' | 'title_keyword' | 'manual';
  confidence: number;
  created_at: string;
}

export interface AlertDeviceAssociationInput {
  alert_id: string;
  device_type: string;
  device_id: string;
  match_method: string;
  confidence: number;
}

// ── alert_correlation_groups / members 表类型 ──

export interface AlertCorrelationGroupRecord {
  id: string;
  title: string;
  status: 'open' | 'resolved' | 'closed';
  root_alert_id?: string | null;
  alert_count: number;
  device_ids?: string | null;
  severity?: string | null;
  auto_detected: number;
  root_cause?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertCorrelationGroupCreateInput {
  id: string;
  title: string;
  status: string;
  root_alert_id: string;
  alert_count: number;
  device_ids: string;
  severity: string;
  auto_detected: number;
  created_at: string;
  updated_at: string;
}

export interface AlertCorrelationGroupListFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AlertCorrelationMemberRecord {
  id: string;
  group_id: string;
  alert_id: string;
  is_root: number;
  created_at: string;
}

export interface AlertCorrelationMemberInput {
  id: string;
  group_id: string;
  alert_id: string;
  is_root: number;
}

// ── aars_response_logs 表类型 ──

export interface AarsResponseLogRecord {
  id: string;
  alert_id: string;
  device_id?: string | null;
  device_type?: string | null;
  access_method?: string | null;
  status: string;
  diagnosis_result?: string | null;
  root_cause?: string | null;
  remediation_plan?: string | null;
  verification_result?: string | null;
  execution_status?: string | null;
  approval_status?: string | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  updated_at: string;
}

export interface AarsResponseLogInput {
  id: string;
  alert_id: string;
  device_id?: string | null;
  device_type?: string | null;
  access_method?: string | null;
  status: string;
  diagnosis_result?: string | null;
  root_cause?: string | null;
  remediation_plan?: string | null;
  verification_result?: string | null;
  execution_status?: string | null;
  approval_status?: string | null;
  error_message?: string | null;
}

// ── alert_noise_reduction 表类型 ──

export interface AlertNoiseReductionRecord {
  id: string;
  alert_fingerprint: string;
  alert_source: string;
  alert_title: string;
  occurrence_count: number;
  first_occurrence: string;
  last_occurrence: string;
  is_suppressed: number;
  suppression_reason?: string | null;
  suppression_until?: string | null;
}

export interface AlertNoiseReductionCreateInput {
  id: string;
  alert_fingerprint: string;
  alert_source: string;
  alert_title: string;
  first_occurrence: string;
  last_occurrence: string;
}

// ── alert_workflow_mappings 表类型 ──

export interface AlertWorkflowMappingRecord {
  id: string;
  alert_source?: string | null;
  alert_severity?: string | null;
  alert_title_pattern?: string | null;
  workflow_id: string;
  enabled: number;
  created_at: string;
}

export interface AlertWorkflowMappingCreateInput {
  id: string;
  alert_source?: string | null;
  alert_severity?: string | null;
  alert_title_pattern?: string | null;
  workflow_id: string;
  enabled: number;
}

export interface AlertWorkflowMappingUpdateInput {
  alert_source?: string | null;
  alert_severity?: string | null;
  alert_title_pattern?: string | null;
  workflow_id?: string;
  enabled?: number;
}

// ── alert_webhook_logs 表类型 ──

export interface AlertWebhookLogInput {
  id: string;
  source: string;
  status: 'success' | 'error';
  alert_count: number;
  resolved_count: number;
  error_message?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  processing_time_ms?: number | null;
}

export interface AlertWebhookLogRecord {
  id: string;
  source: string;
  status: string;
  alert_count: number;
  resolved_count: number;
  error_message?: string | null;
  request_body?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  processing_time_ms?: number | null;
  created_at: string;
}

// ── alert_processing_records 表类型 ──

export interface AlertProcessingRecord {
  id: string;
  alert_id: string;
  status: string;
  strategy?: string | null;
  decision_reason?: string | null;
  execution_id?: string | null;
  task_id?: string | null;
  aars_log_id?: string | null;
  remediation_id?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

// ── alert_configs 表类型 ──

export interface AlertConfigRecord {
  id: string;
  name: string;
  level: string;
  enabled: number;
  channels: string;
  webhook_url?: string | null;
  email_recipients?: string | null;
  rate_limit_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface AlertConfigCreateInput {
  id: string;
  name: string;
  level: string;
  enabled: number;
  channels: string;
  rate_limit_minutes: number;
}

export interface AlertConfigUpdateInput {
  enabled: number;
  channels: string;
  webhook_url: string | null;
  email_recipients: string | null;
  rate_limit_minutes: number;
}

// ── alert_notifications 表类型 ──

export interface AlertNotificationRecord {
  id: string;
  config_id: string;
  level: string;
  title: string;
  message: string;
  metadata?: string | null;
  channels: string;
  status: string;
  triggered_at: string;
}

export interface AlertNotificationInsertInput {
  id: string;
  config_id: string;
  level: string;
  title: string;
  message: string;
  metadata: string | null;
  channels: string;
  status: string;
  triggered_at: string;
}
