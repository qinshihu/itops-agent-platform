/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { executeWorkflow } from '../services/workflowExecutor';
import { taskCrudService } from '../services/taskCrudService';
import { workflowCrudService } from '../services/workflowCrudService';
import type { WorkflowParsed } from '../../../types';
import { validateBody, validateParams } from '../../../middleware/validation';
import { taskSchemas, taskExtendedSchemas } from '../../../shared/schemas/apiValidation';

const router = Router();

/**
 * 解析 JSON 字段（node_results/logs/metrics/context/execution_order）
 * 内部辅助函数，避免每个 handler 重复 5 行 JSON.parse
 */
function parseTaskJsonFields<T extends Record<string, any>>(task: T): T {
  for (const field of ['node_results', 'logs', 'metrics', 'context', 'execution_order']) {
    if (typeof task[field] === 'string') {
      try { (task as Record<string, unknown>)[field] = JSON.parse(task[field] as string); } catch { /* ignore */ }
    }
  }
  return task;
}

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;
    const tasks = taskCrudService.listTasks({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, data: tasks.map(parseTaskJsonFields) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const task = taskCrudService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: parseTaskJsonFields(task) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch task' });
  }
});

router.post('/', validateBody(taskSchemas.createTask), async (req: Request, res: Response) => {
  try {
    const { workflow_id, name, input, context } = req.body;

    const workflow = workflowCrudService.getWorkflowById(workflow_id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const result = taskCrudService.createTask({
      workflow_id,
      name: name || 'Task',
      context: context || {},
    });
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }
    const taskId = result.taskId;

    const parsedWorkflow: WorkflowParsed = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description ?? undefined,
      nodes: workflow.nodes as WorkflowParsed['nodes'],
      edges: workflow.edges as WorkflowParsed['edges'],
      agent_configs: (workflow.agent_configs as Record<string, unknown>) ?? {},
      is_template: workflow.is_template ?? 0,
      created_at: workflow.created_at ?? '',
      updated_at: workflow.updated_at ?? '',
    };

    executeWorkflow(taskId, parsedWorkflow, input, context);

    res.status(201).json({ success: true, data: { taskId, status: 'started' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to start task' });
  }
});

router.put('/:id/pause', validateParams(taskSchemas.taskId), (req: Request, res: Response) => {
  try {
    const result = taskCrudService.pauseTask(req.params.id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 409;
      const msg = result.error === 'not_found'
        ? 'Task not found'
        : `Cannot pause task in current status`;
      return res.status(status).json({ success: false, error: msg });
    }
    res.json({ success: true, message: 'Task paused' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to pause task' });
  }
});

router.put('/:id/resume', (req: Request, res: Response) => {
  try {
    const result = taskCrudService.resumeTask(req.params.id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 409;
      const msg = result.error === 'not_found'
        ? 'Task not found'
        : `Cannot resume task in current status`;
      return res.status(status).json({ success: false, error: msg });
    }
    res.json({ success: true, message: 'Task resumed' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to resume task' });
  }
});

router.put('/:id/cancel', validateParams(taskSchemas.taskId), (req: Request, res: Response) => {
  try {
    const result = taskCrudService.cancelTask(req.params.id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 409;
      const msg = result.error === 'not_found'
        ? 'Task not found'
        : `Cannot cancel task in current status`;
      return res.status(status).json({ success: false, error: msg });
    }
    res.json({ success: true, message: 'Task cancelled' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to cancel task' });
  }
});

router.put('/:id/intervene', validateParams(taskSchemas.taskId), validateBody(taskExtendedSchemas.intervene), (req: Request, res: Response) => {
  try {
    const { node_id, action, data } = req.body;
    if (action === 'skip') {
      taskCrudService.appendInterventionSkip(req.params.id, node_id);
    } else if (action === 'modify') {
      taskCrudService.appendInterventionModify(req.params.id, node_id, data);
    }
    res.json({ success: true, message: 'Intervention recorded' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to record intervention' });
  }
});

export default router;
