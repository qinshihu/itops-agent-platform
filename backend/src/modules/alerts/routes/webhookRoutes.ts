import type { Request, Response } from 'express';
import { Router, json as expressJson } from 'express';
import { getIOInstance } from '../../../shared/websocket/io';
import { logger } from '../../../utils/logger';
import { randomUUID } from 'crypto';
import { createAuditLog } from '../../infra/services/auditService';
import { createNotification } from '../../notification/routes/notificationRoutes';
import { alertService } from '../services/alertService';
import { env } from '../../../utils/env';
import crypto from 'crypto';
import type {
  NormalizedAlert} from '../services/alertSourceAdapters';
import {
  adaptPrometheus,
  adaptZabbix,
  adaptGrafana,
  adaptAliyun,
  adaptTencentCloud,
  detectSourceType
} from '../services/alertSourceAdapters';
import { alertDeviceResolver } from '../services/alertDeviceResolver';
import { alertProcessor } from '../services/AlertProcessor';
import { emitToAlerts } from '../../../shared/websocket/handler';
import { validateBody } from '../../../middleware/validation';
import { z } from 'zod';
import { alertRepository } from '../../../repositories';

const router = Router();

// 捕获原始 body 字节流用于签名验证（必须在 JSON 解析之前注册）
router.use(expressJson({
  verify: (req: Request, _res, buf: Buffer) => {
    // 保存原始 body 字节流，供 verifyWebhookSignature 使用
    (req as Request & { rawBody?: Buffer }).rawBody = buf;
  },
}));

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
    alertRepository.webhookLogs.logInvocation({
      id,
      source,
      status,
      alert_count: alertCount,
      resolved_count: resolvedCount,
      error_message: errorMessage || null,
      ip_address: req?.ip || null,
      user_agent: req?.headers['user-agent'] as string || null,
      processing_time_ms: processingTimeMs || null,
    });
  } catch (e) {
    logger.debug('Failed to log webhook invocation:', e);
  }
}

interface WebhookSignatureConfig {
  mode: 'true' | 'false' | 'warn';
  secret?: string;
  headerName: string;
  algorithm?: string;
}

/**
 * ⚠️ 安全警告 (SECURITY WARNING)
 *
 * Webhook 签名验证默认开启（secure by default）。
 * 通过 env.WEBHOOK_VERIFY_ENABLED 控制三种模式：
 *   - 'true'  (默认): 强制校验签名，缺失或错误均拒绝
 *   - 'warn'        : 缺失签名放行但记录 WARN 审计日志，签名错误仍拒绝
 *   - 'false'       : 完全关闭校验（仅用于隔离测试环境）
 *
 * 未启用签名验证的风险：
 *   - 恶意告警注入，触发错误的自动工作流
 *   - 虚假告警恢复，掩盖真实故障
 *   - 拒绝服务攻击（大量伪造告警）
 *
 * 生产环境配置要求：
 *   1. 保持 WEBHOOK_VERIFY_ENABLED=true（默认）
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
  return {
    mode: env.WEBHOOK_VERIFY_ENABLED,
    secret: env.WEBHOOK_SECRET,
    headerName: `X-Webhook-Signature-${source}`,
    algorithm: 'sha256',
  };
}

const PLACEHOLDER_SECRETS = new Set([
  'your-webhook-secret-key-change-me',
  '',
]);

function validateWebhookConfig(): void {
  const mode = env.WEBHOOK_VERIFY_ENABLED;
  const secret = env.WEBHOOK_SECRET;
  if (mode === 'false') {
    logger.warn('Webhook signature verification is DISABLED. Only use in isolated test environments.');
    return;
  }
  if (!secret || PLACEHOLDER_SECRETS.has(secret)) {
    if (mode === 'true') {
      throw new Error(
        'WEBHOOK_VERIFY_ENABLED=true requires WEBHOOK_SECRET to be set to a non-placeholder value. ' +
        'Generate one with: openssl rand -hex 32. ' +
        'For backward compatibility with unsigned senders, set WEBHOOK_VERIFY_ENABLED=warn.'
      );
    }
    logger.warn(
      'WEBHOOK_VERIFY_ENABLED=warn but WEBHOOK_SECRET is missing/placeholder. ' +
      'Signature will not be validated; unsigned requests will be accepted with a warning. ' +
      'Set WEBHOOK_SECRET (openssl rand -hex 32) to fully enable verification.'
    );
  }
}

validateWebhookConfig();

function verifyWebhookSignature(req: Request, source: string): boolean {
  const config = getWebhookConfig(source);

  if (config.mode === 'false') {
    return true;
  }

  const secret = config.secret && !PLACEHOLDER_SECRETS.has(config.secret) ? config.secret : undefined;
  if (!secret) {
    if (config.mode === 'warn') {
      logger.warn(`Webhook from ${source} accepted without signature (mode=warn, no secret configured). IP=${req.ip}`);
      createAuditLog({
        action: 'webhook_signature_skipped',
        resource_type: 'webhook',
        details: { source, ip: req.ip, reason: 'warn_mode_no_secret' },
      });
      return true;
    }
    return false;
  }

  const signature = req.headers[config.headerName.toLowerCase()] as string;
  if (!signature) {
    if (config.mode === 'warn') {
      logger.warn(`Webhook from ${source} accepted without signature header (mode=warn). IP=${req.ip}`);
      createAuditLog({
        action: 'webhook_signature_skipped',
        resource_type: 'webhook',
        details: { source, ip: req.ip, reason: 'warn_mode_no_header' },
      });
      return true;
    }
    return false;
  }

  // 使用原始 body 字节流计算签名（与标准 webhook 签名实践一致）
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    // 如果没有原始 body（中间件未正确注册），回退到 JSON.stringify
    logger.warn('rawBody not available, falling back to JSON.stringify for signature verification');
  }
  
  const bodyForSigning = rawBody ?? Buffer.from(JSON.stringify(req.body));
  const expectedSignature = crypto
    .createHmac(config.algorithm || 'sha256', secret)
    .update(bodyForSigning)
    .digest('hex');

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function processNormalizedAlert(
  alert: NormalizedAlert,
  sourceLabel: string
): { alertId: string; taskId: string | null; executionIds: string[]; status: 'created' | 'resolved' } {
  const io = getIOInstance();

  if (alert.status === 'resolved') {
    let updated = 0;
    if (alert.external_id) {
      updated = alertRepository.resolveAutoByExternalId(`Auto-resolved by ${sourceLabel}`, alert.external_id);
    }

    if (updated === 0 && alert.host) {
      alertRepository.resolveAutoByHost(`Auto-resolved by ${sourceLabel}`, alert.source, alert.host);
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
  const severity = alert.severity as 'critical' | 'high' | 'medium' | 'low' | 'info';
  const title = alert.title;
  const content = alert.content;

  alertRepository.create({
    id,
    source: alert.source,
    severity,
    title,
    content,
    metadata: alert.metadata || {},
  });

  // ============================================================
  //  统一修复流水线: 修复策略匹配 + 设备关联 + RCA + WebSocket
  // ============================================================
  const executionIds: string[] = [];
  const matchedPolicies: string[] = [];
  setImmediate(async () => {
    try {
      if (io) {
        emitToAlerts(io, 'remediation:started', {
          alertId: id, title, timestamp: new Date().toISOString()
        });
      }

      // ── RCA ──
      if (severity === 'critical' || severity === 'high') {
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

      // ── 统一告警处理入口（AARS + 工作流 智能决策）──
      alertProcessor.processAlert({
        alertId: id,
        title,
        content: alert.content,
        severity,
        source: alert.source,
        metadata: { tags: alert.metadata?.tags || [], host: alert.host, rawSeverity: alert.raw_severity }
      }).then((result) => {
        if (result.success && result.executionId) {
          executionIds.push(result.executionId);
        }
        logger.info(`[Webhook] 统一处理完成: ${result.strategy}, success=${result.success}`);
      }).catch((err: Error) => {
        logger.error(`[Webhook] AlertProcessor failed for ${id}:`, err);
      });

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
    details: { source: alert.source, severity, rawSeverity: alert.raw_severity, title, executionIds },
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
    if (!verifyWebhookSignature(req, 'auto')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'auto', ip: req.ip },
      });
      logWebhookInvocation('auto', 'error', 0, 0, 'Invalid signature', req, Date.now() - startTime);
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

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
