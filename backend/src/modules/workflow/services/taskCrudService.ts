/**
 * Task 路由层 CRUD 抽象（v3 报告 P1-5 迁移）
 *
 * 解决问题：路由层（modules/<m>/routes/）直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中处理"参数校验 + 状态转换 + 错误码"，
 * routes 只负责"取 req → 调 service → 设 res"三件套。
 *
 * 区分：
 *   - taskCrudService（本文件）：CRUD + 状态变更 + 干预日志
 *   - workflowExecutor / WorkflowEngine：执行引擎
 *   - queueService / schedulerService：调度
 */
import { randomUUID } from 'crypto';
import { workflowRepository } from '../../../repositories';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['running', 'cancelled'],
  running: ['paused', 'cancelled', 'failed', 'completed'],
  paused: ['running', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export const taskCrudService = {
  // ── 查询 ──

  /**
   * 列表查询
   */
  listTasks(filters: { status?: string; hostId?: string; limit?: number } = {}) {
    return workflowRepository.tasks.list(filters);
  },

  /**
   * 按 ID 获取任务
   */
  getTaskById(id: string) {
    return workflowRepository.tasks.getById(id);
  },

  // ── 创建 ──

  /**
   * 创建任务（pending 状态）；返回 { success, data | error, taskId }
   */
  createTask(input: { workflow_id: string; name: string; context?: unknown }): { success: true; taskId: string } | { success: false; error: string } {
    // 校验 workflow 是否存在
    if (!workflowRepository.workflows.getById(input.workflow_id)) {
      return { success: false, error: 'Workflow not found' };
    }
    const id = randomUUID();
    workflowRepository.tasks.create({
      id,
      workflow_id: input.workflow_id,
      name: input.name,
      context: typeof input.context === 'string' ? input.context : input.context ? JSON.stringify(input.context) : null,
    });
    return { success: true, taskId: id };
  },

  // ── 状态变更 ──

  /**
   * 暂停任务（running/pending → paused）
   */
  pauseTask(id: string): { success: true } | { success: false; error: 'not_found' | 'invalid_status' | string } {
    const task = workflowRepository.tasks.getById(id);
    if (!task) return { success: false, error: 'not_found' };
    if (!VALID_TRANSITIONS[task.status]?.includes('paused')) {
      return { success: false, error: 'invalid_status' };
    }
    workflowRepository.tasks.updateStatus(id, 'paused');
    return { success: true };
  },

  /**
   * 恢复任务（paused → running）
   */
  resumeTask(id: string): { success: true } | { success: false; error: 'not_found' | 'invalid_status' | string } {
    const task = workflowRepository.tasks.getById(id);
    if (!task) return { success: false, error: 'not_found' };
    if (!VALID_TRANSITIONS[task.status]?.includes('running')) {
      return { success: false, error: 'invalid_status' };
    }
    workflowRepository.tasks.updateStatus(id, 'running');
    return { success: true };
  },

  /**
   * 取消任务（任何 active 状态 → cancelled）
   */
  cancelTask(id: string): { success: true } | { success: false; error: 'not_found' | 'invalid_status' | string } {
    const task = workflowRepository.tasks.getById(id);
    if (!task) return { success: false, error: 'not_found' };
    if (!VALID_TRANSITIONS[task.status]?.includes('cancelled')) {
      return { success: false, error: 'invalid_status' };
    }
    workflowRepository.tasks.updateStatusWithEndTime(id, 'cancelled');
    return { success: true };
  },

  // ── 干预 ──

  /**
   * 追加干预跳过日志
   */
  appendInterventionSkip(id: string, nodeId: string): void {
    workflowRepository.tasks.appendInterventionSkipLog(id, nodeId);
  },

  /**
   * 追加干预修改日志
   */
  appendInterventionModify(id: string, nodeId: string, data: unknown): void {
    workflowRepository.tasks.appendInterventionModifyLog(id, nodeId, JSON.stringify(data));
  },
};
