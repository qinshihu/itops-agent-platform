import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { workflowRepository } from '../../../repositories';
import type { WorkflowParsed } from '../../../types';
import { requireRole } from '../../../middleware/auth';
import { workflowProviderRegistry } from '../services/workflowProviderRegistry';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const workflows = workflowRepository.workflows.list() as Array<{ nodes?: string; edges?: string; agent_configs?: string; [key: string]: unknown }>;
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
    const workflow = workflowRepository.workflows.getById(req.params.id);
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

    workflowRepository.workflows.create({
      id,
      name,
      description,
      nodes: JSON.stringify(nodes || []),
      edges: JSON.stringify(edges || []),
      agent_configs: JSON.stringify(agent_configs || {}),
      is_template: is_template ? 1 : 0
    });

    const workflow = workflowRepository.workflows.getById(id);
    res.status(201).json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create workflow' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, description, nodes, edges, agent_configs, is_template } = req.body;

    workflowRepository.workflows.update(req.params.id, {
      name,
      description,
      nodes: JSON.stringify(nodes || []),
      edges: JSON.stringify(edges || []),
      agent_configs: JSON.stringify(agent_configs || {}),
      is_template: is_template ? 1 : 0
    });

    const workflow = workflowRepository.workflows.getById(req.params.id);
    res.json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update workflow' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const workflow = workflowRepository.workflows.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    workflowRepository.workflows.delete(req.params.id);
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
    workflowRepository.workflows.create({
      id,
      name: workflowData.name,
      description: workflowData.description,
      nodes: JSON.stringify(workflowData.nodes || []),
      edges: JSON.stringify(workflowData.edges || []),
      agent_configs: JSON.stringify(workflowData.agent_configs || {}),
      is_template: 0
    });

    const workflow = workflowRepository.workflows.getById(id);
    res.status(201).json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to import workflow' });
  }
});

router.get('/export/:id', (req: Request, res: Response) => {
  try {
    const workflow = workflowRepository.workflows.getById(req.params.id);
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

// ==================== 工作流 Provider 管理 API ====================

router.get('/providers/list', (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    let providers;

    if (type) {
      providers = workflowProviderRegistry.listProvidersByType(type as any);
    } else {
      providers = workflowProviderRegistry.listProviders();
    }

    const simplifiedProviders = providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      configSchema: p.configSchema
    }));

    res.json({ success: true, data: simplifiedProviders });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to get workflow providers' });
  }
});

router.post('/providers/test', async (req: Request, res: Response) => {
  try {
    const { providerId, config, context } = req.body;

    if (!providerId) {
      return res.status(400).json({ success: false, error: 'Provider ID is required' });
    }

    const provider = workflowProviderRegistry.getProvider(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, error: `Provider ${providerId} not found` });
    }

    const result = await provider.execute(config || {}, context || {});
    res.json({ success: true, data: result });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to test workflow provider' });
  }
});

export default router;
