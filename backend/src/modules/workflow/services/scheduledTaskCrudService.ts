/**
 * ScheduledTask 路由层 CRUD 抽象（v3 报告 P1-5 迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 *
 * 区分：
 *   - scheduledTaskCrudService（本文件）：CRUD + 状态变更
 *   - schedulerService：调度器集成
 */
import { randomUUID } from 'crypto';
import { workflowRepository } from '../../../repositories';
import { schedulerService } from './schedulerService';
import { logger } from '../../../utils/logger';
import { getErrorMessage } from '../../../utils/errorHelpers';

export const scheduledTaskCrudService = {
  // ── 查询 ──

  listScheduledTasks() {
    return workflowRepository.scheduledTasks.list();
  },

  getScheduledTaskById(id: string) {
    return workflowRepository.scheduledTasks.getByIdWithWorkflow(id);
  },

  getScheduledTaskByIdSimple(id: string) {
    return workflowRepository.scheduledTasks.getById(id);
  },

  // ── 创建 ──

  createScheduledTask(input: {
    name: string;
    description?: string | null;
    workflow_id?: string | null;
    schedule?: string;
    cron_expression?: string;
    enabled?: number | boolean;
  }): { success: true; data: { id: string; name: string; description: string | null; workflow_id: string | null; schedule: string | undefined; enabled: number } } | { success: false; error: string } {
    const taskSchedule: string = input.schedule || input.cron_expression || '';
    if (input.workflow_id && !workflowRepository.workflows.existsById(input.workflow_id)) {
      return { success: false, error: 'Workflow not found' };
    }
    const id = randomUUID();
    const enabledNum = input.enabled ? 1 : 0;
    workflowRepository.scheduledTasks.create({
      id,
      name: input.name,
      description: input.description ?? null,
      workflow_id: input.workflow_id ?? null,
      schedule: taskSchedule,
      enabled: enabledNum,
    });
    // 立即调度（如果启用）
    if (enabledNum) {
      try {
        schedulerService.scheduleTask({
          id,
          name: input.name,
          description: input.description ?? undefined,
          workflow_id: input.workflow_id ?? '',
          schedule: taskSchedule,
          enabled: 1,
        });
      } catch (err) {
        logger.warn(`[scheduledTaskCrudService] Failed to register scheduler for new task ${id}: ${getErrorMessage(err)}`);
      }
    }
    return {
      success: true,
      data: {
        id,
        name: input.name,
        description: input.description ?? null,
        workflow_id: input.workflow_id ?? null,
        schedule: taskSchedule,
        enabled: enabledNum,
      },
    };
  },

  // ── 更新 ──

  updateScheduledTask(id: string, input: {
    name?: string;
    description?: string | null;
    workflow_id?: string | null;
    schedule?: string;
    cron_expression?: string;
    enabled?: number | boolean;
  }): { success: true } | { success: false; error: string } {
    const task = workflowRepository.scheduledTasks.getById(id);
    if (!task) return { success: false, error: 'Scheduled task not found' };
    if (input.workflow_id && !workflowRepository.workflows.existsById(input.workflow_id)) {
      return { success: false, error: 'Workflow not found' };
    }
    workflowRepository.scheduledTasks.update(id, {
      name: input.name,
      description: input.description !== undefined ? input.description : undefined,
      workflow_id: input.workflow_id !== undefined ? input.workflow_id : undefined,
      schedule: input.schedule || input.cron_expression,
      enabled: input.enabled !== undefined ? (input.enabled ? 1 : 0) : undefined,
    });
    // 同步调度器
    const updated = workflowRepository.scheduledTasks.getById(id);
    if (updated) {
      try {
        schedulerService.updateTask(updated as unknown as Parameters<typeof schedulerService.updateTask>[0]);
      } catch (err) {
        logger.warn(`[scheduledTaskCrudService] Failed to update scheduler for task ${id}: ${getErrorMessage(err)}`);
      }
    }
    return { success: true };
  },

  // ── 删除 ──

  deleteScheduledTask(id: string): { success: true } | { success: false; error: string } {
    const task = workflowRepository.scheduledTasks.getById(id);
    if (!task) return { success: false, error: 'Scheduled task not found' };
    try { schedulerService.deleteTask(id); } catch (err) {
      logger.warn(`[scheduledTaskCrudService] Failed to remove task from scheduler: ${getErrorMessage(err)}`);
    }
    workflowRepository.scheduledTasks.delete(id);
    return { success: true };
  },

  // ── 切换启用 / 手动执行 ──

  toggleScheduledTask(id: string): { success: true; enabled: boolean } | { success: false; error: string } {
    const task = workflowRepository.scheduledTasks.getById(id);
    if (!task) return { success: false, error: 'Scheduled task not found' };
    const newEnabled = !task.enabled ? 1 : 0;
    workflowRepository.scheduledTasks.setEnabled(id, newEnabled);
    const updated = workflowRepository.scheduledTasks.getById(id);
    if (updated) {
      try {
        schedulerService.updateTask(updated as unknown as Parameters<typeof schedulerService.updateTask>[0]);
      } catch (err) {
        logger.warn(`[scheduledTaskCrudService] Failed to update scheduler on toggle ${id}: ${getErrorMessage(err)}`);
      }
    }
    return { success: true, enabled: !!newEnabled };
  },

  runScheduledTaskManually(id: string): { success: true } | { success: false; error: string } {
    const task = workflowRepository.scheduledTasks.getByIdForManualRun(id);
    if (!task) return { success: false, error: 'Scheduled task not found' };
    try {
      schedulerService.executeWorkflow(task as unknown as Parameters<typeof schedulerService.executeWorkflow>[0]);
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
    return { success: true };
  },
};
