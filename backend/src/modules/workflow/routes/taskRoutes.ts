import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { workflowRepository } from '../../../repositories';
import { executeWorkflow } from '../services/workflowExecutor';
import type { WorkflowParsed } from '../../../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;
    const tasks = workflowRepository.tasks.list({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any[];
    tasks.forEach((t) => {
      if (t.node_results) t.node_results = JSON.parse(t.node_results);
      if (t.logs) t.logs = JSON.parse(t.logs);
      if (t.metrics) t.metrics = JSON.parse(t.metrics);
      if (t.context) t.context = JSON.parse(t.context);
      if (t.execution_order) t.execution_order = JSON.parse(t.execution_order);
    });
    res.json({ success: true, data: tasks });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const task = workflowRepository.tasks.getById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = task as any;
    if (t.node_results) t.node_results = JSON.parse(t.node_results as string);
    if (t.logs) t.logs = JSON.parse(t.logs as string);
    if (t.metrics) t.metrics = JSON.parse(t.metrics as string);
    if (t.context) t.context = JSON.parse(t.context as string);
    if (t.execution_order) t.execution_order = JSON.parse(t.execution_order as string);
    res.json({ success: true, data: task });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch task' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { workflow_id, name, input, context } = req.body;

    const workflow = workflowRepository.workflows.getById(workflow_id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const taskId = randomUUID();

    workflowRepository.tasks.create({
      id: taskId,
      workflow_id,
      name: name || 'Task',
      context: JSON.stringify(context || {})
    });

    const parsedWorkflow: WorkflowParsed = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description ?? undefined,
      nodes: JSON.parse((workflow.nodes as string) || '[]'),
      edges: JSON.parse((workflow.edges as string) || '[]'),
      agent_configs: JSON.parse((workflow.agent_configs as string) || '{}'),
      is_template: workflow.is_template,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at
    };

    executeWorkflow(taskId, parsedWorkflow, input, context);

    res.status(201).json({ success: true, data: { taskId, status: 'started' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to start task' });
  }
});

router.put('/:id/pause', (req: Request, res: Response) => {
  try {
    const task = workflowRepository.tasks.getById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    workflowRepository.tasks.updateStatus(req.params.id, 'paused');
    res.json({ success: true, message: 'Task paused' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to pause task' });
  }
});

router.put('/:id/resume', (req: Request, res: Response) => {
  try {
    const task = workflowRepository.tasks.getById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    workflowRepository.tasks.updateStatus(req.params.id, 'running');
    res.json({ success: true, message: 'Task resumed' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to resume task' });
  }
});

router.put('/:id/cancel', (req: Request, res: Response) => {
  try {
    const task = workflowRepository.tasks.getById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    workflowRepository.tasks.updateStatusWithEndTime(req.params.id, 'cancelled');
    res.json({ success: true, message: 'Task cancelled' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to cancel task' });
  }
});

router.put('/:id/intervene', (req: Request, res: Response) => {
  try {
    const { node_id, action, data } = req.body;

    if (action === 'skip') {
      workflowRepository.tasks.appendInterventionSkipLog(req.params.id, node_id);
    } else if (action === 'modify') {
      workflowRepository.tasks.appendInterventionModifyLog(req.params.id, node_id, JSON.stringify(data));
    }

    res.json({ success: true, message: 'Intervention recorded' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to record intervention' });
  }
});

export default router;
