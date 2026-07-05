/**
 * =============================================================================
 * AARS v2 — 告警自适应响应 API 路由
 * =============================================================================
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { alertAutoResponseService } from '../services/alertAutoResponse/alertAutoResponseService';
import { adaptiveAutomationEngine } from '../services/alertAutoResponse/adaptive/adaptiveAutomation';
import { resourceAwareScheduler } from '../services/alertAutoResponse/scheduler/resourceAwareScheduler';
import { alertRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { validateBody, validateParams } from '../../../middleware/validation';
import { alertSchemas, aarsSchemas } from '../../../shared/schemas/apiValidation';

const router = Router();

/**
 * POST /api/alert-auto-response/trigger/:alertId
 * 手动触发某个告警的自动响应
 */
router.post('/trigger/:alertId', validateParams(alertSchemas.alertId), async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    // 检查告警是否存在
    const alert = alertRepository.getSummaryById(alertId);
    if (!alert) {
      return res.status(404).json({ error: '告警不存在' });
    }

    // 异步触发（不等待完成）
    alertAutoResponseService.triggerManually(alertId).catch(err => {
      logger.error(`Manual trigger failed for ${alertId}: ${err.message}`);
    });

    res.json({
      success: true,
      message: `已触发告警 ${alertId} 的自动响应流程`,
      alertTitle: alert.title,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

/**
 * GET /api/alert-auto-response/logs
 * 获取自动响应执行日志
 */
router.get('/logs', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = alertAutoResponseService.getLogs(limit);
    res.json({ logs, count: logs.length });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

/**
 * GET /api/alert-auto-response/logs/:alertId
 * 获取特定告警的响应日志
 */
router.get('/logs/:alertId', (req: Request, res: Response) => {
  try {
    const log = alertAutoResponseService.getLogByAlertId(req.params.alertId);
    if (!log) {
      return res.status(404).json({ error: '未找到该告警的响应记录' });
    }
    res.json(log);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

/**
 * GET /api/alert-auto-response/stats
 * 获取响应系统统计信息
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = alertAutoResponseService.getStats();
    res.json(stats);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

/**
 * GET /api/alert-auto-response/config
 * 获取当前配置
 */
router.get('/config', (_req: Request, res: Response) => {
  try {
    const config = alertRepository.getAarsConfig();
    res.json(config || { enabled: true, min_severity: 'medium' });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

/**
 * PUT /api/alert-auto-response/config
 * 更新配置
 */
router.put('/config', validateBody(aarsSchemas.updateConfig), (req: Request, res: Response) => {
  try {
    const updates = req.body;

    const allowedFields = [
      'enabled', 'min_severity', 'auto_execute_enabled', 'approval_timeout_minutes',
      'max_concurrent', 'ssh_timeout_sec', 'verify_interval_sec', 'notification_channels',
      'auto_execute_whitelist', 'business_hours',
    ];

    const filteredFields: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredFields[field] = updates[field];
      }
    }

    if (Object.keys(filteredFields).length === 0) {
      return res.status(400).json({ error: '没有可更新的字段' });
    }

    const config = alertRepository.updateAarsConfig(filteredFields);
    res.json({ success: true, config });
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

/**
 * GET /api/alert-auto-response/trust-stats
 * 查看自适应自动化信任统计
 */
router.get('/trust-stats', (_req: Request, res: Response) => {
  try {
    const stats = adaptiveAutomationEngine.getTrustStats();
    res.json(stats);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

/**
 * GET /api/alert-auto-response/scheduler-stats
 * 查看调度器状态
 */
router.get('/scheduler-stats', (_req: Request, res: Response) => {
  try {
    const stats = resourceAwareScheduler.getStats();
    res.json(stats);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

/**
 * GET /api/alert-auto-response/probe-stats
 * 查看探针统计
 */
router.get('/probe-stats', (_req: Request, res: Response) => {
  try {
    const rows = alertRepository.listProbeStats();
    res.json(rows);
  } catch (err: unknown) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

export default router;
