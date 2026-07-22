/**
 * 自监控主服务类（2026-07-21 拆分后精简版）
 *
 * 把原 676 行类方法拆为：
 * - types.ts:     MonitorCheck / SelfMonitorReport (35 行)
 * - config.ts:    MonitorConfig + DEFAULT_CONFIG (45 行)
 * - checks.ts:    9 个检查函数 + 3 个辅助函数（280 行）
 * - index.ts:     barrel (5 行)
 * - selfMonitorService.ts (本文): 主类 lifecycle (~190 行)
 *
 * 拆分原则遵循 architecture.md §3.3.1 + §3.3.1 第 3 条「向后兼容的 import 路径」
 * 上层调用方式不变：`import { selfMonitorService } from './selfMonitorService'` 仍兼容
 */

import { randomUUID } from 'crypto';
import { alertRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { DEFAULT_CONFIG, type MonitorConfig } from './config';
import type { MonitorCheck, SelfMonitorReport } from './types';
import {
  checkDatabase, checkDisk, checkMemory, checkErrorRate,
  checkServices, checkQueue,
  collectAlerts, determineStatus,
} from './checks';

export class SelfMonitorService {
  private config: MonitorConfig = { ...DEFAULT_CONFIG };
  private timer: NodeJS.Timeout | null = null;
  private lastReport: SelfMonitorReport | null = null;
  private alertHistory: SelfMonitorReport['alerts'] = [];
  private maxAlertHistory = 100;
  private startTime = Date.now();
  private isRunning = false;

  /**
   * 初始化自监控服务
   */
  init(config?: Partial<MonitorConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.timer) {
      clearInterval(this.timer);
    }

    // 首次执行：等一个周期间隔后再开始，避免启动期误报
    setTimeout(() => {
      this.runChecks().catch((err) => {
        logger.error('Initial self-monitor check failed', err);
      });

      // 定时执行
      this.timer = setInterval(() => {
        this.runChecks().catch((err) => {
          logger.error('Scheduled self-monitor check failed', err);
        });
      }, this.config.intervalMs);

      if (this.timer) this.timer.unref();
    }, this.config.intervalMs);

    logger.info(`✅ Self-monitor service initialized (first check in ${this.config.intervalMs / 1000}s, interval: ${this.config.intervalMs / 1000}s)`);
  }

  /**
   * 停止自监控服务
   */
  shutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Self-monitor service stopped');
  }

  /**
   * 获取当前配置
   */
  getConfig(): MonitorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.init(); // 重启定时器
  }

  /**
   * 获取最后一次报告
   */
  getLastReport(): SelfMonitorReport | null {
    return this.lastReport;
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(): SelfMonitorReport['alerts'] {
    return [...this.alertHistory];
  }

  /**
   * 执行所有健康检查（公开 API）
   */
  async runChecks(): Promise<SelfMonitorReport> {
    if (this.isRunning) {
      logger.debug('Self-monitor check already in progress, skipping');
      return this.lastReport!;
    }

    this.isRunning = true;
    const report = await this.performAllChecks();
    this.lastReport = report;
    this.isRunning = false;

    // 如果有告警，添加到历史
    if (report.alerts.length > 0) {
      this.alertHistory.push(...report.alerts);
      if (this.alertHistory.length > this.maxAlertHistory) {
        this.alertHistory = this.alertHistory.slice(-this.maxAlertHistory);
      }
    }

    // 记录日志
    if (report.status !== 'healthy') {
      const alertCount = report.alerts.length;
      const failedChecks = Object.entries(report.checks)
        .filter(([, check]) => check.status !== 'pass')
        .map(([name]) => name);

      logger.warn(`Self-monitor status: ${report.status}`, {
        alerts: alertCount,
        failedChecks,
      });

      // ── 自监控告警写入告警中心 ──
      try {
        for (const [key, check] of Object.entries(report.checks)) {
          if (check.status === 'fail') {
            const existing = alertRepository.findActiveBySourceAndTitle('self_monitor', `自监控: ${key} 异常`);

            if (!existing) {
              alertRepository.createSimple({
                id: randomUUID(),
                title: `自监控: ${key} 异常`,
                severity: 'high',
                content: check.message,
                source: 'self_monitor',
                status: 'new',
              });
              logger.warn(`🔄 [SelfMonitor] Created alert for: ${key}`);
            }
          }
        }
      } catch (e) {
        logger.warn('Failed to create self-monitor alert:', e);
      }
    }

    return report;
  }

  /**
   * 调度 6 项检查并汇总 report
   */
  private async performAllChecks(): Promise<SelfMonitorReport> {
    const alerts: SelfMonitorReport['alerts'] = [];
    const timestamp = new Date().toISOString();

    // 并行执行各检查（依赖显式传递 config）
    const [dbCheck, diskCheck, memCheck, errCheck, svcCheck, queueCheck] = await Promise.all([
      checkDatabase(this.config),
      Promise.resolve(checkDisk(this.config)),
      Promise.resolve(checkMemory(this.config)),
      Promise.resolve(checkErrorRate(this.config)),
      checkServices(this.config),
      Promise.resolve(checkQueue()),
    ]);

    const checks: MonitorCheck[] = [dbCheck, diskCheck, memCheck, errCheck, svcCheck, queueCheck];
    const names = ['database', 'disk', 'memory', 'errors', 'services', 'queue'];
    checks.forEach((c, i) => collectAlerts(alerts, names[i], c, timestamp));

    const status = determineStatus(checks);

    return {
      timestamp,
      status,
      uptime: Date.now() - this.startTime,
      checks: {
        database: dbCheck,
        disk: diskCheck,
        memory: memCheck,
        errors: errCheck,
        services: svcCheck,
        queue: queueCheck,
      },
      alerts,
    };
  }
}

// 单例导出（保持与原文件兼容）
export const selfMonitorService = new SelfMonitorService();
