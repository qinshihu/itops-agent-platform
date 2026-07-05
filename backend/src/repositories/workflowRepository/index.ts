export type {
  WorkflowRecord,
  WorkflowCreateInput,
  WorkflowUpdateInput,
  TaskRecord,
  TaskCreateInput,
  TaskCreateWithStatusInput,
  TaskListFilters,
  TaskLogEntry,
  ScheduledTaskRecord,
  ScheduledTaskWithWorkflow,
  ScheduledTaskCreateInput,
  ScheduledTaskUpdateInput,
} from './types';

export { workflowsRepo } from './workflowsRepo';
export { tasksRepo } from './tasksRepo';
export { scheduledTasksRepo } from './scheduledTasksRepo';

import { workflowsRepo } from './workflowsRepo';
import { tasksRepo } from './tasksRepo';
import { scheduledTasksRepo } from './scheduledTasksRepo';

// ── 聚合导出（兼容 workflowRepository.* 调用风格）──

export const workflowRepository = {
  workflows: workflowsRepo,
  tasks: tasksRepo,
  scheduledTasks: scheduledTasksRepo,
};
