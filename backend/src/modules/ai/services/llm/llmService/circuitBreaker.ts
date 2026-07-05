/**
 * 熔断器模块
 *
 * 提供按 Provider 拆分的熔断器实例管理、空闲清理调度，
 * 以及带重试+熔断的 API 调用包装 callWithRetry。
 *
 * 依赖方向：本模块无内部依赖，是 llmService 的最底层。
 */

import { logger } from '../../../../../utils/logger';

// ── 类型 ──

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  lastUsedTime: number;
  isOpen: boolean;
  halfOpenAttempts: number;
  maxHalfOpenAttempts: number;
}

// ── 熔断器实现 ──

class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    lastUsedTime: Date.now(),
    isOpen: false,
    halfOpenAttempts: 0,
    maxHalfOpenAttempts: 3
  };

  constructor(
    private readonly maxFailures = 5,
    private readonly resetTimeout = 60000
  ) {}

  canCall(): boolean {
    this.state.lastUsedTime = Date.now();

    if (this.state.isOpen) {
      const now = Date.now();
      if (now - this.state.lastFailureTime > this.resetTimeout) {
        if (this.state.halfOpenAttempts >= this.state.maxHalfOpenAttempts) {
          logger.info('🔌 Circuit breaker half-open limit reached, still blocking');
          return false;
        }
        logger.info('🔄 Circuit breaker half-open, allowing test request');
        this.state.halfOpenAttempts++;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.state.failures = 0;
    this.state.isOpen = false;
    this.state.halfOpenAttempts = 0;
    this.state.lastUsedTime = Date.now();
  }

  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();
    this.state.lastUsedTime = Date.now();
    if (this.state.failures >= this.maxFailures) {
      logger.info('🔌 Circuit breaker opened due to too many failures');
      this.state.isOpen = true;
      this.state.halfOpenAttempts = 0;
    }
  }

  getLastUsedTime(): number {
    return this.state.lastUsedTime;
  }

  isIdle(idleThresholdMs: number): boolean {
    return Date.now() - this.state.lastUsedTime > idleThresholdMs;
  }
}

// ── 配置常量 ──

const CIRCUIT_BREAKER_IDLE_THRESHOLD = 60 * 60 * 1000; // 1 小时未使用则清理
const CIRCUIT_BREAKER_CLEANUP_INTERVAL = 30 * 60 * 1000; // 每 30 分钟清理一次
const MAX_CIRCUIT_BREAKERS = 100; // 最大熔断器实例数量

// ── 熔断器实例表 ──

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(providerName: string): CircuitBreaker {
  if (!circuitBreakers.has(providerName)) {
    enforceCircuitBreakerLimit();
    circuitBreakers.set(providerName, new CircuitBreaker());
    logger.info(`🔌 Circuit breaker initialized for provider: ${providerName}, total: ${circuitBreakers.size}`);
  }
  return circuitBreakers.get(providerName)!;
}

function enforceCircuitBreakerLimit(): void {
  if (circuitBreakers.size >= MAX_CIRCUIT_BREAKERS) {
    const entries = Array.from(circuitBreakers.entries());
    entries.sort((a, b) => a[1].getLastUsedTime() - b[1].getLastUsedTime());
    const toRemove = entries.slice(0, Math.ceil(entries.length / 2));
    toRemove.forEach(([provider]) => {
      circuitBreakers.delete(provider);
    });
    logger.info(`🔌 Cleaned up ${toRemove.length} idle circuit breakers due to limit reached`);
  }
}

function cleanupIdleCircuitBreakers(): void {
  const idleProviders: string[] = [];
  for (const [provider, breaker] of circuitBreakers.entries()) {
    if (breaker.isIdle(CIRCUIT_BREAKER_IDLE_THRESHOLD)) {
      idleProviders.push(provider);
    }
  }

  if (idleProviders.length > 0) {
    idleProviders.forEach(provider => {
      circuitBreakers.delete(provider);
    });
    logger.info(`🔌 Cleaned up ${idleProviders.length} idle circuit breakers, remaining: ${circuitBreakers.size}`);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCircuitBreakerCleanup(): void {
  if (cleanupInterval) {
    return;
  }

  cleanupInterval = setInterval(() => {
    cleanupIdleCircuitBreakers();
  }, CIRCUIT_BREAKER_CLEANUP_INTERVAL);

  cleanupInterval.unref();
  logger.info('🔌 Circuit breaker cleanup scheduler started');
}

export function stopCircuitBreakerCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('🔌 Circuit breaker cleanup scheduler stopped');
  }
}

export function getCircuitBreakerStats(): { total: number; cleanupIntervalMin: number; idleThresholdHour: number; maxLimit: number } {
  return {
    total: circuitBreakers.size,
    cleanupIntervalMin: CIRCUIT_BREAKER_CLEANUP_INTERVAL / 60000,
    idleThresholdHour: CIRCUIT_BREAKER_IDLE_THRESHOLD / 3600000,
    maxLimit: MAX_CIRCUIT_BREAKERS
  };
}

// ── 共享工具 ──

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 带重试 + 熔断的 API 调用包装 */
export async function callWithRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 10000,
  breaker?: CircuitBreaker,
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Request cancelled by deadline signal');
    }
    if (breaker && !breaker.canCall()) {
      logger.error('🔌 Circuit breaker is OPEN, aborting retries');
      throw new Error('Circuit breaker is OPEN, rejecting request - service temporarily unavailable');
    }

    try {
      const result = await fn(signal);
      if (attempt > 1) {
        logger.info(`✅ Request succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error: unknown) {
      if ((error instanceof Error && error.name === 'CanceledError') || signal?.aborted) {
        throw new Error('Request cancelled by deadline signal');
      }
      lastError = error as Error;
      logger.warn(`⚠️ Request attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < maxRetries) {
        const delayMs = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        logger.info(`⏳ Waiting ${delayMs}ms before retry...`);
        await delay(delayMs + Math.random() * baseDelay);
      }
    }
  }

  logger.error(`❌ All ${maxRetries} retries failed`);
  throw lastError;
}

export { CircuitBreaker, circuitBreakers, getCircuitBreaker };
