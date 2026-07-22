import type { Request, Response } from 'express';
import { Router, json as expressJson } from 'express';
import { logger } from '../../../utils/logger';
import { createAuditLog } from '../../audit/services/auditService';
import type {
  NormalizedAlert,
  AlertAdapterResult,
} from '../services/alertSourceAdapters';
import {
  adaptPrometheus,
  adaptZabbix,
  adaptGrafana,
  adaptAliyun,
  adaptTencentCloud,
  detectSourceType,
} from '../services/alertSourceAdapters';
import { validateBody } from '../../../middleware/validation';
import { z } from 'zod';
import { webhookService } from '../services/webhookService';

const router = Router();

// 捕获原始 body 字节流用于签名验证（必须在 JSON 解析之前注册）
router.use(expressJson({
  verify: (req: Request, _res, buf: Buffer) => {
    // 保存原始 body 字节流，供 webhookService.verifySignature 使用
    (req as Request & { rawBody?: Buffer }).rawBody = buf;
  },
}));

// ============================================================================
//  标准告警源路由（5 个：prometheus / zabbix / grafana / aliyun / tencent）
//  逻辑完全一致，统一通过 webhookService.handleStandardWebhook 处理
// ============================================================================

router.post('/prometheus', (req: Request, res: Response) => {
  const result = webhookService.handleStandardWebhook(req, 'prometheus', 'Prometheus', adaptPrometheus);
  res.status(result.httpStatus).json(result.response);
});

router.post('/zabbix', (req: Request, res: Response) => {
  const result = webhookService.handleStandardWebhook(req, 'zabbix', 'Zabbix', adaptZabbix);
  res.status(result.httpStatus).json(result.response);
});

router.post('/grafana', (req: Request, res: Response) => {
  const result = webhookService.handleStandardWebhook(req, 'grafana', 'Grafana', adaptGrafana);
  res.status(result.httpStatus).json(result.response);
});

router.post('/aliyun', (req: Request, res: Response) => {
  const result = webhookService.handleStandardWebhook(req, 'aliyun', 'Aliyun', adaptAliyun);
  res.status(result.httpStatus).json(result.response);
});

router.post('/tencent', (req: Request, res: Response) => {
  const result = webhookService.handleStandardWebhook(req, 'tencent', 'Tencent', adaptTencentCloud);
  res.status(result.httpStatus).json(result.response);
});

// ============================================================================
//  自动识别路由
// ============================================================================

router.post('/auto', (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    if (!webhookService.verifySignature(req, 'auto')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'auto', ip: req.ip ?? '' },
      });
      webhookService.logInvocation('auto', 'error', 0, 0, 'Invalid signature', req, Date.now() - startTime);
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const detectedType = detectSourceType(req.body);
    logger.info(`Auto-detected alert source: ${detectedType}`);

    const adapterMap: Record<string, (body: unknown) => AlertAdapterResult> = {
      prometheus: adaptPrometheus,
      zabbix: adaptZabbix,
      grafana: adaptGrafana,
      aliyun: adaptAliyun,
      tencent: adaptTencentCloud,
    };
    const adapter = adapterMap[detectedType];
    const result = adapter
      ? adapter(req.body)
      : { alerts: [], errors: [`Unknown alert source type: ${detectedType}`] } as AlertAdapterResult;

    if (result.errors.length > 0) {
      logger.warn(`Auto-detect (${detectedType}) adapter errors:`, result.errors);
    }

    const processed = webhookService.processAlertsBatch(result.alerts, `Auto(${detectedType})`);

    webhookService.logInvocation(`auto_${detectedType}`, 'success', result.alerts.length, 0, undefined, req, Date.now() - startTime);

    res.json({
      success: true,
      message: `Auto-detected source: ${detectedType}, processed ${result.alerts.length} alerts`,
      data: { detectedType, processed },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Auto-detect webhook error:', error);
    webhookService.logInvocation('auto', 'error', 0, 0, errorMessage, req, Date.now() - startTime);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// ============================================================================
//  通用 webhook 路由（手动构造 NormalizedAlert）
// ============================================================================

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
    if (!webhookService.verifySignature(req, 'generic')) {
      createAuditLog({
        action: 'webhook_signature_failed',
        resource_type: 'webhook',
        details: { source: 'generic', ip: req.ip ?? '' },
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

    const processed = webhookService.processNormalizedAlert(alert, 'Generic');

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
