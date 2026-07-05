// backend/src/repositories/types/workflow.ts
// 来源: v001 + v019

/** 工作流 — v001 workflows */
export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  nodes: string | null;              // JSON string
  edges: string | null;              // JSON string
  agent_configs: string | null;      // JSON string
  is_template: number;
  created_at: string;
  updated_at: string;
}

/** 任务 — v001 tasks + v019 ALTER (5 个新列) */
export interface Task {
  id: string;
  workflow_id: string | null;
  name: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  current_node_id: string | null;
  node_results: string | null;       // JSON string
  logs: string | null;
  context: string | null;            // JSON string
  metrics: string | null;            // JSON string
  execution_order: string | null;    // JSON string
  report_id: string | null;
  execution_variables: string | null;  // v019 ALTER (JSON)
  parallel_branches: string | null;    // v019 ALTER (JSON)
  loop_iterations: string | null;      // v019 ALTER (JSON)
  parent_task_id: string | null;       // v019 ALTER
  execution_depth: number;             // v019 ALTER
  created_at: string;
  updated_at: string;
}

/** 定时任务 — v001 scheduled_tasks */
export interface ScheduledTask {
  id: string;
  name: string;
  description: string | null;
  workflow_id: string;
  schedule: string;
  enabled: number;
  last_run: string | null;
  next_run: string | null;
  last_status: string;
  context: string | null;            // JSON string
  created_at: string;
  updated_at: string;
}

/** 工作流执行日志 — v019 workflow_execution_logs */
export interface WorkflowExecutionLog {
  id: string;
  task_id: string;
  node_id: string;
  node_type: string;
  iteration_index: number | null;
  iteration_total: number | null;
  branch_id: string | null;
  branch_total: number | null;
  input_variables: string | null;    // JSON string
  output_variables: string | null;   // JSON string
  status: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  metadata: string | null;
}

/** 工作流变量传递 — v019 workflow_variable_transfers */
export interface WorkflowVariableTransfer {
  id: string;
  task_id: string;
  source_node_id: string | null;
  target_node_id: string | null;
  variable_name: string;
  variable_value: string | null;
  transfer_type: string;
  created_at: string;
}
