import { Router, Request, Response } from 'express';
import { remediationService } from '../services/remediationService';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      risk_level: req.query.risk_level as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    };

    const result = remediationService.listAudits(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to list remediation audits:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list audits'
    });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { rca_id, policy_id, server_id, risk_level, recommendations } = req.body;

    if (!rca_id || !server_id || !risk_level) {
      return res.status(400).json({
        success: false,
        message: 'rca_id, server_id, and risk_level are required'
      });
    }

    const audit = remediationService.createAudit({ rca_id, policy_id, server_id, risk_level, recommendations });
    res.status(201).json({ success: true, data: audit });
  } catch (error) {
    logger.error('Failed to create remediation audit:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create audit'
    });
  }
});

router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const { action, comment } = req.body;
    const userId = (req as any).user?.id || 'system';

    const audit = remediationService.approveAudit(req.params.id, userId, action, comment);
    res.json({ success: true, data: audit });
  } catch (error) {
    logger.error('Failed to approve audit:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to approve audit'
    });
  }
});

router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const audit = await remediationService.executeAudit(req.params.id);
    res.json({ success: true, data: audit });
  } catch (error) {
    logger.error('Failed to execute audit:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute audit'
    });
  }
});

router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const audit = await remediationService.verifyAudit(req.params.id);
    res.json({ success: true, data: audit });
  } catch (error) {
    logger.error('Failed to verify audit:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to verify audit'
    });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const audit = remediationService.getAudit(req.params.id);
    res.json({ success: true, data: audit });
  } catch (error) {
    logger.error('Failed to get audit:', error);
    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : 'Audit not found'
    });
  }
});

export default router;
