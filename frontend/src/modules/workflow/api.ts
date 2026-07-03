/**
 * Workflow 模块 API 服务层
 * 封装工作流、任务、定时任务、工作流提供者、报告相关端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

// ── 工作流 ──

export interface WorkflowNode {
  id: string;
  type?: string;
  label?: string;
  [key: string]: unknown;
}

export interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_template: number;
  created_at: string;
  updated_at?: string;
}

export interface WorkflowInput {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_template?: number;
}

// ── 任务 ──

export interface Task {
  id: string;
  name: string;
  workflow_id: string;
  status: string;
  start_time: string;
  end_time: string;
  current_node_id: string;
  node_results: unknown;
  logs: unknown[];
  created_at: string;
  execution_order?: string[];
  report_id?: string;
}

export interface CreateTaskInput {
  workflow_id: string;
  name: string;
  input?: string;
  context?: Record<string, unknown>;
}

// ── 定时任务 ──

export interface ScheduledTask {
  id: string;
  name: string;
  description: string | null;
  workflow_id: string | null;
  cron_expression: string;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  workflow_name: string;
}

export interface ScheduledTaskInput {
  name: string;
  description?: string;
  workflow_id?: string;
  cron_expression: string;
  enabled?: boolean;
}

// ── 工作流提供者 ──

export interface WorkflowProvider {
  id: string;
  name: string;
  type: string;
  configSchema: unknown;
}

// ── 报告 ──

export interface Report {
  id: string;
  [key: string]: unknown;
}

// ============================================================
// workflowApi 对象
// ============================================================

export const workflowApi = {
  // ── 工作流 ──

  /** 获取工作流列表 */
  async listWorkflows(): Promise<Workflow[]> {
    const { data } = await api.get('/api/workflows');
    return data.data;
  },

  /** 获取工作流详情 */
  async getWorkflow(id: string): Promise<Workflow> {
    const { data } = await api.get(`/api/workflows/${id}`);
    return data.data;
  },

  /** 创建工作流 */
  async createWorkflow(input: WorkflowInput): Promise<Workflow> {
    const { data } = await api.post('/api/workflows', input);
    return data.data;
  },

  /** 更新工作流 */
  async updateWorkflow(id: string, input: WorkflowInput): Promise<Workflow> {
    const { data } = await api.put(`/api/workflows/${id}`, input);
    return data.data;
  },

  /** 删除工作流 */
  async deleteWorkflow(id: string): Promise<void> {
    await api.delete(`/api/workflows/${id}`);
  },

  // ── 任务 ──

  /** 获取任务列表 */
  async listTasks(): Promise<Task[]> {
    const { data } = await api.get('/api/tasks');
    return data.data;
  },

  /** 创建任务（执行工作流） */
  async createTask(input: CreateTaskInput): Promise<Task> {
    const { data } = await api.post('/api/tasks', input);
    return data.data;
  },

  /** 暂停任务 */
  async pauseTask(taskId: string): Promise<void> {
    await api.put(`/api/tasks/${taskId}/pause`);
  },

  /** 恢复任务 */
  async resumeTask(taskId: string): Promise<void> {
    await api.put(`/api/tasks/${taskId}/resume`);
  },

  /** 取消任务 */
  async cancelTask(taskId: string): Promise<void> {
    await api.put(`/api/tasks/${taskId}/cancel`);
  },

  // ── 定时任务 ──

  /** 获取定时任务列表 */
  async listScheduledTasks(): Promise<ScheduledTask[]> {
    const { data } = await api.get('/api/scheduled-tasks');
    return data.data;
  },

  /** 创建定时任务 */
  async createScheduledTask(input: ScheduledTaskInput): Promise<ScheduledTask> {
    const { data } = await api.post('/api/scheduled-tasks', input);
    return data.data;
  },

  /** 更新定时任务 */
  async updateScheduledTask(id: string, input: ScheduledTaskInput): Promise<ScheduledTask> {
    const { data } = await api.put(`/api/scheduled-tasks/${id}`, input);
    return data.data;
  },

  /** 删除定时任务 */
  async deleteScheduledTask(id: string): Promise<void> {
    await api.delete(`/api/scheduled-tasks/${id}`);
  },

  /** 切换定时任务启用状态 */
  async toggleScheduledTask(id: string): Promise<void> {
    await api.post(`/api/scheduled-tasks/${id}/toggle`);
  },

  // ── 工作流提供者 ──

  /** 获取工作流提供者列表 */
  async listProviders(params?: { type?: string }): Promise<WorkflowProvider[]> {
    const { data } = await api.get('/api/workflows/providers/list', { params });
    return data.data;
  },

  // ── 报告 ──

  /** 获取报告列表 */
  async listReports(): Promise<Report[]> {
    const { data } = await api.get('/api/reports');
    return data.data;
  },

  /** 导出报告（返回 Blob） */
  async exportReport(reportId: string, format: string): Promise<Blob> {
    const { data } = await api.get(`/api/reports/${reportId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return data;
  },
};

export default workflowApi;
