// backend/src/repositories/types/infra.ts
// 来源: v001 + v038 + v039

/** 脚本 — v001 scripts */
export interface Script {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  language: string;
  content: string;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

/** 报告 — v001 reports */
export interface Report {
  id: string;
  name: string;
  type: string;
  content: string | null;
  format: string;
  template_id: string | null;
  task_id: string | null;
  variables: string | null;
  metadata: string | null;
  is_preset: number;
  created_at: string;
  updated_at: string;
}

/** 报告调度 — v001 report_schedules */
export interface ReportSchedule {
  id: string;
  name: string;
  template_id: string;
  cron_expression: string;
  enabled: number;
  recipients: string | null;
  format: string;
  last_generated: string | null;
  created_at: string;
  updated_at: string;
}

/** 设置 — v001 settings */
export interface Setting {
  id: number;
  key: string;
  value: string | null;
  updated_at: string;
}

/** 审计日志 — v001 audit_logs */
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

/** 工具链接 — v038 tool_links + v039 ALTER (image_icon) */
export interface ToolLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: string;
  description: string | null;
  sort_order: number;
  is_external: number;
  image_icon: string | null;         // v039 ALTER
  created_at: string;
  updated_at: string;
}
