/**
 * infraRepository 类型定义
 *
 * 表结构：
 *   tool_links: id, name, url, description, category, icon, created_at, updated_at
 *   scripts: id, name, description, type, content, parameters(JSON string),
 *            category, version, created_at, updated_at
 *   notifications: id, type, title, content, recipient, status,
 *                  related_alert_id, related_task_id, created_at
 *   config_templates: id, name, description, type, content, variables(JSON),
 *                     target_type, tags(JSON), version, created_by, created_at, updated_at
 *   approval_requests: id, task_id, node_id, node_label, description, status,
 *                      requested_by, approved_by, approved_at, reject_reason,
 *                      timeout_at, timeout_action, created_at, updated_at
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApprovalRequest } from '../../types';

// ── tool_links 表类型 ──

export interface ToolLinkRecord {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolLinkCreateInput {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  category?: string | null;
}

export interface ToolLinkUpdateInput {
  name?: string;
  url?: string;
  description?: string | null;
  category?: string | null;
}

// ── scripts 表类型 ──

export interface ScriptRecordRaw {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  content: string;
  parameters?: string | null;
  category?: string | null;
  version: number;
  created_at: string;
  updated_at?: string | null;
}

export interface ScriptRecord extends Omit<ScriptRecordRaw, 'parameters'> {
  parameters: unknown[];
}

export interface ScriptCreateInput {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  content: string;
  parameters?: unknown;
  category?: string | null;
}

export interface ScriptUpdateInput {
  name: string;
  description?: string | null;
  type: string;
  content: string;
  parameters?: unknown;
  category?: string | null;
}

export interface ScriptListFilters {
  category?: string;
  search?: string;
}

// ── notifications 表类型 ──

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  recipient?: string | null;
  status: string;
  related_alert_id?: string | null;
  related_task_id?: string | null;
  created_at: string;
}

export interface NotificationCreateInput {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  recipient?: string | null;
  status: string;
  related_alert_id?: string | null;
  related_task_id?: string | null;
  created_at: string;
}

export interface NotificationListFilters {
  type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  typeStats: Array<{ type: string; status: string; count: number }>;
  pendingCount: number;
  todaySent: number;
}

// ── config_templates 表类型 ──

export interface ConfigTemplateRecord {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  service_name: string;
  content: string;
  template_content: string;
  variables?: string | null;
  os_type: string;
  target_type: string;
  target_path: string;
  tags?: string | null;
  version: number;
  backup_before_apply: number;
  restart_command: string;
  validation_command: string;
  is_system: number;
  usage_count: number;
  success_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ConfigTemplateCreateInput {
  id?: string;
  name: string;
  description?: string;
  type: string;
  content: string;
  variables?: unknown;
  target_type: string;
  tags?: unknown;
  created_by?: string;
}

export interface ConfigTemplateUpdateInput {
  name?: string;
  description?: string;
  type?: string;
  content?: string;
  variables?: unknown;
  target_type?: string;
  tags?: unknown;
}

export interface ConfigTemplateListFilters {
  type?: string;
  target_type?: string;
  search?: string;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

export interface ConfigTemplateApplyResult {
  taskId: string;
  targetIds: string[];
}

// ── config_templates 完整 schema 类型（v022 迁移）──

export interface ConfigTemplateFullCreateInput {
  id: string;
  name: string;
  description: string | null;
  category: string;
  service_name: string;
  template_content: string;
  variables: string | null;
  os_type: string;
  target_path: string | null;
  backup_before_apply: number;
  restart_command: string | null;
  validation_command: string | null;
  is_system: number;
  created_at: string;
  updated_at: string;
}

export interface ConfigTemplateFullUpdateInput {
  name?: string;
  description?: string | null;
  category?: string;
  service_name?: string;
  template_content?: string;
  variables?: string | null;
  os_type?: string;
  target_path?: string | null;
  backup_before_apply?: number;
  restart_command?: string | null;
  validation_command?: string | null;
  is_system?: number;
}

export interface ConfigTemplateFullListFilters {
  category?: string;
  service_name?: string;
  os_type?: string;
  is_system?: number;
  page?: number;
  limit?: number;
}

// ── config_template_history 表类型 ──

export interface ConfigTemplateHistoryRecord {
  id: string;
  template_id: string;
  server_id: string;
  applied_by: string | null;
  variables_snapshot: string | null;
  backup_path: string | null;
  status: string;
  result: string | null;
  error_message: string | null;
  applied_at: string;
}

export interface ConfigTemplateHistoryCreateInput {
  id: string;
  template_id: string;
  server_id: string;
  applied_by: string | null;
  variables_snapshot: string | null;
  status: string;
  applied_at: string;
}

export interface ConfigTemplateHistoryListFilters {
  template_id?: string;
  server_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// ── approval_requests 表类型 ──

export interface ApprovalListFilters {
  status?: string;
  limit?: number;
}

// ── reports 表类型 ──

export interface ReportRecord {
  id: string;
  name: string;
  type: string;
  content?: string | null;
  format?: string | null;
  template_id?: string | null;
  task_id?: string | null;
  variables?: string | null;
  metadata?: string | null;
  is_preset: number;
  created_at: string;
  updated_at: string;
}

export interface ReportCreateInput {
  id: string;
  name: string;
  type: string;
  content?: string | null;
  format?: string | null;
  task_id?: string | null;
  variables?: string | null;
  metadata?: string | null;
  is_preset?: number;
  created_at: string;
  updated_at?: string;
}

export interface ReportUpdateInput {
  name?: string;
  content?: string;
  variables?: string;
}

// ── report_schedules 表类型 ──

export interface ReportScheduleRecord {
  id: string;
  name: string;
  template_id: string;
  cron_expression: string;
  enabled: number;
  recipients: string;
  format: string;
  last_generated: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportScheduleCreateInput {
  id: string;
  name: string;
  template_id: string;
  cron_expression: string;
  enabled: number;
  recipients: string;
  format: string;
  created_at: string;
  updated_at: string;
}

export interface ReportScheduleUpdateInput {
  name?: string;
  template_id?: string;
  cron_expression?: string;
  enabled?: number;
  recipients?: string;
  format?: string;
}