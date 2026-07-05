// ── workflows 表类型 ──

export interface WorkflowRecord {
  id: string;
  name: string;
  description?: string | null;
  nodes?: string | null;
  edges?: string | null;
  agent_configs?: string | null;
  is_template: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowCreateInput {
  id: string;
  name: string;
  description?: string | null;
  nodes?: string | null;
  edges?: string | null;
  agent_configs?: string | null;
  is_template?: number;
}

export interface WorkflowUpdateInput {
  name: string;
  description?: string | null;
  nodes?: string | null;
  edges?: string | null;
  agent_configs?: string | null;
  is_template: number;
}

// ── tasks 表类型 ──

export interface TaskRecord {
  id: string;
  workflow_id: string;
  name: string;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  current_node_id?: string | null;
  node_results?: string | null;
  logs?: string | null;
  context?: string | null;
  metrics?: string | null;
  execution_order?: number | null;
  report_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  execution_variables?: string | null;
  parallel_branches?: string | null;
  loop_iterations?: string | null;
  parent_task_id?: string | null;
  execution_depth?: number;
}

export interface TaskCreateInput {
  id: string;
  workflow_id: string;
  name: string;
  context?: string | null;
}

export interface TaskCreateWithStatusInput {
  id: string;
  workflow_id: string;
  name: string;
  status: string;
  context?: string | null;
}

export interface TaskListFilters {
  status?: string;
  limit?: number;
}

/** 任务日志条目（appendTaskLog 用） */
export interface TaskLogEntry {
  type: string;
  content: string;
  nodeId?: string | null;
}

// ── scheduled_tasks 表类型 ──

export interface ScheduledTaskRecord {
  id: string;
  name: string;
  description?: string | null;
  workflow_id: string;
  schedule: string;
  enabled: number;
  last_run?: string | null;
  next_run?: string | null;
  last_status: string;
  context?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/** 含 workflow_name 的联表记录 */
export interface ScheduledTaskWithWorkflow extends ScheduledTaskRecord {
  cron_expression: string;
  last_run_at: string | null;
  next_run_at: string | null;
  workflow_name?: string | null;
}

export interface ScheduledTaskCreateInput {
  id: string;
  name: string;
  description?: string | null;
  workflow_id?: string | null;
  schedule: string;
  enabled: number;
}

export interface ScheduledTaskUpdateInput {
  name?: string;
  description?: string | null;
  workflow_id?: string | null;
  schedule?: string;
  enabled?: number;
}
