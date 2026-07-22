/**
 * rcaJobManager — RCA 异步任务管理
 *
 * 背景：rcaService.analyze() 同步执行 3 次串行 LLM 调用 + 多次 DB 查询，
 *       单次可能 30s+，超过 nginx/express 默认 30s 超时。
 *
 * 解决：
 *   - analyzeAsync(id) 立即返回 jobId（status: 'pending'），后台跑 analyze()
 *   - getJobStatus(jobId) 供前端轮询
 *   - 失败 → status: 'failed' + error 字段
 *   - 成功 → status: 'completed' + result
 *
 * 注意：内存 map（多实例部署需替换为 Redis/PostgreSQL；v4 暂保留内存版本以最小变更）
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import { rootCauseAnalysisService } from './rootCauseAnalysisService';

export type RcaJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RcaJob {
  id: string;
  rcaId: string;  // 关联的 rca 记录 ID
  status: RcaJobStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
}

class RcaJobManager {
  /** jobId → Job */
  private jobs = new Map<string, RcaJob>();
  /** rcaId → jobId（用于按 rcaId 查 job） */
  private rcaToJob = new Map<string, string>();
  /** job TTL：10 分钟（成功后过期） */
  private readonly JOB_TTL_MS = 10 * 60 * 1000;
  /** 清理定时器 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * 异步分析：立刻返回 jobId，后台执行
   * @param rcaId 已在数据库中存在的 rca 记录 id
   * @returns jobId
   */
  analyzeAsync(rcaId: string): string {
    const jobId = randomUUID();
    const job: RcaJob = {
      id: jobId,
      rcaId,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);
    this.rcaToJob.set(rcaId, jobId);

    // 后台跑（不 await，立即返回 jobId）
    setImmediate(() => this.runJob(job));

    logger.info(`📋 [RCA] Job ${jobId} created for rcaId=${rcaId}`);
    return jobId;
  }

  /**
   * 后台执行 analyze
   */
  private async runJob(job: RcaJob) {
    job.status = 'running';
    const startMs = Date.now();

    try {
      const result = await rootCauseAnalysisService.analyze(job.rcaId);
      const elapsed = Date.now() - startMs;
      job.status = result ? 'completed' : 'failed';
      job.finishedAt = new Date().toISOString();
      job.durationMs = elapsed;
      if (!result) {
        job.error = '分析失败：未返回结果';
      }
      logger.info(`✅ [RCA] Job ${job.id} ${job.status} (${elapsed}ms)`);
    } catch (err) {
      const elapsed = Date.now() - startMs;
      job.status = 'failed';
      job.finishedAt = new Date().toISOString();
      job.durationMs = elapsed;
      job.error = (err as Error).message;
      logger.error(`❌ [RCA] Job ${job.id} failed (${elapsed}ms):`, err as Error);
    }
  }

  /**
   * 查询 job 状态（前端轮询）
   */
  getJob(jobId: string): RcaJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * 按 rcaId 查最新 job（用于 GET /:id 页面自动找到 jobId）
   */
  getJobByRcaId(rcaId: string): RcaJob | null {
    const jobId = this.rcaToJob.get(rcaId);
    if (!jobId) return null;
    return this.jobs.get(jobId) || null;
  }

  /**
   * 清理过期 job（防止内存泄漏）
   */
  private startCleanupTimer() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [id, job] of this.jobs) {
        if (job.finishedAt) {
          const age = now - new Date(job.finishedAt).getTime();
          if (age > this.JOB_TTL_MS) {
            this.jobs.delete(id);
            if (job.rcaId) this.rcaToJob.delete(job.rcaId);
            cleaned++;
          }
        }
      }
      if (cleaned > 0) {
        logger.debug(`🧹 [RCA] Cleaned ${cleaned} expired jobs`);
      }
    }, 60_000);
    this.cleanupTimer.unref();
  }

  /** 测试/调试用：清空所有 job */
  clear() {
    this.jobs.clear();
    this.rcaToJob.clear();
  }
}

export const rcaJobManager = new RcaJobManager();
