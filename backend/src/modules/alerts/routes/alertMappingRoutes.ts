/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { validateBody, validateParams } from '../../../middleware/validation';
import { alertMappingSchemas } from '../../../shared/schemas/apiValidation';
import { alertMappingCrudService } from '../services/alertMappingCrudService';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const mappings = alertMappingCrudService.listMappings();
    res.json({ success: true, data: mappings });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert workflow mappings' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mapping = alertMappingCrudService.getMappingById(id);
    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Alert workflow mapping not found' });
    }
    res.json({ success: true, data: mapping });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert workflow mapping' });
  }
});

router.post('/', validateBody(alertMappingSchemas.createMapping), (req: Request, res: Response) => {
  try {
    const result = alertMappingCrudService.createMapping(req.body);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }
    res.status(201).json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create alert workflow mapping' });
  }
});

router.put('/:id', validateParams(alertMappingSchemas.mappingId), validateBody(alertMappingSchemas.updateMapping), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = alertMappingCrudService.updateMapping(id, req.body);
    if (!result.success) {
      const status = result.error === 'Alert workflow mapping not found' ? 404 : 404;
      return res.status(status).json({ success: false, error: result.error });
    }
    res.json({ success: true, message: 'Alert workflow mapping updated' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update alert workflow mapping' });
  }
});

router.delete('/:id', validateParams(alertMappingSchemas.mappingId), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = alertMappingCrudService.deleteMapping(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Alert workflow mapping not found' });
    }
    res.json({ success: true, message: 'Alert workflow mapping deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete alert workflow mapping' });
  }
});

export default router;
