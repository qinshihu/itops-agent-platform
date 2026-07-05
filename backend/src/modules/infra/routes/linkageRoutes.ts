import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../utils/logger';
import { analyticsRepository } from '../../../repositories';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// ================================================================
// 巡检中心 — 统一合并 SNMP 巡检 + SSH 巡检 + AI 分析结果
// ================================================================
router.get('/inspection-center', (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const alertId = req.query.alertId as string | undefined;
    const type = req.query.type as string | undefined;  // snmp | ssh | compliance | analysis
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 200);

    const { results, counts } = analyticsRepository.getInspectionCenter(deviceId, alertId, type, limit);

    res.json({ success: true, data: results, counts });
  } catch (error: unknown) {
    logger.error('Inspection center query failed:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// ================================================================
// 设备概览 — 单设备聚合
// ================================================================
router.get('/device/:id/overview', (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;

    const overview = analyticsRepository.getDeviceOverview(deviceId);
    if (!overview) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }

    res.json({ success: true, data: overview });
  } catch (error: unknown) {
    logger.error('Device overview query failed:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// ================================================================
// 仪表盘联动统计数据
// ================================================================
router.get('/dashboard/linkage', (_req: Request, res: Response) => {
  try {
    const data = analyticsRepository.getDashboardLinkage();
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// ================================================================
// 历史巡检趋势数据
// ================================================================

/**
 * 获取巡检历史趋势（按天聚合）
 * GET /api/trends/inspection-history?days=30&deviceId=xxx
 */
router.get('/trends/inspection-history', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const deviceId = req.query.deviceId as string;

    const data = analyticsRepository.getInspectionHistoryTrend(days, deviceId);

    res.json({ success: true, data });
  } catch (error: unknown) {
    logger.error('Failed to get trend data:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * 获取单台设备的巡检指标趋势
 * GET /api/trends/device/:deviceId?days=30&metric=cpu|memory|bandwidth
 */
router.get('/trends/device/:deviceId', (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const days = parseInt(req.query.days as string, 10) || 30;
    const metric = req.query.metric as string || 'all';

    const data = analyticsRepository.getDeviceTrend(deviceId, days, metric);

    res.json({ success: true, data });
  } catch (error: unknown) {
    logger.error('Failed to get device trend:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * 获取趋势总结
 * GET /api/trends/summary?days=30
 */
router.get('/trends/summary', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;

    const data = analyticsRepository.getTrendSummary(days);

    res.json({ success: true, data });
  } catch (error: unknown) {
    logger.error('Failed to get trend summary:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
