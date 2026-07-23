/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { autoScaleService } from '../services/autoScaleService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /targets?type=container|vm|k8s_deployment
 * 返回指定 targetType 下可用的"伸缩目标"列表，供前端规则表单选择。
 */
router.get('/targets', async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as 'container' | 'vm' | 'k8s_deployment') || 'container';
    const data = await autoScaleService.listScaleTargets(type);
    res.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('GET /auto-scale/targets failed:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.get('/rules', (_req: Request, res: Response) => {
  try {
    const data = autoScaleService.listRules();
    res.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('GET /auto-scale/rules failed:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.get('/rules/:id', (req: Request, res: Response) => {
  try {
    const data = autoScaleService.getRule(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: '规则不存在' });
    res.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('GET /auto-scale/rules/:id failed:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.post('/rules', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const data = autoScaleService.createRule(req.body);
    res.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('POST /auto-scale/rules failed:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.put('/rules/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const data = autoScaleService.updateRule(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('PUT /auto-scale/rules/:id failed:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.delete('/rules/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    autoScaleService.deleteRule(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err: unknown) {
    logger.error('DELETE /auto-scale/rules/:id failed:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.get('/history', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const ruleId = req.query.ruleId as string;
    const result = autoScaleService.getHistory(page, pageSize, ruleId);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (err: unknown) {
    logger.error('GET /auto-scale/history failed:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

router.get('/summary', (_req: Request, res: Response) => {
  try {
    const data = autoScaleService.getSummary();
    res.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('GET /auto-scale/summary failed:', err);
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

export default router;
