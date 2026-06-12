import os from 'os';
import fs from 'fs';
import path from 'path';
import db from '../models/database';
import { logger } from '../utils/logger';
import { getIOInstance } from '../models/database';
import { alertService } from './alertService';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    processUptime: number;
    pid: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentUsed: number;
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    cores: number;
    loadAverage: number[];
    model: string;
    usagePercent: number;
  };
  disk: {
    databaseSize: number;
    logSize: number;
    backupSize: number;
  };
  database: {
    status: 'healthy' | 'unhealthy';
    latencyMs: number;
    openConnections: number;
    size: number;
    tableCount: number;
  };
  websocket: {
    status: 'healthy' | 'degraded';
    activeConnections: number;
  };
  services: {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
  }[];
  checks: {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    output?: string;
    threshold?: number;
    observedValue?: number;
  }[];
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerMinute: number;
  };
}

const HEALTH_CHECK_TIMEOUT = 5000;
const START_TIME = Date.now();
const VERSION = process.env.npm_package_version || '1.0.0';

export class HealthService {
  private lastCheck: SystemHealth | null = null;
  private lastCheckTime: number = 0;
  private checkHistory: { timestamp: number; status: string }[] = [];
  private requestCount = 0;
  private requestTimestamps: number[] = [];
  private alertCheckEnabled = true;
  private lastAlertCheckTime = 0;
  private alertCheckCooldown = 60000;

  async checkHealth(): Promise<SystemHealth> {
    const now = Date.now();
    if (this.lastCheck && this.lastCheckTime && (now - this.lastCheckTime) < 10000) {
      return this.lastCheck;
    }

    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();

    const health: SystemHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: now - START_TIME,
      version: VERSION,
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        processUptime: process.uptime(),
        pid: process.pid
      },
      memory: {
        total: os.totalmem(),
        used: os.totalmem() - os.freemem(),
        free: os.freemem(),
        percentUsed: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers || 0
      },
      cpu: {
        cores: cpus.length,
        loadAverage: os.loadavg(),
        model: cpus[0]?.model || 'unknown',
        usagePercent: this.calculateCpuUsage(cpus)
      },
      disk: {
        databaseSize: this.getDatabaseSize(),
        logSize: this.getLogSize(),
        backupSize: this.getBackupSize()
      },
      database: await this.checkDatabase(),
      websocket: this.checkWebSocket(),
      services: await this.checkServices(),
      checks: [],
      performance: this.getPerformanceMetrics()
    };

    health.checks = [
      {
        name: 'memory_usage',
        status: health.memory.percentUsed > 90 ? 'fail' : health.memory.percentUsed > 75 ? 'warn' : 'pass',
        threshold: 90,
        observedValue: health.memory.percentUsed,
        output: `Memory usage: ${health.memory.percentUsed.toFixed(1)}%`
      },
      {
        name: 'cpu_load',
        status: health.cpu.loadAverage[0] > health.cpu.cores * 1.5 ? 'fail' : 
                health.cpu.loadAverage[0] > health.cpu.cores ? 'warn' : 'pass',
        threshold: health.cpu.cores * 1.5,
        observedValue: health.cpu.loadAverage[0],
        output: `CPU load average: ${health.cpu.loadAverage[0].toFixed(2)}`
      },
      {
        name: 'cpu_usage',
        status: health.cpu.usagePercent > 90 ? 'fail' : health.cpu.usagePercent > 75 ? 'warn' : 'pass',
        threshold: 90,
        observedValue: health.cpu.usagePercent,
        output: `CPU usage: ${health.cpu.usagePercent.toFixed(1)}%`
      },
      {
        name: 'database',
        status: health.database.status === 'healthy' ? 'pass' : 'fail',
        output: `Database latency: ${health.database.latencyMs}ms`
      },
      {
        name: 'database_size',
        status: health.database.size > 1024 * 1024 * 1024 ? 'warn' : 'pass',
        threshold: 1024 * 1024 * 1024,
        observedValue: health.database.size,
        output: `Database size: ${this.formatSize(health.database.size)}`
      },
      {
        name: 'uptime',
        status: 'pass',
        output: `System uptime: ${this.formatUptime(health.uptime)}`
      },
      {
        name: 'websocket_connections',
        status: health.websocket.activeConnections > 1000 ? 'warn' : 'pass',
        threshold: 1000,
        observedValue: health.websocket.activeConnections,
        output: `Active WebSocket connections: ${health.websocket.activeConnections}`
      }
    ];

    const hasFailures = health.checks.some(c => c.status === 'fail');
    const hasWarnings = health.checks.some(c => c.status === 'warn');
    
    if (hasFailures) {
      health.status = 'unhealthy';
    } else if (hasWarnings) {
      health.status = 'degraded';
    }

    this.lastCheck = health;
    this.lastCheckTime = now;
    this.checkHistory.push({ timestamp: now, status: health.status });
    
    if (this.checkHistory.length > 100) {
      this.checkHistory = this.checkHistory.slice(-100);
    }

    if (health.status !== 'healthy') {
      logger.warn(`Health check: ${health.status}`, {
        checks: health.checks.filter(c => c.status !== 'pass')
      });
    }

    await this.checkHealthAlerts(health);

    return health;
  }

  private async checkHealthAlerts(health: SystemHealth): Promise<void> {
    if (!this.alertCheckEnabled) return;
    
    const now = Date.now();
    if (now - this.lastAlertCheckTime < this.alertCheckCooldown) {
      return;
    }
    
    this.lastAlertCheckTime = now;

    const metrics: Record<string, number> = {};

    const memoryCheck = health.checks.find(c => c.name === 'memory_usage');
    if (memoryCheck && memoryCheck.observedValue !== undefined) {
      metrics.memory_percent = memoryCheck.observedValue;
    }

    const cpuUsageCheck = health.checks.find(c => c.name === 'cpu_usage');
    if (cpuUsageCheck && cpuUsageCheck.observedValue !== undefined) {
      metrics.cpu_percent = cpuUsageCheck.observedValue;
    }

    const dbCheck = health.checks.find(c => c.name === 'database');
    if (health.database.latencyMs > 0) {
      metrics.db_latency = health.database.latencyMs;
    }

    const failCount = health.checks.filter(c => c.status === 'fail').length;
    if (failCount > 0) {
      metrics.error_rate = failCount * 10;
    }

    if (Object.keys(metrics).length > 0) {
      try {
        const alerts = await alertService.checkAlerts(metrics);
        if (alerts.length > 0) {
          logger.info(`Health check triggered ${alerts.length} alert(s)`, {
            alertCount: alerts.length,
            healthStatus: health.status
          });
        }
      } catch (error) {
        logger.warn('Health check alert联动失败', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  private calculateCpuUsage(cpus: os.CpuInfo[]): number {
    if (cpus.length === 0) return 0;
    
    const totalIdle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
    const totalTicks = cpus.reduce((sum, cpu) => 
      sum + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq, 0);
    
    return ((totalTicks - totalIdle) / totalTicks) * 100;
  }

  private async checkDatabase(): Promise<SystemHealth['database']> {
    const startTime = Date.now();
    
    try {
      db.prepare('SELECT 1').get();
      const latency = Date.now() - startTime;
      
      const tableCount = (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }).count;
      const size = this.getDatabaseSize();
      
      return {
        status: latency < HEALTH_CHECK_TIMEOUT ? 'healthy' : 'unhealthy',
        latencyMs: latency,
        openConnections: 1,
        size,
        tableCount
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
        openConnections: 0,
        size: 0,
        tableCount: 0
      };
    }
  }

  private checkWebSocket(): SystemHealth['websocket'] {
    const io = getIOInstance();
    const activeConnections = io ? io.engine.clientsCount : 0;
    
    return {
      status: io ? 'healthy' : 'degraded',
      activeConnections
    };
  }

  private async checkServices(): Promise<SystemHealth['services']> {
    const services: SystemHealth['services'] = [];
    
    try {
      const { backupService } = await import('./backupService');
      const backupStatus = backupService.getStatus();
      services.push({
        name: 'backup',
        status: backupStatus.config.enabled ? 'healthy' : 'degraded',
        message: `Last backup: ${backupStatus.lastBackup?.createdAt || 'never'}`
      });
    } catch (error) {
      services.push({
        name: 'backup',
        status: 'unhealthy',
        message: 'Backup service check failed'
      });
    }

    try {
      const { schedulerService } = await import('./schedulerService');
      services.push({
        name: 'scheduler',
        status: schedulerService ? 'healthy' : 'degraded',
        message: 'Scheduler service running'
      });
    } catch (error) {
      services.push({
        name: 'scheduler',
        status: 'unhealthy',
        message: 'Scheduler service check failed'
      });
    }

    // 自监控服务检查
    try {
      const { selfMonitorService } = await import('./selfMonitorService');
      const monitorReport = selfMonitorService.getLastReport();
      if (monitorReport) {
        services.push({
          name: 'self-monitor',
          status: monitorReport.status === 'healthy' ? 'healthy' : 
                  monitorReport.status === 'degraded' ? 'degraded' : 'unhealthy',
          message: `Status: ${monitorReport.status}, ${monitorReport.alerts.length} active alerts`
        });
      } else {
        services.push({
          name: 'self-monitor',
          status: 'degraded',
          message: 'Self-monitor not yet collected first report'
        });
      }
    } catch (error) {
      services.push({
        name: 'self-monitor',
        status: 'healthy',
        message: 'Self-monitor service not available'
      });
    }

    // 队列服务检查
    try {
      const { queueService } = await import('./queueService');
      const queueStats = await queueService.stats();
      services.push({
        name: 'queue',
        status: queueStats.stalled > 0 ? 'degraded' : queueStats.failed24h > 50 ? 'degraded' : 'healthy',
        message: `Pending: ${queueStats.pending}, Running: ${queueStats.running}, Failed(24h): ${queueStats.failed24h}`
      });
    } catch (error) {
      services.push({
        name: 'queue',
        status: 'healthy',
        message: 'Queue service not available'
      });
    }

    return services;
  }

  private getDatabaseSize(): number {
    try {
      const result = db.prepare('PRAGMA page_count').get() as { page_count: number } | undefined;
      const pageSizeResult = db.prepare('PRAGMA page_size').get() as { page_size: number } | undefined;
      
      if (result && pageSizeResult) {
        return result.page_count * pageSizeResult.page_size;
      }
    } catch (error) {
      logger.warn('Failed to get database size', error as Error);
    }
    return 0;
  }

  private getLogSize(): number {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      
      if (!fs.existsSync(logDir)) return 0;
      
      const files = fs.readdirSync(logDir);
      return files.reduce((total: number, file: string) => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        return total + stats.size;
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  private getBackupSize(): number {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      
      if (!fs.existsSync(backupDir)) return 0;
      
      const files = fs.readdirSync(backupDir);
      return files.reduce((total: number, file: string) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return total + stats.size;
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  private getPerformanceMetrics(): SystemHealth['performance'] {
    const metrics = logger.getPerformanceMetrics();
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    return {
      avgResponseTime: metrics['HTTP Request']?.avg || 0,
      p95ResponseTime: metrics['HTTP Request']?.p95 || 0,
      p99ResponseTime: metrics['HTTP Request']?.p99 || 0,
      requestsPerMinute: this.requestTimestamps.length
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  trackRequest(): void {
    this.requestCount++;
    this.requestTimestamps.push(Date.now());
  }

  getLastCheck(): SystemHealth | null {
    return this.lastCheck;
  }

  getHealthHistory(): { timestamp: number; status: string }[] {
    return [...this.checkHistory];
  }

  getHealthSummary(): {
    currentStatus: string;
    lastCheckTime: number | null;
    uptime: number;
    historyCount: number;
  } {
    return {
      currentStatus: this.lastCheck?.status || 'unknown',
      lastCheckTime: this.lastCheckTime || null,
      uptime: Date.now() - START_TIME,
      historyCount: this.checkHistory.length
    };
  }
}

export const healthService = new HealthService();
