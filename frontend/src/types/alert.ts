// frontend/src/types/alert.ts
// 与后端 backend/src/repositories/types/alert.ts 对应

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

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: string;
  enabled: number;
  cooldown_minutes: number;
  auto_resolve: number;
  notification_channels: string;
  created_at: string;
}

export interface AlertCorrelation {
  group_id: string;
  alert_ids: string[];
  root_cause: string;
  similarity: number;
}
