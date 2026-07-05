// frontend/src/types/workflow.ts
// 与后端 backend/src/repositories/types/workflow.ts 对应

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  nodes: string | null;
  edges: string | null;
  agent_configs: string | null;
  is_template: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  workflow_id: string | null;
  name: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  current_node_id: string | null;
  node_results: string | null;
  logs: string | null;
  context: string | null;
  metrics: string | null;
  execution_order: string | null;
  report_id: string | null;
  execution_variables: string | null;
  parallel_branches: string | null;
  loop_iterations: string | null;
  parent_task_id: string | null;
  execution_depth: number;
  created_at: string;
  updated_at: string;
}

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
  context: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  [key: string]: unknown;
}
