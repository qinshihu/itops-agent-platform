/**
 * CircuitBreaker 单元测试
 *
 * 验证熔断器状态机：
 *   CLOSED → (N 次失败) → OPEN → (超时后) → HALF_OPEN → (成功) → CLOSED
 *                                          → (失败) → OPEN
 *   HALF_OPEN 达到 maxHalfOpenAttempts 后重新阻断
 *
 * 同时测试 callWithRetry 包装函数的重试与熔断交互。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock logger ──
vi.mock("../../../../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

import { CircuitBreaker, callWithRetry, getCircuitBreakerStats } from './circuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    // maxFailures=3, resetTimeout=1000ms 方便测试
    breaker = new CircuitBreaker(3, 1000);
  });

  describe('初始状态 (CLOSED)', () => {
    it('初始状态为 CLOSED，canCall() 返回 true', () => {
      expect(breaker.canCall()).toBe(true);
    });

    it('新实例的 canCall() 可连续返回 true', () => {
      expect(breaker.canCall()).toBe(true);
      expect(breaker.canCall()).toBe(true);
      expect(breaker.canCall()).toBe(true);
    });
  });

  describe('CLOSED → OPEN 转换', () => {
    it('未达 maxFailures 时仍为 CLOSED', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      // 2 < 3 → 仍可调用
      expect(breaker.canCall()).toBe(true);
    });

    it('达到 maxFailures 次失败后转为 OPEN', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      // 3 >= 3 → OPEN
      expect(breaker.canCall()).toBe(false);
    });

    it('OPEN 状态下 canCall() 快速失败不调用包装函数', () => {
      // 触发 OPEN
      for (let i = 0; i < 3; i++) breaker.recordFailure();

      const spy = vi.fn();
      // canCall 直接返回 false，不会调用任何业务函数
      expect(breaker.canCall()).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('OPEN → HALF_OPEN 转换 (超时恢复)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('resetTimeout 未到时仍为 OPEN', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure();

      // 推进 500ms < 1000ms
      vi.advanceTimersByTime(500);
      expect(breaker.canCall()).toBe(false);
    });

    it('resetTimeout 到达后转为 HALF_OPEN，canCall() 返回 true', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure();

      // 推进 1001ms > 1000ms
      vi.advanceTimersByTime(1001);
      expect(breaker.canCall()).toBe(true);
    });

    it('HALF_OPEN 状态下允许多次试探请求（最多 maxHalfOpenAttempts=3）', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure();
      vi.advanceTimersByTime(1001);

      // 3 次半开试探都被允许
      expect(breaker.canCall()).toBe(true);  // halfOpenAttempts=1
      expect(breaker.canCall()).toBe(true);  // halfOpenAttempts=2
      expect(breaker.canCall()).toBe(true);  // halfOpenAttempts=3
      // 第 4 次达到上限，重新阻断
      expect(breaker.canCall()).toBe(false);
    });
  });

  describe('HALF_OPEN → CLOSED 转换 (成功恢复)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('HALF_OPEN 状态下 recordSuccess() 转为 CLOSED', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure();
      vi.advanceTimersByTime(1001);

      // HALF_OPEN
      expect(breaker.canCall()).toBe(true);
      // 成功 → CLOSED
      breaker.recordSuccess();
      expect(breaker.canCall()).toBe(true);
      // 可连续调用（CLOSED 状态）
      expect(breaker.canCall()).toBe(true);
    });

    it('recordSuccess() 重置 failures 计数', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();
      // failures 归零，需要再 3 次失败才会 OPEN
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.canCall()).toBe(true);
      breaker.recordFailure();
      expect(breaker.canCall()).toBe(false);
    });
  });

  describe('HALF_OPEN → OPEN 转换 (恢复失败)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('HALF_OPEN 状态下 recordFailure() 重新回到 OPEN', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure();
      vi.advanceTimersByTime(1001);

      // HALF_OPEN，允许一次试探
      expect(breaker.canCall()).toBe(true);
      // 试探失败 → 回到 OPEN
      breaker.recordFailure();
      // 立即调用应被阻断
      expect(breaker.canCall()).toBe(false);
    });

    it('回到 OPEN 后需要再次等待 resetTimeout 才能进入 HALF_OPEN', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure();
      vi.advanceTimersByTime(1001);

      expect(breaker.canCall()).toBe(true);
      breaker.recordFailure(); // 回到 OPEN，重置 lastFailureTime

      // 推进 500ms 仍为 OPEN
      vi.advanceTimersByTime(500);
      expect(breaker.canCall()).toBe(false);

      // 再推进 501ms（总 1001ms）→ HALF_OPEN
      vi.advanceTimersByTime(501);
      expect(breaker.canCall()).toBe(true);
    });
  });

  describe('recordSuccess 作为 reset 机制', () => {
    it('从 OPEN 状态调用 recordSuccess 后回到 CLOSED', () => {
      for (let i = 0; i < 3; i++) breaker.recordFailure();
      expect(breaker.canCall()).toBe(false); // OPEN

      breaker.recordSuccess();
      expect(breaker.canCall()).toBe(true); // CLOSED
      expect(breaker.canCall()).toBe(true);
    });

    it('recordSuccess 在 CLOSED 状态下也无副作用', () => {
      breaker.recordSuccess();
      expect(breaker.canCall()).toBe(true);
    });
  });

  describe('isIdle / getLastUsedTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('getLastUsedTime 返回最近一次 canCall 时间', () => {
      const t0 = breaker.getLastUsedTime();
      vi.advanceTimersByTime(500);
      breaker.canCall();
      const t1 = breaker.getLastUsedTime();
      expect(t1).toBeGreaterThan(t0);
    });

    it('isIdle 在超过空闲阈值后返回 true', () => {
      breaker.canCall(); // 更新 lastUsedTime
      vi.advanceTimersByTime(5001);
      expect(breaker.isIdle(5000)).toBe(true);
    });

    it('isIdle 在未超过阈值时返回 false', () => {
      breaker.canCall();
      vi.advanceTimersByTime(1000);
      expect(breaker.isIdle(5000)).toBe(false);
    });
  });
});

describe('callWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('首次成功时不重试', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await callWithRetry(fn, 3, 10, 100);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('失败时按指数退避重试', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('ok');

    const result = await callWithRetry(fn, 3, 10, 100);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('达到最大重试次数后抛出最后一个错误', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));
    await expect(callWithRetry(fn, 2, 10, 100)).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('熔断器 OPEN 时快速失败不调用 fn', async () => {
    const breaker = new CircuitBreaker(1, 60000);
    breaker.recordFailure(); // 1 >= 1 → OPEN

    const fn = vi.fn().mockResolvedValue('ok');
    await expect(callWithRetry(fn, 3, 10, 100, breaker)).rejects.toThrow(/Circuit breaker is OPEN/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('成功调用后调用方应通过 recordSuccess 恢复熔断器', async () => {
    const breaker = new CircuitBreaker(2, 60000);
    breaker.recordFailure(); // 1 failure
    // canCall 仍为 true（1 < 2）
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await callWithRetry(fn, 1, 10, 100, breaker);
    expect(result).toBe('ok');
    // 外部应调用 recordSuccess 恢复
    breaker.recordSuccess();
    expect(breaker.canCall()).toBe(true);
  });
});

describe('getCircuitBreakerStats', () => {
  it('返回包含 total/cleanupIntervalMin/idleThresholdHour/maxLimit 的统计', () => {
    const stats = getCircuitBreakerStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('cleanupIntervalMin');
    expect(stats).toHaveProperty('idleThresholdHour');
    expect(stats).toHaveProperty('maxLimit');
    expect(typeof stats.total).toBe('number');
    expect(stats.cleanupIntervalMin).toBeGreaterThan(0);
    expect(stats.idleThresholdHour).toBeGreaterThan(0);
    expect(stats.maxLimit).toBeGreaterThan(0);
  });
});
