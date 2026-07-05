import { logger } from '../../../utils/logger';
import { env } from '../../../utils/env';
import { settingsRepository, alertRepository } from '../../../repositories';
import { rcaRepository } from '../../ai/services/rca/rootCauseAnalysisService/rcaRepository';
import { rootCauseAnalysisService } from '../../ai/services/rca/rootCauseAnalysisService';
import { circuitBreakers } from '../../ai/services/llm/llmService';
import { credentialService } from '../../auth/services/credentialService';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertChannel = 'email' | 'webhook' | 'log';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: string;
  threshold: number;
  enabled: boolean;
  channels: AlertChannel[];
  cooldownMs: number;
  lastTriggered?: number;
}

export interface AlertNotification {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  channels: AlertChannel[];
  metadata?: unknown;
}

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'high-memory-usage',
    name: 'High Memory Usage',
    description: 'System memory usage exceeds threshold',
    severity: 'critical',
    condition: 'memory_percent',
    threshold: 90,
    enabled: true,
    channels: ['log', 'webhook'],
    cooldownMs: 300000
  },
  {
    id: 'high-cpu-usage',
    name: 'High CPU Usage',
    description: 'CPU usage exceeds threshold',
    severity: 'warning',
    condition: 'cpu_percent',
    threshold: 85,
    enabled: true,
    channels: ['log'],
    cooldownMs: 300000
  },
  {
    id: 'database-slow',
    name: 'Slow Database Response',
    description: 'Database response time exceeds threshold',
    severity: 'critical',
    condition: 'db_latency',
    threshold: 1000,
    enabled: true,
    channels: ['log', 'webhook'],
    cooldownMs: 60000
  },
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Error rate exceeds threshold',
    severity: 'critical',
    condition: 'error_rate',
    threshold: 10,
    enabled: true,
    channels: ['log', 'webhook'],
    cooldownMs: 300000
  },
  {
    id: 'disk-space-low',
    name: 'Low Disk Space',
    description: 'Available disk space below threshold',
    severity: 'warning',
    condition: 'disk_percent',
    threshold: 90,
    enabled: true,
    channels: ['log'],
    cooldownMs: 600000
  }
];

export class AlertService {
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: AlertNotification[] = [];
  private maxHistorySize = 1000;
  private webhookUrl = '';
  private emailConfig?: { host: string; port: number; user: string; pass: string; to: string };
  private initialized = false;

  constructor() {
    this.loadCredentials();
    // 延迟初始化，等待数据库准备就绪
  }

  private loadCredentials(): void {
    this.webhookUrl = env.ALERT_WEBHOOK_URL || '';
    
    // Check credential service for overrides (values set through UI)
    try {
      const credWebhook = credentialService.getCredential('alert_webhook');
      if (credWebhook) {
        this.webhookUrl = credWebhook;
      }
      
      const emailCredStr = credentialService.getCredential('alert_email');
      if (emailCredStr) {
        try {
          const emailCred = JSON.parse(emailCredStr);
          this.emailConfig = {
            host: emailCred.host || env.ALERT_EMAIL_HOST || '',
            port: emailCred.port ? parseInt(emailCred.port, 10) : (env.ALERT_EMAIL_PORT || 587),
            user: emailCred.user || env.ALERT_EMAIL_USER || '',
            pass: emailCred.pass || env.ALERT_EMAIL_PASS || '',
            to: emailCred.to || env.ALERT_EMAIL_TO || ''
          };
        } catch {
          // Not a valid JSON, fall back to env
          if (env.ALERT_EMAIL_HOST) {
            this.emailConfig = {
              host: env.ALERT_EMAIL_HOST,
              port: env.ALERT_EMAIL_PORT || 587,
              user: env.ALERT_EMAIL_USER || '',
              pass: env.ALERT_EMAIL_PASS || '',
              to: env.ALERT_EMAIL_TO || ''
            };
          }
        }
      } else if (env.ALERT_EMAIL_HOST) {
        this.emailConfig = {
          host: env.ALERT_EMAIL_HOST,
          port: env.ALERT_EMAIL_PORT || 587,
          user: env.ALERT_EMAIL_USER || '',
          pass: env.ALERT_EMAIL_PASS || '',
          to: env.ALERT_EMAIL_TO || ''
        };
      }
    } catch {
      // Credential service not available yet, use env as fallback
      if (env.ALERT_EMAIL_HOST) {
        this.emailConfig = {
          host: env.ALERT_EMAIL_HOST,
          port: env.ALERT_EMAIL_PORT || 587,
          user: env.ALERT_EMAIL_USER || '',
          pass: env.ALERT_EMAIL_PASS || '',
          to: env.ALERT_EMAIL_TO || ''
        };
      }
    }
  }

  init(): void {
    if (!this.initialized) {
      this.loadRules();
      this.initialized = true;
      logger.info('AlertService initialized');
    }
  }

  private loadRules(): void {
    try {
      const saved = settingsRepository.getValue('alert_rules');
      if (saved) {
        const rules = JSON.parse(saved) as AlertRule[];
        rules.forEach(rule => this.rules.set(rule.id, rule));
      }
    } catch (error) {
      logger.warn('Failed to load alert rules, using defaults', { error: error instanceof Error ? error.message : String(error) });
    }

    if (this.rules.size === 0) {
      DEFAULT_ALERT_RULES.forEach(rule => this.rules.set(rule.id, rule));
      this.saveRules();
    }
  }

  private saveRules(): void {
    const rules = Array.from(this.rules.values());
    const json = JSON.stringify(rules);
    settingsRepository.upsert('alert_rules', json);
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  addRule(rule: AlertRule): AlertRule {
    this.rules.set(rule.id, rule);
    this.saveRules();
    logger.info(`Alert rule added: ${rule.name}`, { ruleId: rule.id });
    return rule;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    this.saveRules();
    logger.info(`Alert rule updated: ${updatedRule.name}`, { ruleId });
    return updatedRule;
  }

  deleteRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.saveRules();
      logger.info(`Alert rule deleted: ${ruleId}`);
    }
    return deleted;
  }

  async checkAlerts(metrics: {
    memoryPercent?: number;
    cpuPercent?: number;
    dbLatency?: number;
    errorRate?: number;
    diskPercent?: number;
    [key: string]: number | undefined;
  }): Promise<AlertNotification[]> {
    const triggeredAlerts: AlertNotification[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const value = metrics[rule.condition];
      if (value === undefined) continue;

      if (value >= rule.threshold) {
        const now = Date.now();
        if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldownMs) {
          continue;
        }

        const alert = await this.triggerAlert(rule, value, metrics);
        triggeredAlerts.push(alert);

        rule.lastTriggered = now;
        this.rules.set(rule.id, rule);
      }
    }

    this.saveRules();
    return triggeredAlerts;
  }

  private async triggerAlert(
    rule: AlertRule,
    value: number,
    metrics: Record<string, number | undefined>
  ): Promise<AlertNotification> {
    const alert: AlertNotification = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.name}: Current value ${value} exceeds threshold ${rule.threshold}`,
      timestamp: new Date().toISOString(),
      channels: rule.channels,
      metadata: {
        condition: rule.condition,
        currentValue: value,
        threshold: rule.threshold,
        allMetrics: metrics
      }
    };

    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
    }

    await this.sendNotification(alert);

    logger.error(`Alert triggered: ${rule.name}`, undefined, {
      severity: rule.severity,
      value,
      threshold: rule.threshold
    });

    return alert;
  }

  private async sendNotification(alert: AlertNotification): Promise<void> {
    const promises: Promise<void>[] = [];

    if (alert.channels.includes('log')) {
      promises.push(this.sendToLog(alert));
    }

    if (alert.channels.includes('webhook') && this.webhookUrl) {
      promises.push(this.sendToWebhook(alert));
    }

    if (alert.channels.includes('email') && this.emailConfig) {
      promises.push(this.sendToEmail(alert));
    }

    await Promise.allSettled(promises);
  }

  private async sendToLog(alert: AlertNotification): Promise<void> {
    const logMessage = `[ALERT] ${alert.severity.toUpperCase()} - ${alert.message}`;
    
    switch (alert.severity) {
      case 'critical':
        logger.error(logMessage, undefined, alert.metadata);
        break;
      case 'warning':
        logger.warn(logMessage, alert.metadata);
        break;
      case 'info':
        logger.info(logMessage, alert.metadata);
        break;
    }
  }

  private async sendToWebhook(alert: AlertNotification): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert_id: alert.id,
          rule_name: alert.ruleName,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp,
          metadata: alert.metadata
        })
      });

      if (!response.ok) {
        logger.warn(`Webhook notification failed: ${response.status}`, {
          alertId: alert.id
        });
      }
    } catch (error) {
      logger.error('Failed to send webhook notification', { error: error instanceof Error ? error.message : String(error) }, {
        alertId: alert.id
      });
    }
  }

  private async sendToEmail(alert: AlertNotification): Promise<void> {
    if (!this.emailConfig) return;

    try {
      const nodemailer = await import('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: this.emailConfig.host,
        port: this.emailConfig.port,
        secure: this.emailConfig.port === 465,
        auth: {
          user: this.emailConfig.user,
          pass: this.emailConfig.pass
        }
      });

      const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      await transporter.sendMail({
        from: this.emailConfig.user,
        to: this.emailConfig.to,
        subject: `[${alert.severity.toUpperCase()}] ${alert.ruleName}`,
        text: alert.message,
        html: `
          <h2>System Alert</h2>
          <p><strong>Rule:</strong> ${escapeHtml(alert.ruleName)}</p>
          <p><strong>Severity:</strong> ${escapeHtml(alert.severity.toUpperCase())}</p>
          <p><strong>Message:</strong> ${escapeHtml(alert.message)}</p>
          <p><strong>Time:</strong> ${escapeHtml(alert.timestamp)}</p>
          ${alert.metadata ? `<pre>${escapeHtml(JSON.stringify(alert.metadata, null, 2))}</pre>` : ''}
        `
      });
    } catch (error) {
      logger.error('Failed to send email notification', error as Error, {
        alertId: alert.id
      });
    }
  }

  getHistory(limit = 50): AlertNotification[] {
    return this.alertHistory.slice(0, limit);
  }

  getStats(): {
    totalAlerts: number;
    bySeverity: Record<AlertSeverity, number>;
    last24Hours: number;
    topRules: { ruleId: string; ruleName: string; count: number }[];
  } {
    const now = Date.now();
    const oneDayAgo = now - 86400000;

    const bySeverity: Record<AlertSeverity, number> = {
      critical: 0,
      warning: 0,
      info: 0
    };

    const ruleCounts: Map<string, { name: string; count: number }> = new Map();
    let last24Hours = 0;

    this.alertHistory.forEach(alert => {
      bySeverity[alert.severity]++;
      
      if (new Date(alert.timestamp).getTime() > oneDayAgo) {
        last24Hours++;
      }

      const existing = ruleCounts.get(alert.ruleId);
      if (existing) {
        existing.count++;
      } else {
        ruleCounts.set(alert.ruleId, { name: alert.ruleName, count: 1 });
      }
    });

    const topRules = Array.from(ruleCounts.entries())
      .map(([ruleId, data]) => ({ ruleId, ruleName: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalAlerts: this.alertHistory.length,
      bySeverity,
      last24Hours,
      topRules
    };
  }

  clearHistory(): void {
    this.alertHistory = [];
    logger.info('Alert history cleared');
  }

  processDatabaseAlert(alertId: string): void {
    const alert = alertRepository.getSummaryById(alertId);

    if (!alert) {
      logger.warn(`⚠️ [AlertService] Alert not found for RCA trigger: ${alertId}`);
      return;
    }

    if (alert.severity === 'critical' || alert.severity === 'high' || alert.severity === 'warning') {
      setImmediate(async () => {
        try {
          const existingRCA = rcaRepository.getByAlert(alert.id);

          if (existingRCA && existingRCA.status !== 'failed') {
            logger.info(`⏭️ [AlertService] Skipping RCA for alert ${alertId} - already analyzed (existing RCA: ${existingRCA.id})`);
            return;
          }

          const openBreakers = [];
          for (const [name, breaker] of circuitBreakers.entries()) {
            if (!breaker.canCall()) {
              openBreakers.push(name);
            }
          }

          if (openBreakers.length > 0) {
            logger.warn(`⚠️ [AlertService] LLM circuit breakers are open: ${openBreakers.join(', ')}. RCA will rely more on rule engine fallback.`);
          }

          logger.info(`🔔 [AlertService] Auto-triggering RCA for alert: ${alertId} (severity: ${alert.severity})`);
          await rootCauseAnalysisService.autoAnalyze(alert.id);
        } catch (error) {
          logger.error(`❌ [AlertService] Failed to auto-analyze alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });
    }
  }
}

export const alertService = new AlertService();

// 导出 init 函数供 app.ts 调用
export const initAlertService = () => alertService.init();
