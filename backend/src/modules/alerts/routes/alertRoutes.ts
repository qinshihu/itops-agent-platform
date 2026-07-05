/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID, createHash } from 'crypto';
import { notificationService } from '../../notification/services/notificationService';
import { alertNoiseReductionService } from '../services/alertNoiseReductionService';
import { rootCauseAnalysisService } from '../../ai/services/rca/rootCauseAnalysisService';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import { alertProviderRegistry } from '../services/alertProviderRegistry';
import { alertProcessor } from '../services/AlertProcessor';
import { alertRepository, settingsRepository } from '../../../repositories';
import { runAlertProcessingPipeline, type AlertProcessingContext } from '../services/alertProcessingPipeline';
import { validateBody, validateParams } from '../../../middleware/validation';
import { alertSchemas, alertCreateSchemas, commonSchemas } from '../../../shared/schemas/apiValidation';

const router = Router();

// 验证severity值的有效性
const validSeverities = ['critical', 'high', 'medium', 'low'];
const validStatuses = ['new', 'acknowledged', 'resolved'];

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, severity, limit } = req.query;
    const alerts = alertRepository.getAll({
      status: validStatuses.includes(status as string) ? (status as 'new' | 'acknowledged' | 'resolved') : undefined,
      severity: validSeverities.includes(severity as string) ? (severity as 'critical' | 'high' | 'medium' | 'low') : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, data: alerts });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const alert = alertRepository.getById(id);

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
    const { id } = req.params;
    const logs = alertRepository.getAutomationLogs(id);

    res.json({ success: true, data: logs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert automation logs' });
  }
});

router.post('/', validateBody(alertCreateSchemas.createAlert), async (req: Request, res: Response) => {
    try {
      const { source, severity, title, content, metadata, related_task_id } = req.body;

      const noiseCheck = await alertNoiseReductionService.processAlert(
        source || 'unknown',
        title,
        content,
        severity
      );

      const id = randomUUID();
      const normalizedTitle = title.toLowerCase().replace(/[\d\s_-]+/g, ' ').trim();
      const normalizedSource = (source || 'unknown').toLowerCase();
      const fingerprint = createHash('md5').update(`${normalizedSource}:${normalizedTitle}`).digest('hex');

      let alert;
      try {
        alert = alertRepository.create({
          id,
          source: source || 'unknown',
          severity: severity || 'medium',
          title,
          content: content || '',
          metadata: metadata || {},
          related_task_id,
          alert_fingerprint: fingerprint,
        });
      } catch (err) {
        const error = err as { code?: string };
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          logger.warn('Duplicate alert suppressed by database unique constraint', { fingerprint });
          return res.status(200).json({
            success: true,
            data: {
              alert: null,
              noiseReduction: { ...noiseCheck, suppressedByDB: true }
            }
          });
        }
        throw err;
      }

      if (noiseCheck.shouldNotify) {
        notificationService.sendAlertNotification(alert!).catch((err) => {
          logger.error('Failed to send alert notification:', err);
        });
      }

      setImmediate(() => runAlertProcessingPipeline({
        id,
        source: source || 'unknown',
        severity: severity || 'medium',
        rawSeverity: typeof metadata?.raw_severity === 'string' ? metadata.raw_severity : undefined,
        title,
        content: content || '',
        tags: metadata?.tags ? (Array.isArray(metadata.tags) ? metadata.tags : []): [],
      }));

      res.status(201).json({
        success: true,
        data: {
          alert,
          noiseReduction: noiseCheck
        }
      });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to create alert' });
    }
  });

router.put('/:id/acknowledge', validateParams(alertSchemas.alertId), (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = alertRepository.getById(id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    const updated = alertRepository.acknowledge(id);

    // 发送告警确认通知
    notificationService.sendSystemNotification(
      '告警已确认',
      `告警 "${alert.title}" 已确认处理`
    ).catch((err) => logger.error('Failed to send ack notification:', err));

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

router.put('/:id/resolve', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = alertRepository.getById(id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    const updated = alertRepository.resolve(id);

    // 发送告警解决通知
    notificationService.sendSystemNotification(
      '告警已解决',
      `告警 "${alert.title}" 已解决`
    ).catch((err) => logger.error('Failed to send resolve notification:', err));

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = alertRepository.getById(id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    alertRepository.delete(id);

    res.json({ success: true, message: 'Alert deleted successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete alert' });
  }
});

router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const { byStatus, bySeverity } = alertRepository.getStatsByStatusAndSeverity();

    res.json({
      success: true,
      data: {
        byStatus,
        bySeverity,
        total: byStatus.reduce((sum: number, s) => sum + s.count, 0)
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get alert stats' });
  }
});

// ── 告警自动处理流水线（已提取到 alertProcessingPipeline.ts 服务层）──
// runAlertProcessingPipeline 和 AlertProcessingContext 从 '../services/alertProcessingPipeline' 导入

// ── 手动触发告警处理（同步匹配 + 异步执行） ──
router.post('/:id/process', validateParams(alertSchemas.alertId), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = alertRepository.getEssentialById(id);
    if (!alert) {
      return res.status(404).json({ success: false, error: '告警不存在' });
    }

    const source = alert.source || 'unknown';
    const severity = (alert.severity || 'medium') as AlertProcessingContext['severity'];
    const title = alert.title;
    const content = alert.content || '';

    // 解析 tags
    let tags: string[] = [];
    let rawSeverity: string | undefined;
    if (alert.metadata) {
      try {
        const meta = JSON.parse(alert.metadata) as Record<string, unknown>;
        tags = Array.isArray(meta.tags) ? meta.tags : [];
        rawSeverity = typeof meta.raw_severity === 'string'
          ? meta.raw_severity
          : typeof meta.zabbix_raw_severity === 'string'
            ? meta.zabbix_raw_severity
            : undefined;
      } catch { /* ignore */ }
    }

    const _ctx: AlertProcessingContext = { id, source, severity, rawSeverity, title, content, tags };

    // ── 统一告警处理入口（AARS + 工作流 智能决策）──
    let processResult: { success: boolean; strategy: string; executionId?: string; taskId?: string; errorMessage?: string } | null = null;
    let errorMsg: string | null = null;

    try {
      processResult = await alertProcessor.processAlert({
        alertId: id,
        title,
        content,
        severity,
        source,
        metadata: { tags, rawSeverity }
      });
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      logger.error('Manual process alert error:', e);
    }

    // 自动根因分析（后台异步）
    setImmediate(() => {
      const autoRCAEnabled = settingsRepository.getValue('auto_root_cause_enabled');
      if (autoRCAEnabled === 'true') {
        rootCauseAnalysisService.analyzeByAlert(id, title, content).catch((err) => {
          logger.error('Failed to auto-trigger RCA for alert:', err);
        });
      }
    });

    res.json({
      success: processResult?.success ?? false,
      message: errorMsg
        ? `处理出错: ${errorMsg}`
        : `处理完成：使用 ${processResult?.strategy ?? 'unknown'} 策略`,
      data: {
        alertId: id,
        strategy: processResult?.strategy ?? 'unknown',
        executionId: processResult?.executionId || processResult?.taskId,
        error: errorMsg || processResult?.errorMessage
      }
    });
  } catch (error) {
    logger.error('Failed to trigger manual alert processing:', error);
    res.status(500).json({ success: false, error: '触发告警处理失败' });
  }
});

// ── 统一入口：告警处理（自动决策用哪种策略） ──
router.post('/:id/process-unified', validateParams(alertSchemas.alertId), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = alertRepository.getEssentialById(id);
    if (!alert) {
      return res.status(404).json({ success: false, error: '告警不存在' });
    }

    // 解析 metadata
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
      metadata
    });

    res.status(200).json({
      success: result.success,
      message: result.success
        ? `告警处理成功，策略: ${result.strategy}`
        : `告警处理失败，策略: ${result.strategy}，错误: ${result.errorMessage}`,
      data: result
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
      configSchema: p.configSchema
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

// === Alert Provider Configs CRUD ===
router.get('/providers/configs', (_req, res) => {
  try {
    const configs = alertRepository.listProviderConfigs();
    // Parse JSON config
    const parsedConfigs = configs.map((config) => {
      let parsedConfig;
      try {
        parsedConfig = config.config ? JSON.parse(config.config) : null;
      } catch {
        parsedConfig = null;
      }
      return { ...config, config: parsedConfig };
    });
    res.json({ success: true, data: parsedConfigs });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to get provider configs' });
  }
});

router.get('/providers/configs/:id', (req, res) => {
  try {
    const config = alertRepository.getProviderConfigById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    let parsedConfig;
    try {
      parsedConfig = config.config ? JSON.parse(config.config) : null;
    } catch {
      parsedConfig = null;
    }
    res.json({ success: true, data: { ...config, config: parsedConfig } });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to get provider config' });
  }
});

router.post('/providers/configs', validateBody(alertCreateSchemas.createProviderConfig), (req, res) => {
  try {
    const { provider_id, name, config, enabled } = req.body;
    const id = randomUUID();
    const newConfig = alertRepository.createProviderConfig({
      id,
      provider_id,
      name,
      config: JSON.stringify(config || {}),
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1,
    });
    let parsedConfig;
    try {
      parsedConfig = newConfig?.config ? JSON.parse(newConfig.config) : null;
    } catch {
      parsedConfig = null;
    }
    res.status(201).json({ success: true, data: { ...newConfig, config: parsedConfig } });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to create provider config' });
  }
});

router.put('/providers/configs/:id', validateBody(alertCreateSchemas.updateProviderConfig), (req, res) => {
  try {
    const { name, config, enabled } = req.body;
    const id = req.params.id;

    const updates: { name?: string; config?: string; enabled?: number } = {};

    if (name !== undefined) {
      updates.name = name;
    }
    if (config !== undefined) {
      updates.config = JSON.stringify(config || {});
    }
    if (enabled !== undefined) {
      updates.enabled = enabled ? 1 : 0;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const updatedConfig = alertRepository.updateProviderConfig(id, updates);
    let parsedConfig;
    try {
      parsedConfig = updatedConfig?.config ? JSON.parse(updatedConfig.config) : null;
    } catch {
      parsedConfig = null;
    }
    res.json({ success: true, data: { ...updatedConfig, config: parsedConfig } });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to update provider config' });
  }
});

router.delete('/providers/configs/:id', (req, res) => {
  try {
    const id = req.params.id;
    const changes = alertRepository.deleteProviderConfig(id);
    if (changes === 0) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    res.json({ success: true, message: 'Config deleted successfully' });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to delete provider config' });
  }
});

export default router;
