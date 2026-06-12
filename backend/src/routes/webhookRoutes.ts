import { Router, Request, Response } from 'express';
import db, { getIOInstance } from '../models/database';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';
import { createAuditLog } from '../services/auditService';
import { createNotification } from './notificationRoutes';
import { alertService } from '../services/alertService';
import { remediationService } from '../services/remediationService';
import { env } from '../utils/env';
import crypto from 'crypto';
import {
  adaptPrometheus,
  adaptZabbix,
  adaptGrafana,
  adaptAliyun,
  adaptTencentCloud,
  detectSourceType,
  NormalizedAlert,
} from '../services/alertSourceAdapters';
import { alertDeviceResolver } from '../services/alertDeviceResolver';
import { alertAutoAnalyzer } from '../services/alertAutoAnalyzer';
import { emitToAlerts } from '../websocket/handler';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

function logWebhookInvocation(
  source: string,
  status: 'success' | 'error',
  alertCount: number,
  resolvedCount: number,
  errorMessage?: string,
  req?: Request,
  processingTimeMs?: number
) {
  try {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO alert_webhook_logs (id, source, status, alert_count, resolved_count, error_message, ip_address, user_agent, processing_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      source,
      status,
      alertCount,
      resolvedCount,
      errorMessage || null,
      req?.ip || null,
      req?.headers['user-agent'] as string || null,
      processingTimeMs || null
    );
  } catch (e) {
    logger.debug('Failed to log webhook invocation:', e);
  }
}

interface WebhookSignatureConfig {
  enabled: boolean;
  secret?: string;
  headerName: string;
  algorithm?: string;
}

/**
 * ⚠️ 安全警告 (SECURITY WARNING)
 *
 * 生产环境必须启用 Webhook 签名验证！
 * 当前实现通过 env.WEBHOOK_VERIFY_ENABLED 和 env.WEBHOOK_SECRET 控制签名验证。
 * 如果未启用签名验证，任何知道 Webhook URL 的人都可以向系统发送伪造告警，
 * 可能导致：
 *   - 恶意告警注入，触发错误的自动工作流
 *   - 虚假告警恢复，掩盖真实故障
 *   - 拒绝服务攻击（大量伪造告警）
 *
 * 生产环境配置要求：
 *   1. 设置 WEBHOOK_VERIFY_ENABLED=true
 *   2. 设置 WEBHOOK_SECRET 为强随机字符串（至少 32 字节）
 *   3. 在告警源（Zabbix/Prometheus/Grafana 等）中配置相同的 Secret
 *   4. 确保告警源通过 HTTPS 发送请求，并携带正确的签名 Header
 *
 * 签名验证机制：
 *   - 算法：HMAC-SHA256
 *   - 签名内容：请求 Body 的 JSON 字符串
 *   - Header 名称：X-Webhook-Signature-{source}（例如 X-Webhook-Signature-zabbix）
 *   - 比较方式：timingSafeEqual（防时序攻击）
 */
function getWebhookConfig(source: string): WebhookSignatureConfig {
  const enabled = env.WEBHOOK_VERIFY_ENABLED || false;
  const secret = env.WEBHOOK_SECRET;
  return {
    enabled,
    secret,
    headerName: `X-Webhook-Signature-${source}`,
    algorithm: 'sha256',
  };
}

function verifyWebhookSignature(req: Request, source: string): boolean {
  const config = getWebhookConfig(source);
  if (!config.enabled || !config.secret) {
    return true;
  }

  const signature = req.headers[config.headerName.toLowerCase()] as string;
  if (!signature) {
    return false;
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac(config.algorithm || 'sha256', config.secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function findAndTriggerWorkflow(alertId: string, source: string, severity: string, title: string): string | null {
  try {
    const mappings = db.prepare(`
      SELECT * FROM alert_workflow_mappings
      WHERE enabled = 1
      AND (alert_source = ? OR alert_source IS NULL)
      AND (alert_severity = ? OR alert_severity IS NULL)
    `).all(source, severity);

    const matchingMappings = (mappings as Array<{ alert_title_pattern?: string; workflow_id: string }>).filter(mapping => {
      if (!mapping.alert_title_pattern) return true;
      try {
        return title.includes(mapping.alert_title_pattern);
      } catch {
        return false;
      }
    });

    if (matchingMappings.length > 0) {
      const mapping = matchingMappings[0];
      const taskId = randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO tasks (id, workflow_id, name, status, created_at, initial_input, related_alert_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        mapping.workflow_id,
        `自动处理告警: ${title.substring(0, 50)}`,
        'pending',
        now,
        JSON.stringify({ alertId, source, severity, title }),
        alertId
      );

      db.prepare('UPDATE alerts SET related_task_id = ? WHERE id = ?').run(taskId, alertId);

      createAuditLog({
        action: 'auto_trigger_workflow',
        resource_type: 'task',
        resource_id: taskId,
        details: { alertId, workflowId: mapping.workflow_id },
      });

      const io = getIOInstance();
      if (io) {
        io.emit('task:created', { id: taskId, name: `自动处理告警: ${title}`, workflowId: mapping.workflow_id });
      }

      return taskId;
    }

    return null;
  } catch (error) {
    logger.error('Error triggering workflow:', error);
    return null;
  }
}

function processNormalizedAlert(
  alert: NormalizedAlert,
  sourceLabel: string
): { alertId: string; taskId: string | null; executionIds: string[]; status: 'created' | 'resolved' } {
  const io = getIOInstance();

  if (alert.status === 'resolved') {
    let updated = 0;
    if (alert.external_id) {
      const result = db.prepare(
        `UPDATE alerts SET status = 'resolved_auto', resolved_at = local_now(),
         resolved_by = 'auto', resolution_notes = ?
         WHERE metadata LIKE ? AND status IN ('new', 'confirmed', 'in_progress')`
      ).run(`Auto-resolved by ${sourceLabel}`, `%${alert.external_id}%`);
      updated = result.changes;
    }

    if (updated === 0 && alert.host) {
      db.prepare(
        `UPDATE alerts SET status = 'resolved_auto', resolved_at = local_now(),
         resolved_by = 'auto', resolution_notes = ?
         WHERE source = ? AND title LIKE ? AND status IN ('new', 'confirmed', 'in_progress')
         AND created_at >= datetime('now', '-24 hours')`
      ).run(`Auto-resolved by ${sourceLabel}`, alert.source, `%${alert.host}%`);
    }

    createAuditLog({
      action: 'alert_auto_resolved',
      resource_type: 'alert',
      details: { source: alert.source, title: alert.title, host: alert.host },
    });

    if (io) {
      io.emit('alert:resolved', { source: alert.source, title: alert.title, host: alert.host });
    }

    return { alertId: '', taskId: null, executionIds: [], status: 'resolved' };
  }

  const id = randomUUID();
  const severity = alert.severity;
  const title = alert.title;
  const content = alert.content;

  db.prepare(`
    INSERT INTO alerts (id, source, severity, title, content, metadata, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    alert.source,
    severity,
    title,
    content,
    JSON.stringify(alert.metadata),
    'new'
  );

  // ============================================================
  //  统一修复流水线: 修复策略匹配 + 设备关联 + RCA + WebSocket
  // ============================================================
  const executionIds: string[] = [];
  setImmediate(async () => {
    try {
      // ── 匹配修复策略并触发执行 ──
      const alertForMatching = {
        id,
        source: alert.source,
        severity,
        title,
        content: alert.content,
        tags: [] as string[],
      };
      if (alert.metadata?.tags) {
        alertForMatching.tags = Array.isArray(alert.metadata.tags) ? alert.metadata.tags : [];
      }

      if (io) {
        emitToAlerts(io, 'remediation:started', {
          alertId: id, title, timestamp: new Date().toISOString()
        });
      }

      // ── RCA ──
      if (severity === 'critical' || severity === 'high' || severity === 'disaster') {
        alertService.processDatabaseAlert(id);
      }

      // ── 设备关联 ──
      try {
        const assoc = alertDeviceResolver.resolve(id, title, content, alert.host, alert.source);
        if (assoc) {
          alertDeviceResolver.saveAssociation(id, assoc.device_type, assoc.device_id, assoc.match_method, assoc.confidence);
        }
      } catch (error) {
        logger.error(`[Webhook] 告警设备关联失败: ${error instanceof Error ? error.message : error}`);
      }

      // ── AI 自动分析（高优告警即时触发） ──
      if (severity === 'critical' || severity === 'high') {
        alertAutoAnalyzer.analyzeAlert(id).catch((err: Error) => {
          logger.error(`[Webhook] AI 自动分析失败: ${err.message}`);
        });
      }

      // ── 修复策略执行 ──
      const matchedPolicies = await remediationService.matchAlertToPolicies(alertForMatching);
      for (const policy of matchedPolicies) {
        logger.info(`🔧 [Webhook] 匹配到修复策略: ${policy.name}, 自动触发...`);
        const result = await remediationService.triggerRemediation(policy, alertForMatching);
        if (result.id) {
          executionIds.push(result.id);
        }
        if (io) {
          emitToAlerts(io, 'remediation:result', {
            alertId: id,
            policyId: policy.id,
            policyName: policy.name,
            executionId: result.id,
            status: result.status,
            timestamp: new Date().toISOString()
          });
        }
      }

      if (io) {
        emitToAlerts(io, 'remediation:completed', {
          alertId: id,
          totalPolicies: matchedPolicies.length,
          timestamp: new Date().toISOString()
        });
      }

      if (matchedPolicies.length > 0) {
        logger.info(`✅ [Webhook] 已触发 ${matchedPolicies.length} 个修复策略 (alert: ${id}, executions: ${executionIds.join(',')})`);
      }
    } catch (error) {
      logger.error(`❌ [Webhook] 修复流水线异常: ${error instanceof Error ? error.message : error}`);
      if (io) {
        emitToAlerts(io, 'remediation:error', {
          alertId: id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  createNotification({
    type: 'alert',
    title: `新告警: ${title}`,
    content: content.substring(0, 200),
    related_alert_id: id,
  });

  createAuditLog({
    action: 'alert_received',
    resource_type: 'alert',
    resource_id: id,
    details: { source: alert.source, severity, title, executionIds },
  });

  if (io) {
    io.emit('alert:new', { id, source: alert.source, severity, title, content, executionIds, host: alert.host });
  }

  return { alertId: id, taskId: executionIds[0] || null, executionIds, status: 'created' };
}

router.post('/prometheus', (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    logger.info(`Webhook invocation: /prometheus from ${req.ip}`);
    if (!verifyWebhookSignature(req, 'prometheus')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'prometheus', ip: req.ip },
      });
      logWebhookInvocation('prometheus', 'error', 0, 0, 'Invalid signature', req, Date.now() - startTime);
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const result = adaptPrometheus(req.body);

    if (result.errors.length > 0) {
      logger.warn('Prometheus adapter errors:', result.errors);
    }

    const processed: Array<{ alertId: string; taskId: string | null; status: string }> = [];
    for (const alert of result.alerts) {
      processed.push(processNormalizedAlert(alert, 'Prometheus'));
    }

    const created = processed.filter(p => p.status === 'created').length;
    const resolved = processed.filter(p => p.status === 'resolved').length;

    logWebhookInvocation('prometheus', 'success', result.alerts.length, resolved, undefined, req, Date.now() - startTime);

    res.json({
      success: true,
      message: `Processed ${result.alerts.length} alerts (${created} new, ${resolved} resolved)`,
      data: { processed },
    });
  } catch (error) {
    logger.error('Prometheus webhook error:', error);
    logWebhookInvocation('prometheus', 'error', 0, 0, (error as Error).message, req, Date.now() - startTime);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/zabbix', (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    if (!verifyWebhookSignature(req, 'zabbix')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'zabbix', ip: req.ip },
      });
      logWebhookInvocation('zabbix', 'error', 0, 0, 'Invalid signature', req, Date.now() - startTime);
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const result = adaptZabbix(req.body);
    if (result.errors.length > 0) logger.warn('Zabbix adapter errors:', result.errors);

    const processed: Array<{ alertId: string; taskId: string | null; status: string }> = [];
    for (const alert of result.alerts) {
      processed.push(processNormalizedAlert(alert, 'Zabbix'));
    }

    logWebhookInvocation('zabbix', 'success', result.alerts.length, 0, undefined, req, Date.now() - startTime);

    res.json({
      success: true,
      message: `Zabbix alert processed (${result.alerts.length} alerts)`,
      data: { processed },
    });
  } catch (error) {
    logger.error('Zabbix webhook error:', error);
    logWebhookInvocation('zabbix', 'error', 0, 0, (error as Error).message, req, Date.now() - startTime);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/grafana', (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    if (!verifyWebhookSignature(req, 'grafana')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'grafana', ip: req.ip },
      });
      logWebhookInvocation('grafana', 'error', 0, 0, 'Invalid signature', req, Date.now() - startTime);
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const result = adaptGrafana(req.body);
    if (result.errors.length > 0) logger.warn('Grafana adapter errors:', result.errors);

    const processed: Array<{ alertId: string; taskId: string | null; status: string }> = [];
    for (const alert of result.alerts) {
      processed.push(processNormalizedAlert(alert, 'Grafana'));
    }

    const created = processed.filter(p => p.status === 'created').length;
    const resolved = processed.filter(p => p.status === 'resolved').length;

    logWebhookInvocation('grafana', 'success', result.alerts.length, resolved, undefined, req, Date.now() - startTime);

    res.json({
      success: true,
      message: `Processed ${result.alerts.length} alerts (${created} new, ${resolved} resolved)`,
      data: { processed },
    });
  } catch (error) {
    logger.error('Grafana webhook error:', error);
    logWebhookInvocation('grafana', 'error', 0, 0, (error as Error).message, req, Date.now() - startTime);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/aliyun', (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    if (!verifyWebhookSignature(req, 'aliyun')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'aliyun', ip: req.ip },
      });
      logWebhookInvocation('aliyun', 'error', 0, 0, 'Invalid signature', req, Date.now() - startTime);
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const result = adaptAliyun(req.body);
    if (result.errors.length > 0) logger.warn('Aliyun adapter errors:', result.errors);

    const processed: Array<{ alertId: string; taskId: string | null; status: string }> = [];
    for (const alert of result.alerts) {
      processed.push(processNormalizedAlert(alert, 'Aliyun'));
    }

    logWebhookInvocation('aliyun', 'success', result.alerts.length, 0, undefined, req, Date.now() - startTime);

    res.json({
      success: true,
      message: `Aliyun alert processed (${result.alerts.length} alerts)`,
      data: { processed },
    });
  } catch (error) {
    logger.error('Aliyun webhook error:', error);
    logWebhookInvocation('aliyun', 'error', 0, 0, (error as Error).message, req, Date.now() - startTime);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/tencent', (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    if (!verifyWebhookSignature(req, 'tencent')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'tencent', ip: req.ip },
      });
      logWebhookInvocation('tencent', 'error', 0, 0, 'Invalid signature', req, Date.now() - startTime);
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const result = adaptTencentCloud(req.body);
    if (result.errors.length > 0) logger.warn('Tencent adapter errors:', result.errors);

    const processed: Array<{ alertId: string; taskId: string | null; status: string }> = [];
    for (const alert of result.alerts) {
      processed.push(processNormalizedAlert(alert, 'Tencent'));
    }

    logWebhookInvocation('tencent', 'success', result.alerts.length, 0, undefined, req, Date.now() - startTime);

    res.json({
      success: true,
      message: `Tencent Cloud alert processed (${result.alerts.length} alerts)`,
      data: { processed },
    });
  } catch (error) {
    logger.error('Tencent webhook error:', error);
    logWebhookInvocation('tencent', 'error', 0, 0, (error as Error).message, req, Date.now() - startTime);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/auto', (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const detectedType = detectSourceType(req.body);
    logger.info(`Auto-detected alert source: ${detectedType}`);

    let result;
    switch (detectedType) {
      case 'prometheus': result = adaptPrometheus(req.body); break;
      case 'zabbix': result = adaptZabbix(req.body); break;
      case 'grafana': result = adaptGrafana(req.body); break;
      case 'aliyun': result = adaptAliyun(req.body); break;
      case 'tencent': result = adaptTencentCloud(req.body); break;
      default: result = { alerts: [], errors: [`Unknown alert source type: ${detectedType}`] }; break;
    }

    if (result.errors.length > 0) logger.warn(`Auto-detect (${detectedType}) adapter errors:`, result.errors);

    const processed: Array<{ alertId: string; taskId: string | null; status: string; source: string }> = [];
    for (const alert of result.alerts) {
      const r = processNormalizedAlert(alert, `Auto(${detectedType})`);
      processed.push({ ...r, source: alert.source });
    }

    logWebhookInvocation(`auto_${detectedType}`, 'success', result.alerts.length, 0, undefined, req, Date.now() - startTime);

    res.json({
      success: true,
      message: `Auto-detected source: ${detectedType}, processed ${result.alerts.length} alerts`,
      data: { detectedType, processed },
    });
  } catch (error) {
    logger.error('Auto-detect webhook error:', error);
    logWebhookInvocation('auto', 'error', 0, 0, (error as Error).message, req, Date.now() - startTime);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/generic', validateBody(z.object({
  title: z.string().min(1),
  source: z.string().optional(),
  severity: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  external_id: z.string().optional(),
  host: z.string().optional(),
  status: z.enum(['firing', 'resolved']).optional(),
})), (req: Request, res: Response) => {
  try {
    if (!verifyWebhookSignature(req, 'generic')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'generic', ip: req.ip },
      });
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const { title, source = 'generic', severity = 'medium', content, metadata, external_id, host, status } = req.body;

    const alert: NormalizedAlert = {
      external_id,
      source,
      severity,
      title,
      content: content || JSON.stringify(req.body, null, 2),
      metadata: metadata || req.body,
      status: status === 'resolved' ? 'resolved' : 'firing',
      host,
    };

    const processed = processNormalizedAlert(alert, 'Generic');

    res.json({
      success: true,
      message: `Generic alert ${processed.status === 'resolved' ? 'resolved' : 'created'}`,
      data: processed,
    });
  } catch (error) {
    logger.error('Generic webhook error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
