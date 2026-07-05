/**
 * BullMQ + Redis 队列适配器 — ITOps Agent Platform
 *
 * 生产环境使用 Redis 作为队列后端，提供：
 * - 持久化（Redis 重启后任务不丢）
 * - 分布式（多个 Worker 实例）
 * - 延迟调度
 * - 可观测（Bull Board UI）
 *
 * 需要安装：
 *   npm install bullmq ioredis
 *
 * 需要 Redis 6.2+ 运行
 */

import type { QueueJob, QueueAdapter, QueueStats } from './queueService';
import { logger } from '../../../utils/logger';

// 延迟导入，仅在启用 Redis 时加载
let Bull: Record<string, unknown> | null = null;

interface BullQueue {
  client: { ping(): Promise<unknown> };
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  getJobCounts(...types: string[]): Promise<Record<string, number>>;
  getJobCount(): Promise<number>;
  drain(): Promise<void>;
  clean(grace: number, limit: number, type: string): Promise<void>;
  close(): Promise<void>;
}

export class BullQueueAdapter implements QueueAdapter {
  private queue: BullQueue | null = null;
  private redisUrl: string;
  private initialized = false;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // 动态导入 BullMQ（可选依赖，不强制安装）
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Bull = require('bullmq') as Record<string, unknown>;
      const Queue = Bull.Queue as new (...args: unknown[]) => Record<string, unknown>;
      const _Worker = Bull.Worker;
      const QueueScheduler = Bull.QueueScheduler as new (...args: unknown[]) => Record<string, unknown>;

      this.queue = new Queue('itops-queue', {
        connection: { url: this.redisUrl },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      }) as unknown as BullQueue;

      new QueueScheduler('itops-queue', {
        connection: { url: this.redisUrl },
      });

      this.initialized = true;
      logger.info('BullMQ queue initialized (Redis backend)');
    } catch (error) {
      logger.error('Failed to initialize BullMQ:', error);
      throw error;
    }
  }

  async health(): Promise<boolean> {
    if (!this.initialized) await this.init();
    try {
      await this.queue!.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async enqueue(job: QueueJob): Promise<void> {
    if (!this.initialized) await this.init();
    await this.queue!.add(job.type, job.payload, {
      jobId: job.id,
      priority: job.priority,
      attempts: job.maxRetries,
      timeout: job.timeoutMs,
    });
  }

  async dequeue(): Promise<QueueJob | null> {
    // BullMQ 使用 Worker 拉取任务，不需要手动 dequeue
    return null;
  }

  async acknowledge(_id: string): Promise<void> {
    // BullMQ 在 Worker 完成后自动 acknowledge
  }

  async fail(_id: string, _error: string): Promise<void> {
    // BullMQ 在 Worker 抛出异常时自动 fail
  }

  async stats(): Promise<QueueStats> {
    if (!this.initialized) return { pending: 0, running: 0, completed24h: 0, failed24h: 0, stalled: 0, avgLatencyMs: 0 };
    const counts = await this.queue!.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    return {
      pending: (counts.waiting || 0) + (counts.delayed || 0),
      running: counts.active || 0,
      completed24h: counts.completed || 0,
      failed24h: counts.failed || 0,
      stalled: 0,
      avgLatencyMs: 0,
    };
  }

  async size(): Promise<number> {
    if (!this.initialized) return 0;
    return this.queue!.getJobCount();
  }

  async clear(): Promise<void> {
    if (!this.initialized) return;
    await this.queue!.drain();
    await this.queue!.clean(0, 0, 'completed');
    await this.queue!.clean(0, 0, 'failed');
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    await this.queue!.close();
    this.initialized = false;
  }
}
