/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { createAuditLog } from '../../audit/services/auditService';
import { requireRole } from '../../../middleware/auth';
import { validateBody, validateParams } from '../../../middleware/validation';
import { scheduledTaskSchemas } from '../../../shared/schemas/apiValidation';
import { scheduledTaskCrudService } from '../services/scheduledTaskCrudService';
import { logger } from '../../../utils/logger';

const router = Router();

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getCurrentUserId(req: Request): string {
  const user = (req as any).user;
  if (user?.id) return String(user.id);
  if (user?.username) return String(user.username);
  return 'unknown';
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const tasks = scheduledTaskCrudService.listScheduledTasks();
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: errMsg(error) });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const task = scheduledTaskCrudService.getScheduledTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: errMsg(error) });
  }
});

router.post(
  '/',
  requireRole('admin', 'operator'),
  validateBody(scheduledTaskSchemas.createTask),
  (req: Request, res: Response) => {
    try {
      const result = scheduledTaskCrudService.createScheduledTask(req.body);
      if (!result.success) {
        return res.status(404).json({ success: false, error: result.error });
      }
      createAuditLog({
        user_id: getCurrentUserId(req),
        action: 'create_scheduled_task',
        resource_type: 'scheduled_task',
        resource_id: result.data.id,
        details: {
          name: result.data.name,
          workflow_id: result.data.workflow_id ?? '',
          schedule: result.data.schedule ?? '',
        },
      });
      res.status(201).json({ success: true, data: result.data });
    } catch (error) {
      logger.error('POST /scheduled-tasks failed:', error);
      res.status(500).json({ success: false, error: errMsg(error) });
    }
  },
);

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const result = scheduledTaskCrudService.updateScheduledTask(req.params.id, req.body);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }
    createAuditLog({
      user_id: getCurrentUserId(req),
      action: 'update_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: req.params.id,
      details: req.body,
    });
    res.json({ success: true, message: 'Scheduled task updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: errMsg(error) });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const simple = scheduledTaskCrudService.getScheduledTaskByIdSimple(req.params.id);
    if (!simple) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }
    const result = scheduledTaskCrudService.deleteScheduledTask(req.params.id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }
    createAuditLog({
      user_id: getCurrentUserId(req),
      action: 'delete_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: req.params.id,
      details: { name: (simple as { name: string }).name },
    });
    res.json({ success: true, message: 'Scheduled task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: errMsg(error) });
  }
});

router.post(
  '/:id/toggle',
  requireRole('admin', 'operator'),
  validateParams(scheduledTaskSchemas.taskId),
  (req: Request, res: Response) => {
    try {
      const result = scheduledTaskCrudService.toggleScheduledTask(req.params.id);
      if (!result.success) {
        return res.status(404).json({ success: false, error: result.error });
      }
      createAuditLog({
        user_id: getCurrentUserId(req),
        action: 'toggle_scheduled_task',
        resource_type: 'scheduled_task',
        resource_id: req.params.id,
        details: { enabled: String(result.enabled) },
      });
      res.json({ success: true, data: { enabled: result.enabled } });
    } catch (error) {
      logger.error('POST /scheduled-tasks/:id/toggle failed:', error);
      res.status(500).json({ success: false, error: errMsg(error) });
    }
  },
);

router.post(
  '/:id/run',
  requireRole('admin', 'operator'),
  validateParams(scheduledTaskSchemas.taskId),
  (req: Request, res: Response) => {
    try {
      const task = scheduledTaskCrudService.getScheduledTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({ success: false, error: 'Scheduled task not found' });
      }
      const result = scheduledTaskCrudService.runScheduledTaskManually(req.params.id);
      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }
      createAuditLog({
        user_id: getCurrentUserId(req),
        action: 'manual_run_scheduled_task',
        resource_type: 'scheduled_task',
        resource_id: req.params.id,
        details: { name: (task as { name: string }).name, manual_run: 'true' },
      });
      res.json({ success: true, message: 'Task triggered manually' });
    } catch (error) {
      logger.error('POST /scheduled-tasks/:id/run failed:', error);
      res.status(500).json({ success: false, error: errMsg(error) });
    }
  },
);

export default router;
