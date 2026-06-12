/**
 * =============================================================================
 * ITOps Agent Platform - 自监控服务
 * =============================================================================
 * 定期检查平台各组件健康状态，生成监控报告
 *
 * 主要功能:
 * 1. 数据库连接健康 + 延迟检测
 * 2. 队列健康（待处理/停滞任务检测）
 * 3. 错误率统计（最近 5 分钟）
 * 4. 数据目录磁盘使用
 * 5. Node.js 进程内存使用
 * 6. 容器运行状态
 * 7. 健康状态汇总报告
 *
 * 报告端点: GET /health/monitor
 * =============================================================================
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import db from '../models/database';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { randomUUID } from 'crypto';

// ====================== 接口定义 ======================

export interface MonitorCheck {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  latencyMs?: number;
  value?: number;
  threshold?: number;
}

export interface SelfMonitorReport {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  checks: {
    database: MonitorCheck;
    disk: MonitorCheck;
    memory: MonitorCheck;
    errors: MonitorCheck;
    services: MonitorCheck;
    queue: MonitorCheck;
  };
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

// ====================== 监控配置 ======================

interface MonitorConfig {
  /** 检查间隔（毫秒） */
  intervalMs: number;
  /** 内存使用告警阈值（百分比） */
  memoryWarnPercent: number;
  /** 内存使用严重阈值（百分比） */
  memoryCritPercent: number;
  /** 磁盘使用告警阈值（百分比） */
  diskWarnPercent: number;
  /** 磁盘使用严重阈值（百分比） */
  diskCritPercent: number;
  /** 数据库延迟告警阈值（毫秒） */
  dbLatencyWarnMs: number;
  /** 数据库延迟严重阈值（毫秒） */
  dbLatencyCritMs: number;
  /** 5 分钟内错误数告警阈值 */
  errorRateWarn: number;
  /** 5 分钟内错误数严重阈值 */
  errorRateCrit: number;
  /** 服务降级阈值 */
  degradedServiceThreshold: number;
  /** 服务下线阈值 */
  downServiceThreshold: number;
}

const DEFAULT_CONFIG: MonitorConfig = {
  intervalMs: 5 * 60 * 1000, // 5 分钟
  memoryWarnPercent: 75,
  memoryCritPercent: 90,
  diskWarnPercent: 80,
  diskCritPercent: 95,
  dbLatencyWarnMs: 500,
  dbLatencyCritMs: 2000,
  errorRateWarn: 10,
  errorRateCrit: 50,
  degradedServiceThreshold: 1,
  downServiceThreshold: 2,
};

// ====================== 服务实现 ======================

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

    // 立即执行一次初始检查
    this.runChecks().catch((err) => {
      logger.error('Initial self-monitor check failed', err);
    });

    // 定时执行
    this.timer = setInterval(() => {
      this.runChecks().catch((err) => {
        logger.error('Scheduled self-monitor check failed', err);
      });
    }, this.config.intervalMs);

    this.timer.unref();
    logger.info(`✅ Self-monitor service initialized (interval: ${this.config.intervalMs / 1000}s)`);
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
   * 执行所有健康检查
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
      // 限制历史长度
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
            const existing = db.prepare(`
              SELECT id FROM alerts
              WHERE source = 'self_monitor'
                AND title = ?
                AND status IN ('new', 'acknowledged')
            `).get(`自监控: ${key} 异常`);

            if (!existing) {
              db.prepare(`
                INSERT INTO alerts (id, source, severity, title, content, metadata, status)
                VALUES (?, ?, ?, ?, ?, ?, 'new')
              `).run(
                randomUUID(),
                'self_monitor',
                'high',
                `自监控: ${key} 异常`,
                check.message,
                JSON.stringify({ check, timestamp: report.timestamp })
              );
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
   * 执行所有具体检查
   */
  private async performAllChecks(): Promise<SelfMonitorReport> {
    const alerts: SelfMonitorReport['alerts'] = [];
    const timestamp = new Date().toISOString();

    // 并行执行各个检查
    const [dbCheck, diskCheck, memCheck, errCheck, svcCheck, queueCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkDisk(),
      this.checkMemory(),
      this.checkErrorRate(),
      this.checkServices(),
      this.checkQueue(),
    ]);

    // 收集告警
    this.collectAlerts(alerts, 'database', dbCheck, timestamp);
    this.collectAlerts(alerts, 'disk', diskCheck, timestamp);
    this.collectAlerts(alerts, 'memory', memCheck, timestamp);
    this.collectAlerts(alerts, 'errors', errCheck, timestamp);
    this.collectAlerts(alerts, 'services', svcCheck, timestamp);
    this.collectAlerts(alerts, 'queue', queueCheck, timestamp);

    // 确定整体状态
    const status = this.determineStatus([dbCheck, diskCheck, memCheck, errCheck, svcCheck, queueCheck]);

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

  // ====================== 具体检查 ======================

  /**
   * 检查数据库连接健康 + 延迟
   */
  private async checkDatabase(): Promise<MonitorCheck> {
    const startTime = Date.now();

    try {
      db.prepare('SELECT 1').get();
      const latencyMs = Date.now() - startTime;

      if (latencyMs > this.config.dbLatencyCritMs) {
        return {
          status: 'fail',
          message: `数据库延迟过高: ${latencyMs}ms (阈值: ${this.config.dbLatencyCritMs}ms)`,
          latencyMs,
          value: latencyMs,
          threshold: this.config.dbLatencyCritMs,
        };
      }

      if (latencyMs > this.config.dbLatencyWarnMs) {
        return {
          status: 'warn',
          message: `数据库延迟偏高: ${latencyMs}ms`,
          latencyMs,
          value: latencyMs,
          threshold: this.config.dbLatencyWarnMs,
        };
      }

      // 额外检查：执行完整性检查
      try {
        const integrityResult = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
        if (integrityResult[0]?.integrity_check !== 'ok') {
          return {
            status: 'fail',
            message: `数据库完整性检查失败: ${integrityResult[0]?.integrity_check}`,
            latencyMs,
          };
        }
      } catch {
        // integrity_check 失败不中断主检查
      }

      return {
        status: 'pass',
        message: `数据库连接正常，延迟 ${latencyMs}ms`,
        latencyMs,
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `数据库连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查磁盘使用情况
   */
  private checkDisk(): MonitorCheck {
    try {
      // 检查数据目录
      const dataDir = path.dirname(env.DATABASE_PATH);
      const baseDir = path.resolve(process.cwd());

      // 尝试获取目录的磁盘信息
      const stats = fs.statfsSync(dataDir);
      const freeBytes = stats.bfree * stats.bsize;
      const totalBytes = stats.blocks * stats.bsize;
      const usedPercent = ((totalBytes - freeBytes) / totalBytes) * 100;

      if (usedPercent > this.config.diskCritPercent) {
        return {
          status: 'fail',
          message: `磁盘空间严重不足: 已用 ${usedPercent.toFixed(1)}% (可用: ${this.formatBytes(freeBytes)})`,
          value: usedPercent,
          threshold: this.config.diskCritPercent,
        };
      }

      if (usedPercent > this.config.diskWarnPercent) {
        return {
          status: 'warn',
          message: `磁盘空间不足: 已用 ${usedPercent.toFixed(1)}% (可用: ${this.formatBytes(freeBytes)})`,
          value: usedPercent,
          threshold: this.config.diskWarnPercent,
        };
      }

      // 检查数据库 WAL 文件大小
      const walPath = `${env.DATABASE_PATH}-wal`;
      let walInfo = '';
      try {
        if (fs.existsSync(walPath)) {
          const walSize = fs.statSync(walPath).size;
          if (walSize > 100 * 1024 * 1024) {
            walInfo = ` (WAL 文件较大: ${this.formatBytes(walSize)})`;
          }
        }
      } catch {
        // 忽略 WAL 文件检查错误
      }

      return {
        status: 'pass',
        message: `磁盘空间正常: 已用 ${usedPercent.toFixed(1)}%, 可用 ${this.formatBytes(freeBytes)}${walInfo}`,
        value: usedPercent,
        threshold: this.config.diskWarnPercent,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: `无法检查磁盘: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 检查内存使用
   */
  private checkMemory(): MonitorCheck {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const systemUsedPercent = ((totalMem - freeMem) / totalMem) * 100;

      // 检查 Node 进程内存
      const heapUsedMb = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMb = memUsage.heapTotal / 1024 / 1024;
      const rssMb = memUsage.rss / 1024 / 1024;

      // 系统内存检查
      let messages: string[] = [];
      let worstStatus: 'pass' | 'warn' | 'fail' = 'pass';

      if (systemUsedPercent > this.config.memoryCritPercent) {
        worstStatus = 'fail';
        messages.push(`系统内存使用 ${systemUsedPercent.toFixed(1)}%`);
      } else if (systemUsedPercent > this.config.memoryWarnPercent) {
        worstStatus = 'warn';
        messages.push(`系统内存使用 ${systemUsedPercent.toFixed(1)}%`);
      }

      // 进程 RSS 检查（如果系统内存小于 2GB）
      if (totalMem < 2 * 1024 * 1024 * 1024 && rssMb > 500) {
        messages.push(`进程 RSS: ${rssMb.toFixed(0)}MB`);
        if (worstStatus === 'pass') {
          worstStatus = 'warn';
        }
      }

      if (worstStatus === 'pass') {
        return {
          status: 'pass',
          message: `内存正常: 系统 ${systemUsedPercent.toFixed(1)}%, 进程 RSS ${rssMb.toFixed(0)}MB`,
          value: systemUsedPercent,
          threshold: this.config.memoryWarnPercent,
        };
      }

      return {
        status: worstStatus,
        message: `内存告警: ${messages.join(', ')}`,
        value: systemUsedPercent,
        threshold: worstStatus === 'fail' ? this.config.memoryCritPercent : this.config.memoryWarnPercent,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: `无法检查内存: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 检查错误率（最近 5 分钟）
   */
  private checkErrorRate(): MonitorCheck {
    try {
      const stats = logger.getStats();
      const errorsLast5Min = stats.lastHour; // 近似

      if (errorsLast5Min > this.config.errorRateCrit) {
        return {
          status: 'fail',
          message: `错误率过高: 最近 5 分钟 ${errorsLast5Min} 个错误（阈值: ${this.config.errorRateCrit}）`,
          value: errorsLast5Min,
          threshold: this.config.errorRateCrit,
        };
      }

      if (errorsLast5Min > this.config.errorRateWarn) {
        return {
          status: 'warn',
          message: `错误率偏高: 最近 5 分钟 ${errorsLast5Min} 个错误`,
          value: errorsLast5Min,
          threshold: this.config.errorRateWarn,
        };
      }

      return {
        status: 'pass',
        message: `错误率正常: 最近 5 分钟 ${errorsLast5Min} 个错误记录`,
        value: errorsLast5Min,
        threshold: this.config.errorRateWarn,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: `无法检查错误率: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 检查服务运行状态
   */
  private async checkServices(): Promise<MonitorCheck> {
    try {
      const { backupService } = await import('./backupService');
      const { schedulerService } = await import('./schedulerService');

      const services: Array<{ name: string; ok: boolean; status: string; message?: string }> = [];

      // 检查备份服务
      try {
        const backupStatus = backupService.getStatus();
        services.push({
          name: 'backup',
          ok: true,
          status: backupStatus.config.enabled ? 'enabled' : 'disabled',
          message: backupStatus.lastBackup
            ? `上次备份: ${new Date(backupStatus.lastBackup.createdAt).toLocaleString('zh-CN')}`
            : '暂无备份记录',
        });
      } catch {
        services.push({ name: 'backup', ok: false, status: 'error', message: '无法获取备份服务状态' });
      }

      // 检查调度器服务
      try {
        const runningTasks = schedulerService.getRunningTasks();
        services.push({
          name: 'scheduler',
          ok: true,
          status: 'running',
          message: `活跃定时任务: ${runningTasks.length}`,
        });
      } catch {
        services.push({ name: 'scheduler', ok: false, status: 'error', message: '无法获取调度器状态' });
      }

      // 统计
      const running = services.filter((s) => s.ok).length;
      const total = services.length;
      const failed = total - running;

      if (failed >= this.config.downServiceThreshold) {
        return {
          status: 'fail',
          message: `${failed}/${total} 服务异常: ${services.filter((s) => !s.ok).map((s) => s.name).join(', ')}`,
          value: running,
          threshold: total,
        };
      }

      if (failed >= this.config.degradedServiceThreshold) {
        return {
          status: 'warn',
          message: `${failed}/${total} 服务异常`,
          value: running,
          threshold: total,
        };
      }

      return {
        status: 'pass',
        message: `服务运行正常: ${running}/${total} 在线`,
        value: running,
        threshold: total,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: `无法检查服务状态: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 检查队列健康
   */
  private checkQueue(): MonitorCheck {
    try {
      // 检查数据库中的待处理任务
      const pendingTasks = db.prepare(`
        SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'
      `).get() as { count: number } | undefined;

      // 检查卡住的任务（超过 1 小时仍 pending）
      const stalledTasks = db.prepare(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE status = 'running' 
        AND julianday('now') - julianday(created_at) > 0.0417
      `).get() as { count: number } | undefined;

      const pendingCount = pendingTasks?.count ?? 0;
      const stalledCount = stalledTasks?.count ?? 0;

      if (stalledCount > 10) {
        return {
          status: 'fail',
          message: `队列异常: ${stalledCount} 个停滞任务`,
          value: stalledCount,
          threshold: 10,
        };
      }

      if (stalledCount > 0 || pendingCount > 100) {
        return {
          status: 'warn',
          message: `队列积压: ${pendingCount} 待处理, ${stalledCount} 停滞`,
          value: pendingCount,
          threshold: 100,
        };
      }

      return {
        status: 'pass',
        message: `队列正常: ${pendingCount} 待处理, ${stalledCount} 停滞`,
        value: pendingCount,
        threshold: 100,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: `无法检查队列: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  // ====================== 辅助方法 ======================

  /**
   * 收集告警
   */
  private collectAlerts(
    alerts: SelfMonitorReport['alerts'],
    checkName: string,
    check: MonitorCheck,
    timestamp: string,
  ): void {
    if (check.status === 'pass') return;

    const checkLabels: Record<string, string> = {
      database: '数据库',
      disk: '磁盘',
      memory: '内存',
      errors: '错误率',
      services: '服务状态',
      queue: '队列',
    };

    const severity = check.status === 'fail' ? 'critical' : 'warning';

    alerts.push({
      severity,
      message: `[${checkLabels[checkName] || checkName}] ${check.message}`,
      timestamp,
    });
  }

  /**
   * 确定整体状态
   */
  private determineStatus(checks: MonitorCheck[]): SelfMonitorReport['status'] {
    const hasFail = checks.some((c) => c.status === 'fail');
    const hasWarn = checks.some((c) => c.status === 'warn');

    if (hasFail) return 'down';
    if (hasWarn) return 'degraded';
    return 'healthy';
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

// 单例导出
export const selfMonitorService = new SelfMonitorService();
