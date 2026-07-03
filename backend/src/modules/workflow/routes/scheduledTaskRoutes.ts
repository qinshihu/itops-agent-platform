import type { Request, Response } from 'express';
import { Router } from 'express';
import { workflowRepository } from '../../../repositories';
import { randomUUID } from 'crypto';
import { createAuditLog } from '../../infra/services/auditService';
import { schedulerService } from '../services/schedulerService';
import { requireRole } from '../../../middleware/auth';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const tasks = workflowRepository.scheduledTasks.list();
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = workflowRepository.scheduledTasks.getByIdWithWorkflow(id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, description, workflow_id, schedule, cron_expression, enabled = 1 } = req.body;

    if (!name || (!schedule && !cron_expression)) {
      return res.status(400).json({ success: false, error: 'Name and cron expression are required' });
    }

    const taskSchedule = schedule || cron_expression;

    if (workflow_id) {
      if (!workflowRepository.workflows.existsById(workflow_id)) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }
    }

    const id = randomUUID();

    workflowRepository.scheduledTasks.create({
      id,
      name,
      description: description || null,
      workflow_id: workflow_id || null,
      schedule: taskSchedule,
      enabled: enabled ? 1 : 0
    });

    // 如果启用，则立即调度任务
    if (enabled) {
      schedulerService.scheduleTask({
        id,
        name,
        description,
        workflow_id,
        schedule: taskSchedule,
        enabled: 1
      });
    }

    createAuditLog({
      user_id: 'system',
      action: 'create_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { name, workflow_id, schedule }
    });

    res.status(201).json({ success: true, data: { id, name, description, workflow_id, schedule, enabled } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, workflow_id, schedule, cron_expression, enabled } = req.body;

    const task = workflowRepository.scheduledTasks.getById(id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }

    if (workflow_id) {
      if (!workflowRepository.workflows.existsById(workflow_id)) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }
    }

    workflowRepository.scheduledTasks.update(id, {
      name,
      description: description !== undefined ? description : undefined,
      workflow_id: workflow_id !== undefined ? workflow_id : undefined,
      schedule: schedule || cron_expression,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : undefined,
    });

    // 更新调度器
    const updatedTask = workflowRepository.scheduledTasks.getById(id);
    if (updatedTask) {
      schedulerService.updateTask(updatedTask as any);
    }

    createAuditLog({
      user_id: 'system',
      action: 'update_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { name, workflow_id, schedule, enabled }
    });

    res.json({ success: true, message: 'Scheduled task updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = workflowRepository.scheduledTasks.getById(id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }

    // 从调度器中删除
    schedulerService.deleteTask(id);

    workflowRepository.scheduledTasks.delete(id);

    createAuditLog({
      user_id: 'system',
      action: 'delete_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { name: task.name }
    });

    res.json({ success: true, message: 'Scheduled task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/toggle', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = workflowRepository.scheduledTasks.getById(id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }

    const newEnabled = !task.enabled ? 1 : 0;
    workflowRepository.scheduledTasks.setEnabled(id, newEnabled);

    const updatedTask = workflowRepository.scheduledTasks.getById(id);
    if (updatedTask) {
      schedulerService.updateTask(updatedTask as any);
    }

    createAuditLog({
      user_id: 'system',
      action: 'toggle_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { enabled: !!newEnabled }
    });

    res.json({ success: true, data: { enabled: !!newEnabled } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/run', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = workflowRepository.scheduledTasks.getByIdForManualRun(id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }

    schedulerService.executeWorkflow(task as any);

    createAuditLog({
      user_id: 'system',
      action: 'manual_run_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { name: task.name, manual_run: true }
    });

    res.json({ success: true, message: 'Task triggered manually' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
