/**
 * 自监控 6 项具体检查逻辑（2026-07-21 拆分）
 *
 * 把原 selfMonitorService.ts L286-617 的 6 个 check 方法 + 3 个辅助方法抽出
 * 把私有方法（依赖 this）改为模块级别纯函数 + config 参数显式传递
 *
 * 拆分原则遵循 architecture.md §3.3.1 第 3 条「向后兼容的 import 路径」
 * 主类调用方式：`performAllChecks()` 内 `await Promise.all([checks.checkDatabase(config), ...])`
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { dbHealthRepository, tasksRepo } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { env } from '../../../../utils/env';
import type { MonitorCheck, SelfMonitorReport } from './types';
import type { MonitorConfig } from './config';

// ────────────────────────────────────────────────────────────
// 6 项具体检查（模块级纯函数）
// ────────────────────────────────────────────────────────────

/** 数据库连接 + 完整性 */
export async function checkDatabase(config: MonitorConfig): Promise<MonitorCheck> {
  const startTime = Date.now();

  try {
    dbHealthRepository.ping();
    const latencyMs = Date.now() - startTime;

    if (latencyMs > config.dbLatencyCritMs) {
      return {
        status: 'fail',
        message: `数据库延迟过高: ${latencyMs}ms (阈值: ${config.dbLatencyCritMs}ms)`,
        latencyMs,
        value: latencyMs,
        threshold: config.dbLatencyCritMs,
      };
    }

    if (latencyMs > config.dbLatencyWarnMs) {
      return {
        status: 'warn',
        message: `数据库延迟偏高: ${latencyMs}ms`,
        latencyMs,
        value: latencyMs,
        threshold: config.dbLatencyWarnMs,
      };
    }

    // 额外检查：执行完整性检查
    try {
      const integrityResult = dbHealthRepository.checkIntegrity();
      if (integrityResult !== 'ok') {
        return {
          status: 'fail',
          message: `数据库完整性检查失败: ${integrityResult}`,
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

/** 磁盘使用 + WAL 文件大小 */
export function checkDisk(config: MonitorConfig): MonitorCheck {
  try {
    const dataDir = path.dirname(env.DATABASE_PATH);
    const stats = fs.statfsSync(dataDir);
    const freeBytes = stats.bfree * stats.bsize;
    const totalBytes = stats.blocks * stats.bsize;
    const usedPercent = ((totalBytes - freeBytes) / totalBytes) * 100;

    if (usedPercent > config.diskCritPercent) {
      return {
        status: 'fail',
        message: `磁盘空间严重不足: 已用 ${usedPercent.toFixed(1)}% (可用: ${formatBytes(freeBytes)})`,
        value: usedPercent,
        threshold: config.diskCritPercent,
      };
    }

    if (usedPercent > config.diskWarnPercent) {
      return {
        status: 'warn',
        message: `磁盘空间不足: 已用 ${usedPercent.toFixed(1)}% (可用: ${formatBytes(freeBytes)})`,
        value: usedPercent,
        threshold: config.diskWarnPercent,
      };
    }

    const walPath = `${env.DATABASE_PATH}-wal`;
    let walInfo = '';
    try {
      if (fs.existsSync(walPath)) {
        const walSize = fs.statSync(walPath).size;
        if (walSize > 100 * 1024 * 1024) {
          walInfo = ` (WAL 文件较大: ${formatBytes(walSize)})`;
        }
      }
    } catch {
      // 忽略 WAL 文件检查错误
    }

    return {
      status: 'pass',
      message: `磁盘空间正常: 已用 ${usedPercent.toFixed(1)}%, 可用 ${formatBytes(freeBytes)}${walInfo}`,
      value: usedPercent,
      threshold: config.diskWarnPercent,
    };
  } catch (error) {
    return {
      status: 'warn',
      message: `无法检查磁盘: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/** Node 进程 + 系统内存使用 */
export function checkMemory(config: MonitorConfig): MonitorCheck {
  try {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const systemUsedPercent = ((totalMem - freeMem) / totalMem) * 100;

    const rssMb = memUsage.rss / 1024 / 1024;

    const messages: string[] = [];
    let worstStatus: 'pass' | 'warn' | 'fail' = 'pass';

    if (systemUsedPercent > config.memoryCritPercent) {
      worstStatus = 'fail';
      messages.push(`系统内存使用 ${systemUsedPercent.toFixed(1)}%`);
    } else if (systemUsedPercent > config.memoryWarnPercent) {
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
        threshold: config.memoryWarnPercent,
      };
    }

    return {
      status: worstStatus,
      message: `内存告警: ${messages.join(', ')}`,
      value: systemUsedPercent,
      threshold: worstStatus === 'fail' ? config.memoryCritPercent : config.memoryWarnPercent,
    };
  } catch (error) {
    return {
      status: 'warn',
      message: `无法检查内存: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/** 最近 5 分钟错误率 */
export function checkErrorRate(config: MonitorConfig): MonitorCheck {
  try {
    const stats = logger.getStats();
    const errorsLast5Min = stats.lastHour; // 近似

    if (errorsLast5Min > config.errorRateCrit) {
      return {
        status: 'fail',
        message: `错误率过高: 最近 5 分钟 ${errorsLast5Min} 个错误（阈值: ${config.errorRateCrit}）`,
        value: errorsLast5Min,
        threshold: config.errorRateCrit,
      };
    }

    if (errorsLast5Min > config.errorRateWarn) {
      return {
        status: 'warn',
        message: `错误率偏高: 最近 5 分钟 ${errorsLast5Min} 个错误`,
        value: errorsLast5Min,
        threshold: config.errorRateWarn,
      };
    }

    return {
      status: 'pass',
      message: `错误率正常: 最近 5 分钟 ${errorsLast5Min} 个错误记录`,
      value: errorsLast5Min,
      threshold: config.errorRateWarn,
    };
  } catch (error) {
    return {
      status: 'warn',
      message: `无法检查错误率: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/** 备份服务 + 调度器 */
export async function checkServices(config: MonitorConfig): Promise<MonitorCheck> {
  try {
    const { backupService } = await import('../../../backup/services');
      const { schedulerService } = await import('../../../workflow/services/schedulerService');

    const services: Array<{ name: string; ok: boolean; status: string; message?: string }> = [];

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

    const running = services.filter((s) => s.ok).length;
    const total = services.length;
    const failed = total - running;

    if (failed >= config.downServiceThreshold) {
      return {
        status: 'fail',
        message: `${failed}/${total} 服务异常: ${services.filter((s) => !s.ok).map((s) => s.name).join(', ')}`,
        value: running,
        threshold: total,
      };
    }

    if (failed >= config.degradedServiceThreshold) {
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

/** 队列健康（待处理/停滞任务）*/
export function checkQueue(): MonitorCheck {
  try {
    const pendingCount = tasksRepo.countPending();
    const stalledCount = tasksRepo.countStalled();

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

// ────────────────────────────────────────────────────────────
// 辅助方法（collectAlerts / determineStatus / formatBytes）
// ────────────────────────────────────────────────────────────

const CHECK_LABELS: Record<string, string> = {
  database: '数据库',
  disk: '磁盘',
  memory: '内存',
  errors: '错误率',
  services: '服务状态',
  queue: '队列',
};

/** 单项检查 → alert push */
export function collectAlerts(
  alerts: SelfMonitorReport['alerts'],
  checkName: string,
  check: MonitorCheck,
  timestamp: string,
): void {
  if (check.status === 'pass') return;

  const severity = check.status === 'fail' ? 'critical' : 'warning';
  alerts.push({
    severity,
    message: `[${CHECK_LABELS[checkName] || checkName}] ${check.message}`,
    timestamp,
  });
}

/** 整体状态：fail→down / warn→degraded / 全 pass→healthy */
export function determineStatus(checks: MonitorCheck[]): SelfMonitorReport['status'] {
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');

  if (hasFail) return 'down';
  if (hasWarn) return 'degraded';
  return 'healthy';
}

/** 字节格式化（B/KB/MB/GB）*/
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
