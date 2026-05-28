import { Router, Request, Response } from 'express';
import { remediationService } from '../services/remediationService';
import { logger } from '../utils/logger';
import db from '../models/database';
import { authenticateToken as authenticate } from '../middleware/auth';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const filters = {
      policy_id: req.query.policy_id as string | undefined,
      alert_id: req.query.alert_id as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    };

    const result = remediationService.listExecutions(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to list remediation executions:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list executions'
    });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const execution = remediationService.getExecution(req.params.id);
    res.json({ success: true, data: execution });
  } catch (error) {
    logger.error('Failed to get remediation execution:', error);
    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : 'Execution not found'
    });
  }
});

router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const { action, comment } = req.body;
    const userId = (req as any).user?.id || 'system';

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    remediationService.approveExecution(req.params.id, action, userId, comment);
    res.json({ success: true, message: `Execution ${action}d` });
  } catch (error) {
    logger.error('Failed to approve execution:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to approve execution'
    });
  }
});

router.post('/:id/retry', (req: Request, res: Response) => {
  try {
    remediationService.retryExecution(req.params.id);
    res.json({ success: true, message: 'Execution retried' });
  } catch (error) {
    logger.error('Failed to retry execution:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retry execution'
    });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { rca_id, policy_id, server_id, risk_level } = req.body;

    if (!server_id || !risk_level) {
      return res.status(400).json({
        success: false,
        message: 'server_id and risk_level are required'
      });
    }

    const audit = remediationService.createAudit({
      rca_id,
      policy_id,
      server_id,
      risk_level
    });

    res.json({ success: true, data: audit, message: 'Remediation audit created' });
  } catch (error) {
    logger.error('Failed to create remediation audit:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create remediation audit'
    });
  }
});

router.post('/:id/execute', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await remediationService.executeAudit(req.params.id);
    res.json({ success: true, data: result, message: 'Remediation executed' });
  } catch (error) {
    logger.error('Failed to execute remediation audit:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute remediation'
    });
  }
});

router.post('/:id/rollback', authenticate, async (req: Request, res: Response) => {
  try {
    const audit = db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found'
      });
    }

    if ((audit.status as string) !== 'success' && (audit.status as string) !== 'failed') {
      return res.status(400).json({
        success: false,
        message: 'Audit must be completed before rollback'
      });
    }

    await remediationService.rollbackAudit(req.params.id);
    res.json({ success: true, message: 'Remediation rolled back' });
  } catch (error) {
    logger.error('Failed to rollback remediation audit:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to rollback remediation'
    });
  }
});

router.post('/:id/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await remediationService.verifyAudit(req.params.id);
    res.json({ success: true, data: result, message: 'Remediation verified' });
  } catch (error) {
    logger.error('Failed to verify remediation audit:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to verify remediation'
    });
  }
});

export default router;
