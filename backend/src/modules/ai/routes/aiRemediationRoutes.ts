import type { Request, Response } from 'express';
import { Router } from 'express';
import { aiRemediationService } from '../services/remediation/aiRemediationService';
import { authenticateToken } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

// 获取所有 AI 修复记录
router.get('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const records = aiRemediationService.listRecords(limit);
    res.json({ success: true, data: records });
  } catch (error) {
    logger.error('Failed to list AI remediations:', error);
    res.status(500).json({ success: false, message: 'Failed to list AI remediations' });
  }
});

// 根据 ID 获取 AI 修复记录
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const record = aiRemediationService.getRecord(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'AI remediation not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    logger.error('Failed to get AI remediation:', error);
    res.status(500).json({ success: false, message: 'Failed to get AI remediation' });
  }
});

// 根据告警 ID 获取 AI 修复记录
router.get('/alert/:alertId', authenticateToken, (req: Request, res: Response) => {
  try {
    const record = aiRemediationService.getByAlertId(req.params.alertId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'AI remediation not found for this alert' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    logger.error('Failed to get AI remediation by alert:', error);
    res.status(500).json({ success: false, message: 'Failed to get AI remediation' });
  }
});

export default router;
