/**
 * retry 工具测试
 *
 * 验证：
 *   - calculateExponentialBackoffDelay 指数退避 + maxDelay 上限
 *   - withRetry 成功路径不重试
 *   - withRetry 失败后重试成功
 *   - withRetry 达到 maxRetries 后抛出
 *   - shouldRetry 回调控制是否重试
 *   - isRetryableError 识别可重试错误
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateExponentialBackoffDelay,
  withRetry,
  isRetryableError,
  RetryableError,
} from './retry';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('calculateExponentialBackoffDelay', () => {
  it('按 factor 指数增长', () => {
    expect(calculateExponentialBackoffDelay(0, 1000, 30000, 2)).toBe(1000);
    expect(calculateExponentialBackoffDelay(1, 1000, 30000, 2)).toBe(2000);
    expect(calculateExponentialBackoffDelay(2, 1000, 30000, 2)).toBe(4000);
    expect(calculateExponentialBackoffDelay(3, 1000, 30000, 2)).toBe(8000);
  });

  it('不超过 maxDelayMs', () => {
    expect(calculateExponentialBackoffDelay(10, 1000, 30000, 2)).toBe(30000);
  });
});

describe('withRetry', () => {
  it('成功路径不重试', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('失败后重试成功', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('达到 maxRetries 后抛出最后一个错误', async () => {
    const error = new Error('persistent');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 1 })).rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('shouldRetry 返回 false 时不重试', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));
    const shouldRetry = vi.fn(() => false);

    await expect(withRetry(fn, { maxRetries: 3, shouldRetry, initialDelayMs: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalled();
  });

  it('onRetry 回调被调用', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { maxRetries: 2, onRetry, initialDelayMs: 1 });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
  });
});

describe('isRetryableError', () => {
  it('RetryableError 实例返回 true', () => {
    expect(isRetryableError(new RetryableError('test'))).toBe(true);
  });

  it('ECONNRESET 错误返回 true', () => {
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
  });

  it('普通错误返回 false', () => {
    expect(isRetryableError(new Error('validation failed'))).toBe(false);
  });

  it('字符串错误也可识别', () => {
    expect(isRetryableError('Connection refused')).toBe(true);
  });
});
