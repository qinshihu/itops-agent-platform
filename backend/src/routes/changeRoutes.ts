import { Router, Request, Response } from 'express';
import { changeService } from '../services/changeService';

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
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { server_id, change_type, description, changed_by, status, related_alert_id, metadata } = req.body;

    if (!server_id || !change_type) {
      return res.status(400).json({ success: false, error: 'server_id and change_type are required' });
    }

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
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const record = changeService.get(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Change record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch('/:id', (req: Request, res: Response) => {
  try {
    const record = changeService.update(req.params.id, req.body);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Change record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/root-cause', (req: Request, res: Response) => {
  try {
    const record = changeService.markAsRootCause(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Change record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
