/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireRole } from '../../../middleware/auth';
import { workflowProviderRegistry } from '../services/workflowProviderRegistry';
import { workflowCrudService } from '../services/workflowCrudService';
import { validateBody, validateParams } from '../../../middleware/validation';
import { workflowSchemas, workflowExtendedSchemas } from '../../../shared/schemas/apiValidation';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const workflows = workflowCrudService.listWorkflows();
    res.json({ success: true, data: workflows });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch workflows' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const workflow = workflowCrudService.getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch workflow' });
  }
});

router.post('/', requireRole('admin', 'operator'), validateBody(workflowSchemas.createWorkflow), (req: Request, res: Response) => {
  try {
    const workflow = workflowCrudService.createWorkflow(req.body);
    res.status(201).json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create workflow' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), validateParams(workflowSchemas.workflowId), validateBody(workflowExtendedSchemas.updateWorkflow), (req: Request, res: Response) => {
  try {
    const workflow = workflowCrudService.updateWorkflow(req.params.id, req.body);
    res.json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update workflow' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { existed } = workflowCrudService.deleteWorkflow(req.params.id);
    if (!existed) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, message: 'Workflow deleted successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete workflow' });
  }
});

router.post('/import', requireRole('admin', 'operator'), validateBody(workflowExtendedSchemas.importWorkflow), (req: Request, res: Response) => {
  try {
    const workflow = workflowCrudService.importWorkflow(req.body.workflow);
    res.status(201).json({ success: true, data: workflow });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to import workflow' });
  }
});

router.get('/export/:id', (req: Request, res: Response) => {
  try {
    const exportData = workflowCrudService.exportWorkflow(req.params.id);
    if (!exportData) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
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
      configSchema: p.configSchema,
    }));
    res.json({ success: true, data: simplifiedProviders });
  } catch {
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
  } catch {
    res.status(500).json({ success: false, error: 'Failed to test workflow provider' });
  }
});

export default router;
