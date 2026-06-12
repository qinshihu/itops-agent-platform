import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { executeWorkflow } from '../services/workflowExecutor';
import { WorkflowParsed } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;
    let query = 'SELECT * FROM tasks';
    const params: unknown[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit as string));
    }
    
    const tasks = db.prepare(query).all(...params) as Array<{ node_results?: string; logs?: string; metrics?: string; context?: string; execution_order?: string; [key: string]: unknown }>;
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
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    const t = task as Record<string, unknown>;
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
    
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id) as Record<string, unknown> | undefined;
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    const taskId = randomUUID();
    
    db.prepare(`
      INSERT INTO tasks (id, workflow_id, name, status, context)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(taskId, workflow_id, name || 'Task', JSON.stringify(context || {}));
    
    const parsedWorkflow: WorkflowParsed = {
      id: workflow.id as string,
      name: workflow.name as string,
      description: workflow.description as string,
      nodes: JSON.parse((workflow.nodes as string) || '[]'),
      edges: JSON.parse((workflow.edges as string) || '[]'),
      agent_configs: JSON.parse((workflow.agent_configs as string) || '{}'),
      is_template: workflow.is_template as number,
      created_at: workflow.created_at as string,
      updated_at: workflow.updated_at as string
    };
    
    executeWorkflow(taskId, parsedWorkflow, input, context);
    
    res.status(201).json({ success: true, data: { taskId, status: 'started' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to start task' });
  }
});

router.put('/:id/pause', (req: Request, res: Response) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('paused', req.params.id);
    res.json({ success: true, message: 'Task paused' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to pause task' });
  }
});

router.put('/:id/resume', (req: Request, res: Response) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('running', req.params.id);
    res.json({ success: true, message: 'Task resumed' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to resume task' });
  }
});

router.put('/:id/cancel', (req: Request, res: Response) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    db.prepare('UPDATE tasks SET status = ?, end_time = datetime(\'now\',\'localtime\') WHERE id = ?').run('cancelled', req.params.id);
    res.json({ success: true, message: 'Task cancelled' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to cancel task' });
  }
});

router.put('/:id/intervene', (req: Request, res: Response) => {
  try {
    const { node_id, action, data } = req.body;
    
    if (action === 'skip') {
      db.prepare(`
        UPDATE tasks 
        SET logs = json_insert(IFNULL(logs, '[]'), '$[#]', json_object(
          'timestamp', datetime('now'),
          'type', 'intervention',
          'content', 'Node ' || ? || ' skipped by user'
        ))
        WHERE id = ?
      `).run(node_id, req.params.id);
    } else if (action === 'modify') {
      db.prepare(`
        UPDATE tasks 
        SET logs = json_insert(IFNULL(logs, '[]'), '$[#]', json_object(
          'timestamp', datetime('now'),
          'type', 'intervention',
          'content', 'Node ' || ? || ' modified by user',
          'data', ?
        ))
        WHERE id = ?
      `).run(node_id, JSON.stringify(data), req.params.id);
    }
    
    res.json({ success: true, message: 'Intervention recorded' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to record intervention' });
  }
});

export default router;
