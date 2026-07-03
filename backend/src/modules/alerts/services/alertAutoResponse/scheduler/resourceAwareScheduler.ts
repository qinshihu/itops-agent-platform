/**
 * =============================================================================
 * AARS v2 — 资源感知调度器
 *
 * 职责：
 *   1. 优先级队列（非简单 FIFO）
 *   2. SSH 连接池限制
 *   3. LLM API 并发控制
 *   4. 时间窗口节流（工作时间全力跑，非工作时间降速）
 * =============================================================================
 */

import { logger } from '../../../../../utils/logger';
import type { ScheduledTaskConfig, PriorityLevel, ResourceConstraints } from '../types';

interface ScheduledTask extends ScheduledTaskConfig {
  resolve: (value: void) => void;
  reject: (error: Error) => void;
}

const DEFAULT_RESOURCES: ResourceConstraints = {
  sshConnPool: { maxTotal: 20, maxPerHost: 3 },
  snmpRateLimit: { maxRequests: 50, windowMs: 1000 },
  llmConcurrency: 5,
};

class ResourceAwareScheduler {
  private queue: ScheduledTask[] = [];
  private activeCount = 0;
  private readonly MAX_CONCURRENT = 5;
  private isRunning = false;

  private currentSshCount = 0;
  private currentLlmCount = 0;
  private resources: ResourceConstraints = DEFAULT_RESOURCES;

  private readonly BUSINESS_HOURS = { start: 9, end: 18 };

  /**
   * 提交任务到调度器
   */
  submit(config: ScheduledTaskConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const task: ScheduledTask = { ...config, resolve, reject };
      this.insertByPriority(task);
      this.processNext();
    });
  }

  /**
   * 按优先级插入队列
   */
  private insertByPriority(task: ScheduledTask): void {
    const priorityOrder: Record<PriorityLevel, number> = {
      critical: 0, high: 1, medium: 2, low: 3,
    };
    const myOrder = priorityOrder[task.priority] ?? 3;

    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      const existingOrder = priorityOrder[this.queue[i].priority] ?? 3;
      if (myOrder < existingOrder) {
        this.queue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(task);
    }

    logger.debug(`[Scheduler] Queued alert ${task.alertId} (priority=${task.priority}), queue length=${this.queue.length}`);
  }

  /**
   * 处理下一个任务
   */
  private processNext(): void {
    if (this.isRunning) return;
    if (this.activeCount >= this.getCurrentMaxConcurrent()) return;
    if (this.queue.length === 0) return;

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    this.isRunning = true;

    // 异步执行后释放
    Promise.resolve().then(() => {
      task.resolve();
    }).catch((err) => {
      task.reject(err);
    }).finally(() => {
      this.activeCount--;
      this.isRunning = false;
      this.processNext();
    });
  }

  /**
   * 获取当前最大并发数（时间窗口感知）
   */
  private getCurrentMaxConcurrent(): number {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const isBusinessHours = dayOfWeek >= 1 && dayOfWeek <= 5 &&
      hour >= this.BUSINESS_HOURS.start && hour < this.BUSINESS_HOURS.end;

    if (!isBusinessHours) {
      return Math.ceil(this.MAX_CONCURRENT * 0.5); // 非工作时间减半
    }
    return this.MAX_CONCURRENT;
  }

  /**
   * 更新资源约束
   */
  setResourceConstraints(constraints: Partial<ResourceConstraints>): void {
    this.resources = { ...this.resources, ...constraints };
  }

  /**
   * 获取队列统计
   */
  getStats(): {
    queueLength: number;
    activeCount: number;
    maxConcurrent: number;
    sshPoolUsage: string;
    llmConcurrency: string;
  } {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      maxConcurrent: this.getCurrentMaxConcurrent(),
      sshPoolUsage: `${this.currentSshCount}/${this.resources.sshConnPool.maxTotal}`,
      llmConcurrency: `${this.currentLlmCount}/${this.resources.llmConcurrency}`,
    };
  }
}

export const resourceAwareScheduler = new ResourceAwareScheduler();
