import type { Request } from 'express';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { getIOInstance } from '../../../shared/websocket/io';
import { emitToAlerts } from '../../../shared/websocket/handler';
import { logger } from '../../../utils/logger';
import { env } from '../../../utils/env';
import { createAuditLog } from '../../audit/services/auditService';
import { createNotification } from '../../notification/services/notificationService';
import { alertService } from './alertService';
import { alertProcessor } from './AlertProcessor';
import { alertDeviceResolver } from './alertDeviceResolver';
import { alertCrudService } from './alertCrudService';
import type { AlertAdapterResult, NormalizedAlert } from './alertSourceAdapters';

// ============================================================================
//  类型定义
// ============================================================================

interface WebhookSignatureConfig {
  mode: 'true' | 'false' | 'warn';
  secret?: string;
  headerName: string;
  algorithm?: string;
}

export interface ProcessedAlert {
  alertId: string;
  taskId: string | null;
  executionIds: string[];
  status: 'created' | 'resolved';
}

export interface WebhookResult {
  success: boolean;
  httpStatus: number;
  response: {
    success: boolean;
    message?: string;
    data?: unknown;
    error?: string;
  };
}

// ============================================================================
//  常量
// ============================================================================

const PLACEHOLDER_SECRETS = new Set(['your-webhook-secret-key-change-me', '']);

// ============================================================================
//  WebhookService 实现
// ============================================================================

class WebhookService {
  constructor() {
    this.validateConfig();
  }

  // --------------------------------------------------------------------------
  //  配置 & 签名验证
  // --------------------------------------------------------------------------

  /**
   * 启动时校验配置，若模式与密钥不匹配则抛错或告警
   */
  private validateConfig(): void {
    const mode = env.WEBHOOK_VERIFY_ENABLED;
    const secret = env.WEBHOOK_SECRET;
    if (mode === 'false') {
      logger.warn(
        'Webhook signature verification is DISABLED. Only use in isolated test environments.',
      );
      return;
    }
    if (!secret || PLACEHOLDER_SECRETS.has(secret)) {
      if (mode === 'true') {
        throw new Error(
          'WEBHOOK_VERIFY_ENABLED=true requires WEBHOOK_SECRET to be set to a non-placeholder value. ' +
            'Generate one with: openssl rand -hex 32. ' +
            'For backward compatibility with unsigned senders, set WEBHOOK_VERIFY_ENABLED=warn.',
        );
      }
      logger.warn(
        'WEBHOOK_VERIFY_ENABLED=warn but WEBHOOK_SECRET is missing/placeholder. ' +
          'Signature will not be validated; unsigned requests will be accepted with a warning. ' +
          'Set WEBHOOK_SECRET (openssl rand -hex 32) to fully enable verification.',
      );
    }
  }

  private getConfig(source: string): WebhookSignatureConfig {
    return {
      mode: env.WEBHOOK_VERIFY_ENABLED,
      secret: env.WEBHOOK_SECRET,
      headerName: `X-Webhook-Signature-${source}`,
      algorithm: 'sha256',
    };
  }

  /**
   * 验证 webhook 签名（HMAC-SHA256 + timingSafeEqual）
   * - mode=false: 直接放行
   * - mode=warn:  缺失签名时记录审计日志后放行；签名错误仍拒绝
   * - mode=true:  缺失或错误均拒绝
   */
  verifySignature(req: Request, source: string): boolean {
    const config = this.getConfig(source);

    if (config.mode === 'false') {
      return true;
    }

    const secret =
      config.secret && !PLACEHOLDER_SECRETS.has(config.secret) ? config.secret : undefined;
    if (!secret) {
      if (config.mode === 'warn') {
        logger.warn(
          `Webhook from ${source} accepted without signature (mode=warn, no secret configured). IP=${req.ip}`,
        );
        createAuditLog({
          action: 'webhook_signature_skipped',
          resource_type: 'webhook',
          details: { source, ip: req.ip ?? '', reason: 'warn_mode_no_secret' },
        });
        return true;
      }
      return false;
    }

    const signature = req.headers[config.headerName.toLowerCase()] as string;
    if (!signature) {
      if (config.mode === 'warn') {
        logger.warn(
          `Webhook from ${source} accepted without signature header (mode=warn). IP=${req.ip}`,
        );
        createAuditLog({
          action: 'webhook_signature_skipped',
          resource_type: 'webhook',
          details: { source, ip: req.ip ?? '', reason: 'warn_mode_no_header' },
        });
        return true;
      }
      return false;
    }

    // 优先使用原始 body 字节流计算签名（标准 webhook 签名实践）
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.warn(
        'rawBody not available, falling back to JSON.stringify for signature verification',
      );
    }
    const bodyForSigning = rawBody ?? Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac(config.algorithm || 'sha256', secret)
      .update(bodyForSigning)
      .digest('hex');

    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  // --------------------------------------------------------------------------
  //  日志记录
  // --------------------------------------------------------------------------

  logInvocation(
    source: string,
    status: 'success' | 'error',
    alertCount: number,
    resolvedCount: number,
    errorMessage?: string,
    req?: Request,
    processingTimeMs?: number,
  ): void {
    try {
      const id = randomUUID();
      alertCrudService.logWebhookInvocation({
        id,
        source,
        status,
        alert_count: alertCount,
        resolved_count: resolvedCount,
        error_message: errorMessage || null,
        ip_address: req?.ip || null,
        user_agent: (req?.headers['user-agent'] as string) || null,
        processing_time_ms: processingTimeMs || null,
      });
    } catch (e) {
      logger.debug('Failed to log webhook invocation:', e);
    }
  }

  // --------------------------------------------------------------------------
  //  告警处理流水线
  // --------------------------------------------------------------------------

  /**
   * 处理单个标准化告警：创建告警 + 触发修复流水线 + 发送通知 + 写审计日志 + 推送 WS
   */
  processNormalizedAlert(alert: NormalizedAlert, sourceLabel: string): ProcessedAlert {
    const io = getIOInstance();

    if (alert.status === 'resolved') {
      let updated = 0;
      if (alert.external_id) {
        updated = alertCrudService.resolveAutoByExternalId(
          `Auto-resolved by ${sourceLabel}`,
          alert.external_id,
        );
      }
      if (updated === 0 && alert.host) {
        alertCrudService.resolveAutoByHost(
          `Auto-resolved by ${sourceLabel}`,
          alert.source,
          alert.host,
        );
      }

      createAuditLog({
        action: 'alert_auto_resolved',
        resource_type: 'alert',
        details: { source: alert.source, title: alert.title, host: alert.host ?? '' },
      });

      if (io) {
        io.emit('alert:resolved', {
          source: alert.source,
          title: alert.title,
          host: alert.host ?? '',
        });
      }

      return { alertId: '', taskId: null, executionIds: [], status: 'resolved' };
    }

    const id = randomUUID();
    const severity = alert.severity as 'critical' | 'high' | 'medium' | 'low' | 'info';
    const title = alert.title;
    const content = alert.content;

    alertCrudService.createAlertFromWebhook({
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
            alertId: id,
            title,
            timestamp: new Date().toISOString(),
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
            alertDeviceResolver.saveAssociation(
              id,
              assoc.device_type,
              assoc.device_id,
              assoc.match_method,
              assoc.confidence,
            );
          }
        } catch (error) {
          logger.error(
            `[Webhook] 告警设备关联失败: ${error instanceof Error ? error.message : error}`,
          );
        }

        // ── 统一告警处理入口（AARS + 工作流 智能决策）──
        alertProcessor
          .processAlert({
            alertId: id,
            title,
            content: alert.content,
            severity,
            source: alert.source,
            metadata: {
              tags: alert.metadata?.tags || [],
              host: alert.host,
              rawSeverity: alert.raw_severity,
            },
          })
          .then((result) => {
            if (result.success && result.executionId) {
              executionIds.push(result.executionId);
            }
            logger.info(`[Webhook] 统一处理完成: ${result.strategy}, success=${result.success}`);
          })
          .catch((err: Error) => {
            logger.error(`[Webhook] AlertProcessor failed for ${id}:`, err);
          });

        if (io) {
          emitToAlerts(io, 'remediation:completed', {
            alertId: id,
            totalPolicies: matchedPolicies.length,
            timestamp: new Date().toISOString(),
          });
        }

        if (matchedPolicies.length > 0) {
          logger.info(
            `✅ [Webhook] 已触发 ${matchedPolicies.length} 个修复策略 (alert: ${id}, executions: ${executionIds.join(',')})`,
          );
        }
      } catch (error) {
        logger.error(
          `❌ [Webhook] 修复流水线异常: ${error instanceof Error ? error.message : error}`,
        );
        if (io) {
          emitToAlerts(io, 'remediation:error', {
            alertId: id,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
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
      details: {
        source: alert.source,
        severity,
        rawSeverity: alert.raw_severity ?? '',
        title,
        executionIds: executionIds.join(', '),
      },
    });

    if (io) {
      io.emit('alert:new', {
        id,
        source: alert.source,
        severity,
        title,
        content,
        executionIds,
        host: alert.host ?? '',
      });
    }

    return { alertId: id, taskId: executionIds[0] || null, executionIds, status: 'created' };
  }

  /**
   * 批量处理告警数组，返回每个告警的处理结果
   */
  processAlertsBatch(alerts: NormalizedAlert[], sourceLabel: string): ProcessedAlert[] {
    return alerts.map((alert) => this.processNormalizedAlert(alert, sourceLabel));
  }

  // --------------------------------------------------------------------------
  //  高层封装：完整 webhook 请求处理流程
  // --------------------------------------------------------------------------

  /**
   * 处理标准 webhook 请求（签名验证 + 适配器调用 + 告警处理 + 日志记录）
   * 适用于: prometheus / zabbix / grafana / aliyun / tencent
   */
  handleStandardWebhook(
    req: Request,
    source: string,
    sourceLabel: string,
    adapter: (body: unknown) => AlertAdapterResult,
  ): WebhookResult {
    const startTime = Date.now();
    try {
      logger.info(`Webhook invocation: /${source} from ${req.ip}`);

      if (!this.verifySignature(req, source)) {
        createAuditLog({
          action: 'webhook_signature_failed',
          resource_type: 'webhook',
          details: { source, ip: req.ip ?? '' },
        });
        this.logInvocation(source, 'error', 0, 0, 'Invalid signature', req, Date.now() - startTime);
        return {
          success: false,
          httpStatus: 401,
          response: { success: false, error: 'Invalid webhook signature' },
        };
      }

      const result = adapter(req.body);
      if (result.errors.length > 0) {
        logger.warn(`${sourceLabel} adapter errors:`, result.errors);
      }

      const processed = this.processAlertsBatch(result.alerts, sourceLabel);
      const created = processed.filter((p) => p.status === 'created').length;
      const resolved = processed.filter((p) => p.status === 'resolved').length;

      this.logInvocation(
        source,
        'success',
        result.alerts.length,
        resolved,
        undefined,
        req,
        Date.now() - startTime,
      );

      return {
        success: true,
        httpStatus: 200,
        response: {
          success: true,
          message: `Processed ${result.alerts.length} alerts (${created} new, ${resolved} resolved)`,
          data: { processed },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`${sourceLabel} webhook error:`, error);
      this.logInvocation(source, 'error', 0, 0, errorMessage, req, Date.now() - startTime);
      return {
        success: false,
        httpStatus: 500,
        response: { success: false, error: errorMessage },
      };
    }
  }
}

export const webhookService = new WebhookService();
