import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth';
import { alertAutoAnalyzer } from '../services/alertAutoAnalyzer';

const router = Router();

// 获取自动分析历史
router.get('/alert-auto-analysis', (_req: Request, res: Response) => {
  try {
    const limit = parseInt(_req.query.limit as string, 10) || 50;
    const history = alertAutoAnalyzer.getAnalysisHistory(limit);
    res.json({ success: true, data: history });
  } catch (error: any) {
    logger.error('Failed to get auto-analysis history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取指定告警的分析结果
router.get('/alert-auto-analysis/:alertId', (req: Request, res: Response) => {
  try {
    const result = alertAutoAnalyzer.getByAlertId(req.params.alertId);
    if (!result) {
      return res.status(404).json({ success: false, error: 'No analysis found for this alert' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Failed to get auto-analysis by alert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动触发分析
router.post('/alert-auto-analysis/:alertId/analyze', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await alertAutoAnalyzer.analyzeAlert(req.params.alertId);
    if (!result) {
      return res.status(409).json({ success: false, error: '该告警正在分析中' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Failed to trigger auto-analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
