import type { Request, Response } from 'express';
import { Router } from 'express';
import { alertCorrelationService } from '../services/alertCorrelationService';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// 获取关联组列表
router.get('/alert-correlation/groups', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const { groups, total } = alertCorrelationService.getGroups({ status, limit, offset });
    res.json({ success: true, data: groups, total });
  } catch (err: unknown) {
    logger.error('Failed to get correlation groups:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 获取单个组详情
router.get('/alert-correlation/groups/:id', (req: Request, res: Response) => {
  try {
    const detail = alertCorrelationService.getGroupDetail(req.params.id);
    if (!detail) return res.status(404).json({ success: false, error: '组不存在' });
    res.json({ success: true, data: detail });
  } catch (err: unknown) {
    logger.error('Failed to get correlation group detail:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 手动创建关联组
router.post('/alert-correlation/groups', requireRole('operator'), (req: Request, res: Response) => {
  try {
    const { alert_ids, title } = req.body;
    if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length < 2) {
      return res.status(400).json({ success: false, error: '至少需要2个告警ID' });
    }
    const group = alertCorrelationService.createManualGroup(alert_ids, title);
    res.json({ success: true, data: group });
  } catch (err: unknown) {
    logger.error('Failed to create correlation group:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 将告警加入已有组
router.post('/alert-correlation/groups/:id/alerts', (req: Request, res: Response) => {
  try {
    const { alert_id } = req.body;
    if (!alert_id) return res.status(400).json({ success: false, error: 'alert_id required' });
    alertCorrelationService.addAlertToGroup(req.params.id, alert_id);
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error('Failed to add alert to group:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 从组中移除告警
router.delete('/alert-correlation/groups/:id/alerts/:alertId', (req: Request, res: Response) => {
  try {
    alertCorrelationService.removeAlertFromGroup(req.params.id, req.params.alertId);
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error('Failed to remove alert from group:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 解决关联组
router.post('/alert-correlation/groups/:id/resolve', (req: Request, res: Response) => {
  try {
    const { root_cause } = req.body;
    alertCorrelationService.resolveGroup(req.params.id, root_cause);
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error('Failed to resolve correlation group:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 删除关联组
router.delete('/alert-correlation/groups/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    alertCorrelationService.deleteGroup(req.params.id);
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error('Failed to delete correlation group:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 获取告警所在的关联组
router.get('/alert-correlation/alert/:alertId', (req: Request, res: Response) => {
  try {
    const group = alertCorrelationService.getAlertGroup(req.params.alertId);
    res.json({ success: true, data: group });
  } catch (err: unknown) {
    logger.error('Failed to get alert group:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 触发自动关联
router.post('/alert-correlation/auto', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const count = await alertCorrelationService.autoCorrelate();
    res.json({ success: true, data: { grouped: count } });
  } catch (err: unknown) {
    logger.error('Failed to auto-correlate:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// 获取关联统计
router.get('/alert-correlation/stats', (_req: Request, res: Response) => {
  try {
    const stats = alertCorrelationService.getStats();
    res.json({ success: true, data: stats });
  } catch (err: unknown) {
    logger.error('Failed to get correlation stats:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
