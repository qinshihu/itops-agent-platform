import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { WorkflowParsed } from '../types';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const workflows = db.prepare('SELECT * FROM workflows ORDER BY is_template DESC, created_at DESC').all() as Array<{ nodes?: string; edges?: string; agent_configs?: string; [key: string]: unknown }>;
    workflows.forEach((w) => {
      if (w.nodes) w.nodes = JSON.parse(w.nodes);
      if (w.edges) w.edges = JSON.parse(w.edges);
      if (w.agent_configs) w.agent_configs = JSON.parse(w.agent_configs);
    });
    res.json({ success: true, data: workflows });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch workflows' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    const w = workflow as Record<string, unknown>;
    if (w.nodes) w.nodes = JSON.parse(w.nodes as string);
    if (w.edges) w.edges = JSON.parse(w.edges as string);
    if (w.agent_configs) w.agent_configs = JSON.parse(w.agent_configs as string);
    res.json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch workflow' });
  }
});

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, description, nodes, edges, agent_configs, is_template } = req.body;
    const id = randomUUID();
    
    db.prepare(`
      INSERT INTO workflows (id, name, description, nodes, edges, agent_configs, is_template)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description,
      JSON.stringify(nodes || []),
      JSON.stringify(edges || []),
      JSON.stringify(agent_configs || {}),
      is_template ? 1 : 0
    );
    
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create workflow' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, description, nodes, edges, agent_configs, is_template } = req.body;
    
    db.prepare(`
      UPDATE workflows 
      SET name = ?, description = ?, nodes = ?, edges = ?, agent_configs = ?, 
          is_template = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      name,
      description,
      JSON.stringify(nodes || []),
      JSON.stringify(edges || []),
      JSON.stringify(agent_configs || {}),
      is_template ? 1 : 0,
      req.params.id
    );
    
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update workflow' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    db.prepare('DELETE FROM workflows WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Workflow deleted successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete workflow' });
  }
});

router.post('/import', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const workflowData = req.body.workflow;
    if (!workflowData) {
      return res.status(400).json({ success: false, error: 'Invalid format: workflow data required' });
    }
    
    const id = randomUUID();
    db.prepare(`
      INSERT INTO workflows (id, name, description, nodes, edges, agent_configs, is_template)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(
      id,
      workflowData.name,
      workflowData.description,
      JSON.stringify(workflowData.nodes || []),
      JSON.stringify(workflowData.edges || []),
      JSON.stringify(workflowData.agent_configs || {})
    );
    
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to import workflow' });
  }
});

router.get('/export/:id', (req: Request, res: Response) => {
  try {
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    const w = workflow as Record<string, unknown>;
    const exportData: WorkflowParsed = {
      id: '',
      name: w.name as string,
      description: w.description as string,
      nodes: JSON.parse((w.nodes as string) || '[]'),
      edges: JSON.parse((w.edges as string) || '[]'),
      agent_configs: JSON.parse((w.agent_configs as string) || '{}'),
      is_template: 0,
      created_at: '',
      updated_at: ''
    };
    
    res.json({ success: true, data: exportData });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export workflow' });
  }
});

export default router;
