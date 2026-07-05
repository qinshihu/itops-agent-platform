// backend/src/repositories/types/config-management.ts
// 来源: v022

/** 配置模板 — v022 config_templates */
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  service_name: string;
  content: string;
  template_content: string;
  variables: string;                 // JSON string
  os_type: string;
  target_type: string;
  target_path: string;
  tags: string;                      // JSON string
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

/** 配置模板历史 — v022 config_template_history */
export interface ConfigTemplateHistory {
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
