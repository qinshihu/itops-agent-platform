import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../utils/logger';
import { analyticsRepository } from '../../../repositories';

const router = Router();

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = analyticsRepository.getDashboardStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

router.get('/alert-trends', (req: Request, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const hoursNum = parseInt(hours as string, 10);

    const alerts = analyticsRepository.getAlertTrends(hoursNum);

    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Alert trends error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alert trends' });
  }
});

router.get('/task-trends', (req: Request, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const hoursNum = parseInt(hours as string, 10);

    const tasks = analyticsRepository.getTaskTrends(hoursNum);

    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('Task trends error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task trends' });
  }
});

router.get('/agent-stats', (_req: Request, res: Response) => {
  try {
    const data = analyticsRepository.getAgentStats();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Agent stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agent stats' });
  }
});

router.get('/task-distribution', (_req: Request, res: Response) => {
  try {
    const data = analyticsRepository.getTaskDistribution();

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Task distribution error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task distribution' });
  }
});

router.get('/remediation-stats', (_req: Request, res: Response) => {
  try {
    const data = analyticsRepository.getRemediationStats();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Remediation stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch remediation stats' });
  }
});

router.get('/sla-stats', (_req: Request, res: Response) => {
  try {
    const data = analyticsRepository.getSlaStats();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('SLA stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SLA stats' });
  }
});

router.get('/server-metrics', (_req: Request, res: Response) => {
  try {
    const data = analyticsRepository.getServerMetricsDashboard();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Server metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch server metrics' });
  }
});

router.get('/full', (_req: Request, res: Response) => {
  try {
    const data = analyticsRepository.getFullDashboard();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Full dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch full dashboard' });
  }
});

router.get('/alert-source-stats', (_req: Request, res: Response) => {
  try {
    const data = analyticsRepository.getAlertSourceStats();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Alert source stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alert source stats' });
  }
});

export default router;
