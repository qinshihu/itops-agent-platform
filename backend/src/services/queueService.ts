/**
 * 消息队列服务 — ITOps Agent Platform
 *
 * 支持两种运行模式：
 * 1. In-Memory 队列（无外部依赖，默认）
 * 2. BullMQ + Redis（生产环境，需 REDIS_URL 环境变量）
 *
 * 用于工作流执行、告警通知、指标采集等异步任务。
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// ================ 类型定义 ================

export interface QueueJob<T = unknown> {
  id: string;
  type: QueueJobType;
  payload: T;
  priority: number; // 0=最高, 100=最低
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  retries: number;
  maxRetries: number;
  timeoutMs: number;
}

export enum QueueJobType {
  WORKFLOW_EXECUTION = 'workflow_execution',
  ALERT_NOTIFICATION = 'alert_notification',
  METRIC_COLLECTION = 'metric_collection',
  REPORT_GENERATION = 'report_generation',
  BACKUP = 'backup',
  KNOWLEDGE_SYNC = 'knowledge_sync',
  CLEANUP = 'cleanup',
}

export interface QueueStats {
  pending: number;
  running: number;
  completed24h: number;
  failed24h: number;
  stalled: number;
  avgLatencyMs: number;
}

export interface QueueAdapter {
  enqueue(job: QueueJob): Promise<void>;
  dequeue(): Promise<QueueJob | null>;
  acknowledge(id: string): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  stats(): Promise<QueueStats>;
  size(): Promise<number>;
  clear(): Promise<void>;
  shutdown(): Promise<void>;
}

// ================ In-Memory 队列适配器 ================

class InMemoryQueueAdapter extends EventEmitter implements QueueAdapter {
  private queue: QueueJob[] = [];
  private running: Map<string, QueueJob> = new Map();
  private completed: QueueJob[] = [];
  private failed: QueueJob[] = [];
  private readonly MAX_COMPLETED_HISTORY = 1000;
  private stopped = false;

  async enqueue(job: QueueJob): Promise<void> {
    // 按优先级插入（数字越小优先级越高）
    const insertIdx = this.queue.findIndex(j => j.priority > job.priority);
    if (insertIdx === -1) {
      this.queue.push(job);
    } else {
      this.queue.splice(insertIdx, 0, job);
    }
    this.emit('job:enqueued', job);
  }

  async dequeue(): Promise<QueueJob | null> {
    if (this.stopped || this.queue.length === 0) return null;

    // 找到第一个 pending 且未超时的任务
    const idx = this.queue.findIndex(j => j.status === 'pending');
    if (idx === -1) return null;

    const job = this.queue[idx];
    job.status = 'running';
    job.startedAt = new Date();

    // 从待处理队列移除，加入运行中
    this.queue.splice(idx, 1);
    this.running.set(job.id, job);

    this.emit('job:started', job);

    // 自动超时处理
    if (job.timeoutMs > 0) {
      setTimeout(() => {
        if (this.running.has(job.id)) {
          this.fail(job.id, `Job timed out after ${job.timeoutMs}ms`);
        }
      }, job.timeoutMs);
    }

    return job;
  }

  async acknowledge(id: string): Promise<void> {
    const job = this.running.get(id);
    if (!job) return;

    job.status = 'completed';
    job.completedAt = new Date();
    this.running.delete(id);
    this.completed.push(job);

    // 限制历史记录大小
    if (this.completed.length > this.MAX_COMPLETED_HISTORY) {
      this.completed = this.completed.slice(-this.MAX_COMPLETED_HISTORY);
    }

    this.emit('job:completed', job);
  }

  async fail(id: string, error: string): Promise<void> {
    const job = this.running.get(id);
    if (!job) return;

    job.retries++;
    if (job.retries <= job.maxRetries) {
      // 重试：重置状态，放回队尾
      logger.info(`🔄 Retrying job ${id} (attempt ${job.retries}/${job.maxRetries})`);
      job.status = 'pending';
      job.error = error;
      this.running.delete(id);
      this.queue.push(job);
      this.emit('job:retrying', job);
      return;
    }

    // 超过最大重试次数，标记为失败
    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();
    this.running.delete(id);
    this.failed.push(job);

    // 限制失败记录
    if (this.failed.length > this.MAX_COMPLETED_HISTORY) {
      this.failed = this.failed.slice(-this.MAX_COMPLETED_HISTORY);
    }

    this.emit('job:failed', job);
  }

  async stats(): Promise<QueueStats> {
    const now = Date.now();
    const completed24h = this.completed.filter(
      j => j.completedAt && (now - j.completedAt.getTime()) < 86400000
    ).length;
    const failed24h = this.failed.filter(
      j => j.completedAt && (now - j.completedAt.getTime()) < 86400000
    ).length;
    const pendingJobs = this.queue.filter(j => j.status === 'pending');
    const avgLatencyMs = pendingJobs.length > 0
      ? pendingJobs.reduce((sum, j) => sum + (now - j.createdAt.getTime()), 0) / pendingJobs.length
      : 0;

    return {
      pending: this.queue.filter(j => j.status === 'pending').length,
      running: this.running.size,
      completed24h,
      failed24h,
      stalled: this.queue.filter(j => j.status === 'running' && j.startedAt && (now - j.startedAt.getTime()) > 300000).length,
      avgLatencyMs,
    };
  }

  async size(): Promise<number> {
    return this.queue.length + this.running.size;
  }

  async clear(): Promise<void> {
    this.queue = [];
    this.running.clear();
  }

  async shutdown(): Promise<void> {
    this.stopped = true;
    this.queue = [];
    this.removeAllListeners();
  }
}

// ================ 队列服务 ================

class QueueService {
  private adapter: QueueAdapter;
  private workers: Map<string, (job: QueueJob) => Promise<void>> = new Map();
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 500; // 500ms polling interval
  private readonly MAX_CONCURRENT = 3;
  private activeJobs = 0;
  private initialized = false;

  constructor() {
    this.adapter = new InMemoryQueueAdapter();
  }

  init(): void {
    if (this.initialized) return;

    // 注册默认消费者
    this.registerDefaultConsumers();

    this.initialized = true;
    logger.info('✅ Queue service initialized (in-memory mode)');
  }

  /**
   * 切换为 BullMQ + Redis 后端（生产环境）
   */
  async enableRedisBackend(redisUrl: string): Promise<void> {
    try {
      const { BullQueueAdapter } = await import('./queueBullAdapter');
      const bullAdapter = new BullQueueAdapter(redisUrl);
      // 测试连接
      await bullAdapter.health();
      this.adapter = bullAdapter;
      logger.info('✅ Queue switched to Redis backend');
    } catch (error) {
      logger.error('❌ Failed to switch to Redis backend, staying with in-memory', error as Error);
    }
  }

  private registerDefaultConsumers(): void {
    this.registerConsumer(QueueJobType.CLEANUP, async (job) => {
      logger.info('🧹 Running cleanup job', { jobId: job.id });
      // 清理旧日志、过期会话等
    });
  }

  registerConsumer(type: QueueJobType, handler: (job: QueueJob) => Promise<void>): void {
    this.workers.set(type, handler);
  }

  async enqueue<T>(
    type: QueueJobType,
    payload: T,
    options?: {
      priority?: number;
      maxRetries?: number;
      timeoutMs?: number;
    }
  ): Promise<string> {
    const job: QueueJob<T> = {
      id: randomUUID(),
      type,
      payload,
      priority: options?.priority ?? 50,
      createdAt: new Date(),
      status: 'pending',
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
      timeoutMs: options?.timeoutMs ?? 300000,
    };

    await this.adapter.enqueue(job);

    // 确保消费者在运行
    if (!this.running) {
      this.startConsumers();
    }

    logger.debug(`📋 Enqueued job ${job.id} [${type}]`, { priority: job.priority });
    return job.id;
  }

  startConsumers(): void {
    if (this.running) return;
    this.running = true;
    this.pollLoop();
    logger.info('▶️ Queue consumers started');
  }

  stopConsumers(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info('⏹️ Queue consumers stopped');
  }

  private pollLoop(): void {
    if (!this.running) return;

    this.pollTimer = setTimeout(async () => {
      try {
        if (this.activeJobs >= this.MAX_CONCURRENT) {
          this.pollLoop();
          return;
        }

        const job = await this.adapter.dequeue();
        if (job) {
          this.processJob(job);
        }
      } catch (error) {
        logger.error('Queue poll error', error as Error);
      }

      this.pollLoop();
    }, this.POLL_INTERVAL_MS);
  }

  private async processJob(job: QueueJob): Promise<void> {
    this.activeJobs++;

    try {
      const handler = this.workers.get(job.type);
      if (!handler) {
        logger.warn(`⚠️ No handler registered for job type: ${job.type}, acknowledging`);
        await this.adapter.acknowledge(job.id);
        return;
      }

      await handler(job);
      await this.adapter.acknowledge(job.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Job ${job.id} failed`, error as Error);
      await this.adapter.fail(job.id, errorMsg);
    } finally {
      this.activeJobs--;
    }
  }

  getAdapter(): QueueAdapter {
    return this.adapter;
  }

  async stats(): Promise<QueueStats> {
    return this.adapter.stats();
  }

  async shutdown(): Promise<void> {
    this.stopConsumers();
    await this.adapter.shutdown();
    logger.info('✅ Queue service shut down');
  }
}

export const queueService = new QueueService();
