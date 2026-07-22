/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Alert 路由层
 *
 * P2-7（2026-07-20）重构后：routes 只做"取 req → 调 service → 设 res"三件套。
 * 噪音检查 / fingerprint 计算 / 通知派发 / pipeline 触发 / RCA 触发 等业务逻辑
 * 全部下沉到 alertCrudService 的高层方法：
 *   - createAlertWithFullPipeline
 *   - acknowledgeAlertWithNotification
 *   - resolveAlertWithNotification
 *   - processAlertManually
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { validateBody, validateParams } from '../../../middleware/validation';
import { alertSchemas, alertCreateSchemas } from '../../../shared/schemas/apiValidation';
import { requireRole } from '../../../middleware/auth';
import { alertCrudService } from '../services/alertCrudService';
import { alertProviderRegistry } from '../services/alertProviderRegistry';
import { alertProcessor } from '../services/AlertProcessor';
import type { AlertProcessingContext } from '../services/alertProcessingPipeline';
import { logger } from '../../../utils/logger';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const alerts = alertCrudService.listAlerts(req.query as { status?: string; severity?: string; limit?: string });
    res.json({ success: true, data: alerts });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const alert = alertCrudService.getAlertById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert' });
  }
});

router.get('/:id/automation-logs', (req: Request, res: Response) => {
  try {
    const logs = alertCrudService.getAutomationLogs(req.params.id);
    res.json({ success: true, data: logs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert automation logs' });
  }
});

router.post('/', validateBody(alertCreateSchemas.createAlert), async (req: Request, res: Response) => {
  try {
    const { source, severity, title, content, metadata, related_task_id } = req.body;

    const result = await alertCrudService.createAlertWithFullPipeline({
      source,
      severity,
      title,
      content,
      metadata,
      related_task_id,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    if ('deduped' in result) {
      return res.status(200).json({
        success: true,
        data: { alert: null, noiseReduction: { ...result.noiseReduction, suppressedByDB: true } },
      });
    }

    res.status(201).json({
      success: true,
      data: { alert: result.alert, noiseReduction: result.noiseReduction },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

router.put('/:id/acknowledge', validateParams(alertSchemas.alertId), (req: Request, res: Response) => {
  try {
    const result = alertCrudService.acknowledgeAlertWithNotification(req.params.id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 500;
      return res.status(status).json({
        success: false,
        error: result.error === 'not_found' ? 'Alert not found' : 'Failed to acknowledge alert',
      });
    }
    res.json({ success: true, data: result.alert });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

router.put('/:id/resolve', (req: Request, res: Response) => {
  try {
    const result = alertCrudService.resolveAlertWithNotification(req.params.id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 500;
      return res.status(status).json({
        success: false,
        error: result.error === 'not_found' ? 'Alert not found' : 'Failed to resolve alert',
      });
    }
    res.json({ success: true, data: result.alert });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const result = alertCrudService.deleteAlert(req.params.id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true, message: 'Alert deleted successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete alert' });
  }
});

router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const stats = alertCrudService.getStats();
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get alert stats' });
  }
});

// ── 手动触发告警处理（同步匹配 + 异步执行） ──
router.post('/:id/process', validateParams(alertSchemas.alertId), async (req: Request, res: Response) => {
  try {
    const result = await alertCrudService.processAlertManually(req.params.id);
    if (result.status === 404) {
      return res.status(404).json({ success: false, error: '告警不存在' });
    }
    if (result.status === 500) {
      return res.status(500).json({ success: false, error: result.error });
    }
    res.status(200).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    logger.error('Failed to trigger manual alert processing:', error);
    res.status(500).json({ success: false, error: '触发告警处理失败' });
  }
});

router.post('/:id/process-unified', validateParams(alertSchemas.alertId), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = alertCrudService.getAlertEssentials(id);
    if (!alert) {
      return res.status(404).json({ success: false, error: '告警不存在' });
    }

    let metadata: Record<string, unknown> = {};
    try {
      metadata = alert.metadata ? JSON.parse(alert.metadata) : {};
    } catch { /* ignore */ }

    const severity = (alert.severity || 'medium') as AlertProcessingContext['severity'];

    const result = await alertProcessor.processAlert({
      alertId: alert.id,
      title: alert.title,
      content: alert.content,
      severity,
      source: alert.source,
      metadata,
    });

    res.status(200).json({
      success: result.success,
      message: result.success
        ? `告警处理成功，策略: ${result.strategy}`
        : `告警处理失败，策略: ${result.strategy}，错误: ${result.errorMessage}`,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to process alert via unified API:', error);
    res.status(500).json({ success: false, error: '统一告警处理失败' });
  }
});

// ==================== 告警 Provider 管理 API ====================

router.get('/providers/list', (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    let providers;
    if (type) {
      providers = alertProviderRegistry.listProvidersByType(type as any);
    } else {
      providers = alertProviderRegistry.listProviders();
    }
    const simplifiedProviders = providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      configSchema: p.configSchema,
    }));
    res.json({ success: true, data: simplifiedProviders });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to get alert providers' });
  }
});

router.post('/providers/fetch', async (req: Request, res: Response) => {
  try {
    const { providerId, config } = req.body;
    if (!providerId) {
      return res.status(400).json({ success: false, error: 'Provider ID is required' });
    }
    const provider = alertProviderRegistry.getProvider(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, error: `Provider ${providerId} not found` });
    }
    const alerts = await provider.fetchAlerts(config || {});
    res.json({ success: true, data: alerts });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to fetch alerts from provider' });
  }
});

export default router;
