/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../utils/logger';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { linkageService } from '../services/linkageService';

const router = Router();

// 巡检中心 — 统一合并 SNMP + SSH + AI 分析
router.get('/inspection-center', (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const alertId = req.query.alertId as string | undefined;
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 100;

    const { results, counts } = linkageService.getInspectionCenter(deviceId, alertId, type, limit);
    res.json({ success: true, data: results, counts });
  } catch (error: unknown) {
    logger.error('Inspection center query failed:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// 设备概览 — 单设备聚合
router.get('/device/:id/overview', (req: Request, res: Response) => {
  try {
    const overview = linkageService.getDeviceOverview(req.params.id);
    if (!overview) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }
    res.json({ success: true, data: overview });
  } catch (error: unknown) {
    logger.error('Device overview query failed:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// 仪表盘联动统计
router.get('/dashboard/linkage', (_req: Request, res: Response) => {
  try {
    const data = linkageService.getDashboardLinkage();
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// 历史巡检趋势
router.get('/trends/inspection-history', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const deviceId = req.query.deviceId as string;
    const data = linkageService.getInspectionHistoryTrend(days, deviceId);
    res.json({ success: true, data });
  } catch (error: unknown) {
    logger.error('Failed to get trend data:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// 单设备巡检指标趋势
router.get('/trends/device/:deviceId', (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const days = parseInt(req.query.days as string, 10) || 30;
    const metric = (req.query.metric as string) || 'all';
    const data = linkageService.getDeviceTrend(deviceId, days, metric);
    res.json({ success: true, data });
  } catch (error: unknown) {
    logger.error('Failed to get device trend:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// 趋势总结
router.get('/trends/summary', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const data = linkageService.getTrendSummary(days);
    res.json({ success: true, data });
  } catch (error: unknown) {
    logger.error('Failed to get trend summary:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
