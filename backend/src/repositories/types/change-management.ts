// backend/src/repositories/types/change-management.ts
// 来源: v001 (change_records) + v017 (approval_requests)

/** 变更记录 — v001 change_records */
export interface ChangeRecord {
  id: string;
  server_id: string;
  change_type: string;
  description: string | null;
  changed_by: string | null;
  status: string;
  related_alert_id: string | null;
  is_root_cause: number;
  metadata: string | null;
  created_at: string;
}

/** 审批请求 — v017 approval_requests */
export interface ApprovalRequest {
  id: string;
  task_id: string;
  node_id: string;
  node_label: string;
  description: string | null;
  status: string;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  timeout_at: string | null;
  timeout_action: string;
  created_at: string;
  updated_at: string;
}
