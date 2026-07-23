import type { Request, Response } from 'express';
import { Router } from 'express';
import { changeService } from '../services/changeService';
import { validateBody, validateParams } from '../../../middleware/validation';
import { changeSchemas, commonSchemas } from '../../../shared/schemas/apiValidation';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { server_id, change_type, status, page, limit } = req.query;

    const result = changeService.list({
      server_id: server_id as string,
      change_type: change_type as string,
      status: status as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ success: true, data: result.records, pagination: { page: result.page, limit: result.limit, total: result.total } });
  } catch (error: unknown) {
    logger.error('GET /changes failed:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/', validateBody(changeSchemas.createChange), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { server_id, change_type, description, changed_by, status, related_alert_id, metadata } = req.body;

    const record = changeService.create({
      server_id,
      change_type,
      description,
      changed_by,
      status,
      related_alert_id,
      metadata,
    });

    res.status(201).json({ success: true, data: record });
  } catch (error: unknown) {
    logger.error('POST /changes failed:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const record = changeService.get(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Change record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error: unknown) {
    logger.error('GET /changes/:id failed:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.patch('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const record = changeService.update(req.params.id, req.body);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Change record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error: unknown) {
    logger.error('PATCH /changes/:id failed:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/:id/root-cause', validateParams(commonSchemas.idParam), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const record = changeService.markAsRootCause(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Change record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error: unknown) {
    logger.error('POST /changes/:id/root-cause failed:', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
