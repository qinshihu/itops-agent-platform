import type { Request, Response } from 'express';
import { Router } from 'express';
import { remediationService } from '../services/remediationService';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';

const router = Router();

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const policy = remediationService.createPolicy(req.body);
    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    logger.error('Failed to create remediation policy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create policy';
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    let enabled: boolean | undefined;
    if (req.query.enabled === 'true') {
      enabled = true;
    } else if (req.query.enabled === 'false') {
      enabled = false;
    }
    
    const filters = {
      enabled,
      alert_source: req.query.alert_source as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    };

    const result = remediationService.listPolicies(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to list remediation policies:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to list policies';
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const policy = remediationService.getPolicy(req.params.id);
    res.json({ success: true, data: policy });
  } catch (error) {
    logger.error('Failed to get remediation policy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Policy not found';
    res.status(404).json({
      success: false,
      message: errorMessage
    });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const policy = remediationService.updatePolicy(req.params.id, req.body);
    res.json({ success: true, data: policy });
  } catch (error) {
    logger.error('Failed to update remediation policy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update policy';
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    remediationService.deletePolicy(req.params.id);
    res.json({ success: true, message: 'Policy deleted' });
  } catch (error) {
    logger.error('Failed to delete remediation policy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete policy';
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

router.patch('/:id/toggle', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const policy = remediationService.togglePolicy(req.params.id);
    res.json({ success: true, data: policy });
  } catch (error) {
    logger.error('Failed to toggle remediation policy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to toggle policy';
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

router.get('/:id/stats', (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const stats = remediationService.getPolicyStats(req.params.id, days);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get policy stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get stats';
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

export default router;
