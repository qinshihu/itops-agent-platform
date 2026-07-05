/**
 * errors 类型测试
 *
 * 验证：
 *   - ErrorCode 枚举包含所有预定义错误码
 *   - createAppError 创建带 code/statusCode/details 的 Error
 *   - getErrorMessage 返回对应中文消息
 *   - ERROR_MESSAGES 覆盖所有 ErrorCode
 */

import { describe, it, expect } from 'vitest';
import { ErrorCode, createAppError, getErrorMessage, ERROR_MESSAGES } from './errors';

describe('ErrorCode', () => {
  it('包含核心错误码', () => {
    expect(ErrorCode.SERVER_ERROR).toBe('SERVER_ERROR');
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.AUTH_ERROR).toBe('AUTH_ERROR');
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
  });
});

describe('createAppError', () => {
  it('创建带 code 和默认 statusCode=500 的 Error', () => {
    const err = createAppError(ErrorCode.SERVER_ERROR, 'something broke');
    expect(err.code).toBe(ErrorCode.SERVER_ERROR);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('something broke');
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('Error');
  });

  it('自定义 statusCode 和 details', () => {
    const err = createAppError(
      ErrorCode.VALIDATION_ERROR, 'bad input', 400, { field: 'email' }
    );
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('getErrorMessage', () => {
  it('返回已知错误码的中文消息', () => {
    expect(getErrorMessage(ErrorCode.AUTH_ERROR)).toBe('认证失败，请重新登录');
    expect(getErrorMessage(ErrorCode.DATABASE_ERROR)).toBe('数据库操作失败');
  });

  it('未匹配时返回 SERVER_ERROR 消息', () => {
    expect(getErrorMessage('UNKNOWN_CODE' as ErrorCode)).toBe('服务器内部错误，请稍后重试');
  });
});

describe('ERROR_MESSAGES 完整性', () => {
  it('每个 ErrorCode 都有对应消息', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof ERROR_MESSAGES[code]).toBe('string');
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});
