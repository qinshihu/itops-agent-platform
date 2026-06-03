import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import * as aiModelService from '../services/aiModelService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { enabled } = req.query;
    
    let models;
    if (enabled === 'true') {
      models = aiModelService.getEnabledModels();
    } else {
      models = aiModelService.getAllModels();
    }
    
    res.json({ success: true, data: models });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch models' });
  }
});

router.get('/default', (req: Request, res: Response) => {
  try {
    const defaultModel = aiModelService.getDefaultModel();
    
    if (!defaultModel) {
      return res.status(404).json({ success: false, error: 'No default model found' });
    }
    
    res.json({ success: true, data: defaultModel });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch default model' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const model = aiModelService.getModelById(req.params.id);
    
    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    
    res.json({ success: true, data: model });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch model' });
  }
});

router.post('/', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { name, provider_type, model_id, api_key, api_base, tags } = req.body;
    
    if (!name || !provider_type || !model_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'name, provider_type, and model_id are required' 
      });
    }
    
    if (provider_type !== 'local' && !api_key) {
      return res.status(400).json({ 
        success: false, 
        error: 'api_key is required for non-local providers' 
      });
    }
    
    const model = aiModelService.createModel({
      name,
      provider_type,
      model_id,
      api_key: api_key || undefined,
      api_base: api_base || undefined,
      tags: tags || []
    });
    
    res.status(201).json({ success: true, data: model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create model';
    res.status(500).json({ success: false, error: message });
  }
});

router.put('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { name, provider_type, model_id, api_key, api_base, enabled, is_default, tags } = req.body;
    
    const model = aiModelService.updateModel(req.params.id, {
      name,
      provider_type,
      model_id,
      api_key,
      api_base,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : undefined,
      is_default: is_default !== undefined ? (is_default ? 1 : 0) : undefined,
      tags
    });
    
    res.json({ success: true, data: model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update model';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    aiModelService.deleteModel(req.params.id);
    
    res.json({ success: true, message: 'Model deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete model';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const result = await aiModelService.testModelConnectivity(req.params.id);
    
    res.json({
      success: result.success,
      data: {
        status: result.success ? 'success' : 'failed',
        latency_ms: result.latency_ms,
        message: result.message
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to test model';
    res.status(500).json({ success: false, error: message });
  }
});

router.put('/reorder', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { modelIds } = req.body;
    
    if (!Array.isArray(modelIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'modelIds must be an array' 
      });
    }
    
    aiModelService.reorderModels(modelIds);
    
    res.json({ success: true, message: 'Models reordered successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reorder models';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
