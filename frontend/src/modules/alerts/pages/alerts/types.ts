export interface Alert {
  id: string;
  source: string;
  severity: string;
  title: string;
  content: string;
  status: string;
  metadata: Record<string, unknown>;
  related_task_id?: string | null;
  created_at: string;
}

export interface ProcessResult {
  alertId: string;
  matchedPolicies: Array<{ id: string; name: string; execution_mode: string }>;
  mappingTasks?: Array<{ taskId: string; mappingId: string; workflowId: string; workflowName: string }>;
  executionIds: string[];
  error: string | null;
}

export interface AutomationLog {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

export interface AnalysisItem {
  alert_id?: string;
  status?: string;
  [key: string]: unknown;
}

export const WS_URL = window.location.origin;
export const WS_RECONNECT_INTERVALS = [1000, 2000, 5000, 10000, 30000];