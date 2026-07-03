import { env } from './env';
import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  requestId?: string;
  userId?: string;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  meta?: unknown;
  trace?: string;
  span?: string;
}

interface LogOptions {
  requestId?: string;
  userId?: string;
  durationMs?: number;
  error?: unknown;
  meta?: unknown;
  trace?: string;
  span?: string;
}

interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  errors: number;
  warnings: number;
  lastHour: number;
  lastDay: number;
}

class Logger {
  private level: LogLevel;
  private service: string;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  private logFile?: fs.WriteStream;
  private errorLogStream?: fs.WriteStream;
  private stats: LogStats = {
    total: 0,
    byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
    errors: 0,
    warnings: 0,
    lastHour: 0,
    lastDay: 0
  };
  private lastHourTimestamps: number[] = [];
  private lastDayTimestamps: number[] = [];
  private errorListeners: Array<(entry: LogEntry) => void> = [];
  private logBuffer: string[] = [];
  private isFlushing = false;
  private flushInterval: NodeJS.Timeout | null = null;
  private maxBufferSize = 100;
  private performanceMetrics: Map<string, number[]> = new Map();
  private maxMetricKeys = 500;

  constructor(service = 'itops-agent') {
    this.service = service;
    const configLevel = env.LOG_LEVEL as LogLevel;
    if (configLevel && this.levels[configLevel] !== undefined) {
      this.level = configLevel;
    } else {
      this.level = env.NODE_ENV === 'production' ? 'info' : 'debug';
    }

    if (env.NODE_ENV === 'production') {
      this.setupLogFiles();
      this.startFlushInterval();
    }

    process.on('SIGTERM', () => this.flushBuffer());
    process.on('SIGINT', () => this.flushBuffer());
    process.on('beforeExit', () => this.flushBuffer());

    // Periodically cleanup timestamp arrays to prevent unbounded growth
    this.startTimestampCleanup();
  }

  private startTimestampCleanup(): void {
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      const oneDayAgo = Date.now() - 86400000;
      this.lastHourTimestamps = this.lastHourTimestamps.filter(t => t > oneHourAgo);
      this.lastDayTimestamps = this.lastDayTimestamps.filter(t => t > oneDayAgo);
    }, 60 * 60 * 1000).unref();
  }

  private setupLogFiles(): void {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const logPath = path.join(logDir, `${this.service}-${dateStr}.log`);
      const errorLogPath = path.join(logDir, `${this.service}-error-${dateStr}.log`);
      
      this.logFile = fs.createWriteStream(logPath, { flags: 'a' });
      this.errorLogStream = fs.createWriteStream(errorLogPath, { flags: 'a' });
      
      this.logFile.on('error', (err) => {
        console.error('Log file error:', err);
      });
      
      this.errorLogStream.on('error', (err) => {
        console.error('Error log file error:', err);
      });
      
      setInterval(() => this.rotateLogFiles(), 24 * 60 * 60 * 1000);
    } catch (err) {
      console.error('Failed to setup log files:', err);
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000);
  }

  private async flushBuffer(): Promise<void> {
    if (this.isFlushing || this.logBuffer.length === 0) return;
    
    this.isFlushing = true;
    const buffer = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      if (this.logFile) {
        const content = buffer.join('\n') + '\n';
        this.logFile.write(content);
      }
    } catch (err) {
      console.error('Failed to flush log buffer:', err);
      this.logBuffer.push(...buffer);
    } finally {
      this.isFlushing = false;
    }
  }

  private rotateLogFiles(): void {
    if (this.logFile) {
      this.logFile.end();
    }
    if (this.errorLogStream) {
      this.errorLogStream.end();
    }
    this.setupLogFiles();
    this.cleanupOldLogs();
  }

  private cleanupOldLogs(): void {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      const files = fs.readdirSync(logDir);
      const now = new Date();
      const retentionDays = 30;

      files.forEach(file => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        const age = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

        if (age > retentionDays) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old log file: ${file}`);
        }
      });
    } catch (err) {
      console.error('Failed to cleanup old logs:', err);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getStats(): LogStats {
    const oneHourAgo = Date.now() - 3600000;
    const oneDayAgo = Date.now() - 86400000;
    
    this.lastHourTimestamps = this.lastHourTimestamps.filter(t => t > oneHourAgo);
    this.lastDayTimestamps = this.lastDayTimestamps.filter(t => t > oneDayAgo);
    
    this.stats.lastHour = this.lastHourTimestamps.length;
    this.stats.lastDay = this.lastDayTimestamps.length;
    
    return { ...this.stats };
  }

  onError(listener: (entry: LogEntry) => void): void {
    this.errorListeners.push(listener);
  }

  trackPerformance(metricName: string, durationMs: number): void {
    if (!this.performanceMetrics.has(metricName)) {
      this.performanceMetrics.set(metricName, []);
    }
    const metrics = this.performanceMetrics.get(metricName)!;
    metrics.push(durationMs);
    
    if (metrics.length > 1000) {
      metrics.shift();
    }

    // Limit the number of metric keys to prevent unbounded growth
    if (this.performanceMetrics.size > this.maxMetricKeys) {
      // Remove the oldest entries (first N keys added)
      const keysToRemove = this.performanceMetrics.size - this.maxMetricKeys;
      const keys = Array.from(this.performanceMetrics.keys());
      for (let i = 0; i < keysToRemove; i++) {
        this.performanceMetrics.delete(keys[i]);
      }
    }
  }

  getPerformanceMetrics(): Record<string, { avg: number; p95: number; p99: number; count: number }> {
    const result: Record<string, { avg: number; p95: number; p99: number; count: number }> = {};
    
    for (const [name, values] of this.performanceMetrics) {
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      
      result[name] = {
        avg: Math.round(avg * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100,
        count: values.length
      };
    }
    
    return result;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatError(error: unknown): LogEntry['error'] {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return {
      name: 'UnknownError',
      message: String(error)
    };
  }

  private format(
    level: LogLevel,
    message: string,
    options?: LogOptions
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service
    };

    if (options?.requestId) entry.requestId = options.requestId;
    if (options?.userId) entry.userId = options.userId;
    if (options?.durationMs) entry.durationMs = options.durationMs;
    if (options?.meta) entry.meta = options.meta;
    if (options?.trace) entry.trace = options.trace;
    if (options?.span) entry.span = options.span;

    if (options?.error) {
      entry.error = this.formatError(options.error);
    }

    return entry;
  }

  private log(
    level: LogLevel,
    message: string,
    options?: LogOptions
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.format(level, message, options);
    
    this.stats.total++;
    this.stats.byLevel[level]++;
    this.lastHourTimestamps.push(Date.now());
    this.lastDayTimestamps.push(Date.now());
    
    if (level === 'error') {
      this.stats.errors++;
      this.errorListeners.forEach(listener => listener(entry));
    }
    if (level === 'warn') {
      this.stats.warnings++;
    }

    if (options?.durationMs) {
      this.trackPerformance(message, options.durationMs);
    }

    if (env.NODE_ENV === 'production') {
      const logLine = JSON.stringify(entry);
      
      if (level === 'error' && this.errorLogStream) {
        this.errorLogStream.write(logLine + '\n');
      }
      
      if (this.logBuffer.length < this.maxBufferSize) {
        this.logBuffer.push(logLine);
      } else {
        this.flushBuffer();
        this.logBuffer.push(logLine);
      }
      
      console.log(logLine);
    } else {
      this.logToConsole(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const colors = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m'
    };
    const reset = '\x1b[0m';
    
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.service}]`;
    console.log(`${colors[entry.level]}${prefix}${reset} ${entry.message}`);
    
    if (entry.durationMs !== undefined) {
      console.log(`  Duration: ${entry.durationMs}ms`);
    }
    if (entry.requestId) {
      console.log(`  Request ID: ${entry.requestId}`);
    }
    if (entry.userId) {
      console.log(`  User ID: ${entry.userId}`);
    }
    if (entry.error) {
      console.log(`  Error: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        console.log(`  Stack: ${entry.error.stack.split('\n').slice(1).join('\n         ')}`);
      }
    }
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      console.log('  Meta:', JSON.stringify(entry.meta, null, 2));
    }
  }

  debug(message: string, meta?: unknown): void {
    this.log('debug', message, { meta });
  }

  info(message: string, meta?: unknown): void {
    this.log('info', message, { meta });
  }

  warn(message: string, meta?: unknown): void {
    this.log('warn', message, { meta });
  }

  error(message: string, error?: unknown, meta?: unknown): void {
    this.log('error', message, { error, meta });
  }

  startTimer(message: string, meta?: unknown): { end: (success?: boolean) => void } {
    const startTime = Date.now();
    return {
      end: (success = true) => {
        const duration = Date.now() - startTime;
        this.log(success ? 'info' : 'warn', `${message} ${success ? 'completed' : 'failed'}`, {
          durationMs: duration,
          meta
        });
      }
    };
  }

  child(options: { service?: string; requestId?: string; userId?: string }): Logger {
    const childLogger = new Logger(options.service || this.service);
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (
      level: LogLevel,
      message: string,
      logOptions?: LogOptions
    ) => {
      originalLog(level, message, {
        ...logOptions,
        requestId: options.requestId || logOptions?.requestId,
        userId: options.userId || logOptions?.userId
      });
    };
    
    return childLogger;
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushBuffer();
    
    if (this.logFile) {
      this.logFile.end();
    }
    if (this.errorLogStream) {
      this.errorLogStream.end();
    }
  }
}

export const logger = new Logger();
