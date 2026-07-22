/**
 * Alert 路由层 CRUD 抽象（v3 报告 P1-5 迁移）
 *
 * 解决问题：路由层（modules/<m>/routes/）直访 Repository 违反 architecture.md §3.2。
 * 本 service 把"参数校验 → repository 调用 → 错误码转换"集中到一处，
 * routes 只负责"取 req → 调 service → 设 res"三件套。
 *
 * 区分：
 *   - alertCrudService（本文件）：CRUD + 校验 + 输入规范化 + 创建业务编排（P2-7 后扩展）
 *   - alertService / AlertProcessor：业务规则、状态机、告警处理流水线
 *   - alertMappingCrudService：alert→workflow 映射配置 CRUD
 *
 * P2-7（2026-07-20）扩展：把 routes/POST `/` 的噪音检查 / fingerprint / 通知派发 / pipeline 触发
 * 全部下沉到 createAlertWithFullPipeline，routes 只调用此方法。
 */
import { randomUUID, createHash } from 'crypto';
import { alertRepository, type AlertRecord, type AlertFilters } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { notificationService } from '../../notification/services/notificationService';
import { alertNoiseReductionService } from './alertNoiseReductionService';
import { runAlertProcessingPipeline, type AlertProcessingContext } from './alertProcessingPipeline';

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const VALID_STATUSES = ['new', 'acknowledged', 'resolved'] as const;

// 2026-07-21 P0-8：替换原 require() 延迟加载模式
import { rootCauseAnalysisService } from '../../ai/services/rca/rootCauseAnalysisService';
import * as alertRepos from '../../../repositories';
function parseFilters(query: { status?: string; severity?: string; limit?: string }): AlertFilters {
  return {
    status: VALID_STATUSES.includes(query.status as 'new')
      ? (query.status as 'new' | 'acknowledged' | 'resolved')
      : undefined,
    severity: VALID_SEVERITIES.includes(query.severity as 'critical')
      ? (query.severity as 'critical' | 'high' | 'medium' | 'low')
      : undefined,
    limit: query.limit ? parseInt(query.limit, 10) : undefined,
  };
}

/** 解析后的统计结构 */
export interface AlertStats {
  byStatus: Array<{ status: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  total: number;
}

export const alertCrudService = {
  // ── 列表 / 详情 ──

  /**
   * 列表查询，自动校验 status/severity/limit 参数
   */
  listAlerts(query: { status?: string; severity?: string; limit?: string }): AlertRecord[] {
    return alertRepository.getAll(parseFilters(query));
  },

  /**
   * 详情查询
   */
  getAlertById(id: string): AlertRecord | undefined {
    return alertRepository.getById(id);
  },

  /**
   * 仅取必填字段（用于告警处理流水线）
   */
  getAlertEssentials(id: string):
    | {
        id: string;
        title: string;
        content: string;
        severity: string;
        source: string;
        metadata?: string;
      }
    | undefined {
    return alertRepository.getEssentialById(id);
  },

  // ── 创建 ──

  /**
   * 创建告警。如果存在唯一约束冲突（重复 fingerprint），返回 { deduped: true }。
   * 业务校验：fingerprint 必须由 routes 已计算好传入。
   */
  createAlert(input: {
    id: string;
    source: string;
    severity: string;
    title: string;
    content: string;
    metadata: Record<string, unknown>;
    related_task_id?: string | null;
    alert_fingerprint: string;
  }):
    | { success: true; alert: AlertRecord }
    | { success: true; deduped: true; fingerprint: string }
    | { success: false; error: string } {
    try {
      const alert = alertRepository.create({
        id: input.id,
        source: input.source,
        severity: input.severity,
        title: input.title,
        content: input.content,
        metadata: input.metadata,
        related_task_id: input.related_task_id,
        alert_fingerprint: input.alert_fingerprint,
      });
      if (!alert) {
        return { success: false, error: 'Repository create returned undefined' };
      }
      return { success: true, alert };
    } catch (err) {
      const error = err as { code?: string };
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        logger.warn('Duplicate alert suppressed by database unique constraint', {
          fingerprint: input.alert_fingerprint,
        });
        return { success: true, deduped: true, fingerprint: input.alert_fingerprint };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /**
   * 创建告警 + 全流程业务编排（P2-7 下沉）
   *
   * routes/POST `/` 应只调用此方法，不再在 routes 层做以下业务逻辑：
   *   1. 噪音检查（alertNoiseReductionService.processAlert）
   *   2. fingerprint 计算（normalizeTitle + normalizeSource + md5）
   *   3. 调用 createAlert
   *   4. 通知派发（notificationService.sendAlertNotification）
   *   5. 异步触发告警处理流水线（runAlertProcessingPipeline）
   *
   * @returns 三种结果：
   *   - { success: true, alert, noiseReduction } 正常创建
   *   - { success: true, deduped: true, noiseReduction } 数据库去重（不创建）
   *   - { success: false, error } 创建失败
   */
  async createAlertWithFullPipeline(input: {
    source?: string;
    severity?: string;
    title: string;
    content?: string;
    metadata?: Record<string, unknown>;
    related_task_id?: string | null;
  }): Promise<
    | {
        success: true;
        alert: AlertRecord;
        noiseReduction: Awaited<ReturnType<typeof alertNoiseReductionService.processAlert>>;
      }
    | {
        success: true;
        deduped: true;
        noiseReduction: Awaited<ReturnType<typeof alertNoiseReductionService.processAlert>>;
      }
    | { success: false; error: string }
  > {
    const { source, severity, title, content, metadata, related_task_id } = input;

    // 1. 噪音检查
    const noiseReduction = await alertNoiseReductionService.processAlert(
      source || 'unknown',
      title,
      content,
      severity,
    );

    // 2. fingerprint 计算
    const id = randomUUID();
    const normalizedTitle = title
      .toLowerCase()
      .replace(/[\d\s_-]+/g, ' ')
      .trim();
    const normalizedSource = (source || 'unknown').toLowerCase();
    const fingerprint = createHash('md5')
      .update(`${normalizedSource}:${normalizedTitle}`)
      .digest('hex');

    // 3. 调用 createAlert
    const result = this.createAlert({
      id,
      source: source || 'unknown',
      severity: severity || 'medium',
      title,
      content: content || '',
      metadata: metadata || {},
      related_task_id,
      alert_fingerprint: fingerprint,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    if ('deduped' in result) {
      return { success: true, deduped: true, noiseReduction };
    }
    const alert = result.alert;

    // 4. 通知派发
    if (noiseReduction.shouldNotify) {
      notificationService.sendAlertNotification(alert).catch((err) => {
        logger.error('Failed to send alert notification:', err);
      });
    }

    // 5. 异步触发告警处理流水线
    setImmediate(() =>
      runAlertProcessingPipeline({
        id,
        source: source || 'unknown',
        severity: severity || 'medium',
        rawSeverity: typeof metadata?.raw_severity === 'string' ? metadata.raw_severity : undefined,
        title,
        content: content || '',
        tags: metadata?.tags ? (Array.isArray(metadata.tags) ? metadata.tags : []) : [],
      } as AlertProcessingContext),
    );

    return { success: true, alert, noiseReduction };
  },

  // ── 状态变更 ──

  /**
   * 确认告警（acknowledged）
   */
  acknowledgeAlert(
    id: string,
  ): { success: true; alert: AlertRecord } | { success: false; error: 'not_found' | string } {
    const existing = alertRepository.getById(id);
    if (!existing) return { success: false, error: 'not_found' };
    const alert = alertRepository.acknowledge(id);
    if (!alert) return { success: false, error: 'Failed to acknowledge alert' };
    return { success: true, alert };
  },

  /**
   * 确认告警 + 通知派发（P2-7 下沉，routes PUT /:id/acknowledge 应调用此方法）
   */
  acknowledgeAlertWithNotification(
    id: string,
  ): { success: true; alert: AlertRecord } | { success: false; error: 'not_found' | string } {
    const result = this.acknowledgeAlert(id);
    if (result.success) {
      notificationService
        .sendSystemNotification('告警已确认', `告警 "${result.alert.title}" 已确认处理`)
        .catch((err) => logger.error('Failed to send ack notification:', err));
    }
    return result;
  },

  /**
   * 解决告警（resolved）
   */
  resolveAlert(
    id: string,
  ): { success: true; alert: AlertRecord } | { success: false; error: 'not_found' | string } {
    const existing = alertRepository.getById(id);
    if (!existing) return { success: false, error: 'not_found' };
    const alert = alertRepository.resolve(id);
    if (!alert) return { success: false, error: 'Failed to resolve alert' };
    return { success: true, alert };
  },

  /**
   * 解决告警 + 通知派发（P2-7 下沉，routes PUT /:id/resolve 应调用此方法）
   */
  resolveAlertWithNotification(
    id: string,
  ): { success: true; alert: AlertRecord } | { success: false; error: 'not_found' | string } {
    const result = this.resolveAlert(id);
    if (result.success) {
      notificationService
        .sendSystemNotification('告警已解决', `告警 "${result.alert.title}" 已解决`)
        .catch((err) => logger.error('Failed to send resolve notification:', err));
    }
    return result;
  },

  // ── 删除 ──

  /**
   * 删除告警（需 admin/operator 角色校验已在 routes 层 requireRole）
   */
  deleteAlert(id: string): { success: true } | { success: false; error: 'not_found' | string } {
    const existing = alertRepository.getById(id);
    if (!existing) return { success: false, error: 'not_found' };
    alertRepository.deleteAlert(id);
    return { success: true };
  },

  // ── 手动触发告警处理（P2-7 下沉） ──

  /**
   * 手动触发告警处理（同步匹配 + 异步执行）
   *
   * routes POST /:id/process 应只调用此方法，不再做以下业务逻辑：
   *   1. metadata JSON 解析（含 tags / rawSeverity 提取）
   *   2. alertProcessor.processAlert 调用
   *   3. RCA 后台异步触发（isSettingEnabled 判定）
   *
   * @returns 三种结果：
   *   - { status: 404 } 告警不存在
   *   - { status: 200, success, message, data } 处理结果
   *   - { status: 500, error } 内部错误
   */
  async processAlertManually(id: string): Promise<
    | { status: 404 }
    | {
        status: 200;
        success: boolean;
        message: string;
        data: {
          alertId: string;
          strategy: string;
          executionId?: string;
          error?: string | null;
        };
      }
    | { status: 500; error: string }
  > {
    const alert = this.getAlertEssentials(id);
    if (!alert) return { status: 404 };

    const source = alert.source || 'unknown';
    const severity = (alert.severity || 'medium') as AlertProcessingContext['severity'];
    const title = alert.title;
    const content = alert.content || '';

    // 1. metadata 解析（提取 tags / rawSeverity）
    let tags: string[] = [];
    let rawSeverity: string | undefined;
    if (alert.metadata) {
      try {
        const meta = JSON.parse(alert.metadata) as Record<string, unknown>;
        tags = Array.isArray(meta.tags) ? meta.tags : [];
        rawSeverity =
          typeof meta.raw_severity === 'string'
            ? meta.raw_severity
            : typeof meta.zabbix_raw_severity === 'string'
              ? meta.zabbix_raw_severity
              : undefined;
      } catch {
        /* ignore */
      }
    }

    // 2. 调用 alertProcessor（动态 import 避免循环依赖）
    let processResult: {
      success: boolean;
      strategy: string;
      executionId?: string;
      taskId?: string;
      errorMessage?: string;
    } | null = null;
    let errorMsg: string | null = null;

    try {
      const { alertProcessor } = await import('./AlertProcessor');
      processResult = await alertProcessor.processAlert({
        alertId: id,
        title,
        content,
        severity,
        source,
        metadata: { tags, rawSeverity },
      });
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      logger.error('Manual process alert error:', e);
    }

    // 3. RCA 后台异步触发
    setImmediate(() => {
      if (this.isSettingEnabled('auto_root_cause_enabled')) {
        // 2026-07-21 P0-8：原 require() 改成顶层静态 import
        rootCauseAnalysisService.analyzeByAlert(id, title, content).catch((err) => {
          logger.error('Failed to auto-trigger RCA for alert:', err);
        });
      }
    });

    return {
      status: 200,
      success: processResult?.success ?? false,
      message: errorMsg
        ? `处理出错: ${errorMsg}`
        : `处理完成：使用 ${processResult?.strategy ?? 'unknown'} 策略`,
      data: {
        alertId: id,
        strategy: processResult?.strategy ?? 'unknown',
        executionId: processResult?.executionId || processResult?.taskId,
        error: errorMsg || processResult?.errorMessage,
      },
    };
  },

  // ── 统计 ──

  /**
   * 统计：按状态、按严重度
   */
  getStats(): AlertStats {
    const { byStatus, bySeverity } = alertRepository.getStatsByStatusAndSeverity();
    return {
      byStatus,
      bySeverity,
      total: byStatus.reduce((sum: number, s) => sum + s.count, 0),
    };
  },

  // ── 自动化日志 ──

  /**
   * 获取告警的自动化执行日志（AARS）
   */
  getAutomationLogs(alertId: string, limit = 100): Array<Record<string, unknown>> {
    return alertRepository.getAutomationLogs(alertId, limit);
  },

  // ── 系统设置桥接（避免 routes 直访 settingsRepository） ──

  /**
   * 读取全局 boolean 设置项（统一用 'true'/'false' 字符串约定）
   * 用于"自动根因分析是否启用"等跨模块配置。
   */
  isSettingEnabled(key: string): boolean {
    // 2026-07-21 P0-8：原 require() dynamic import 改成顶层静态 import（避免循环依赖由 alertRepos 命名空间提供）
    const { settingsRepository } = alertRepos;
    return settingsRepository.getValue(key) === 'true';
  },

  // ── AARS 配置（避免 routes 直访 alertRepository AARS 相关方法） ──

  /**
   * 读取 AARS（告警自动响应）配置
   */
  getAarsConfig(): Record<string, unknown> | undefined {
    return alertRepository.getAarsConfig() as unknown as Record<string, unknown> | undefined;
  },

  /**
   * 更新 AARS 配置（已过滤非法字段）
   */
  updateAarsConfig(fields: Record<string, unknown>): Record<string, unknown> | undefined {
    return alertRepository.updateAarsConfig(
      fields as Parameters<typeof alertRepository.updateAarsConfig>[0],
    ) as unknown as Record<string, unknown> | undefined;
  },

  /**
   * 列出 AARS 探针执行统计
   */
  listProbeStats(limit = 50): Array<Record<string, unknown>> {
    return alertRepository.listProbeStats(limit) as unknown as Array<Record<string, unknown>>;
  },

  // ── 告警简表（用于 AARS / 关联设备匹配等场景） ──

  /**
   * 取告警简表（id/title/severity/content/source）
   */
  getAlertSummary(
    id: string,
  ): { id: string; title: string; severity: string; content: string; source: string } | undefined {
    return alertRepository.getSummaryById(id);
  },

  // ── Webhook 专用：从外部系统接收的告警（无 fingerprint / 无去重） ──

  /**
   * Webhook 入口创建告警（不计算 fingerprint，由源系统负责去重）
   * 用于 Prometheus / Zabbix / 阿里云 / 腾讯云 等 webhook。
   */
  createAlertFromWebhook(input: {
    id: string;
    source: string;
    severity: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): AlertRecord | undefined {
    return alertRepository.create({
      id: input.id,
      source: input.source,
      severity: input.severity,
      title: input.title,
      content: input.content,
      metadata: input.metadata || {},
    });
  },

  /**
   * Webhook 自动解决：通过外部 ID（用于 Prometheus / 腾讯云 / Zabbix auto-resolve 事件）
   * 返回解决的告警行数
   */
  resolveAutoByExternalId(notes: string, externalId: string): number {
    return alertRepository.resolveAutoByExternalId(notes, externalId);
  },

  /**
   * Webhook 自动解决：通过 source + host
   */
  resolveAutoByHost(notes: string, source: string, host: string): number {
    return alertRepository.resolveAutoByHost(notes, source, host);
  },

  // ── Webhook 访问日志 ──

  /**
   * 记录 webhook 调用日志（来自外部 alert source）
   */
  logWebhookInvocation(input: {
    id: string;
    source: string;
    status: 'success' | 'error';
    alert_count: number;
    resolved_count: number;
    error_message?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    processing_time_ms?: number | null;
  }): void {
    alertRepository.webhookLogs.logInvocation(input);
  },
};
