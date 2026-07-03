/**
 * sensitiveMask 工具测试
 *
 * 验证：
 *   - maskApiKey 短/长/null 三种情况
 *   - maskPassword 统一替换为 ********
 *   - maskPrivateKey 保留首行 + redacted
 *   - maskSensitiveData 递归脱敏 password/token/api_key/private_key 字段
 *   - maskSensitiveData 处理数组和嵌套对象
 */

import { describe, it, expect } from 'vitest';
import {
  maskApiKey,
  maskPassword,
  maskPrivateKey,
  maskSensitiveData,
} from './sensitiveMask';

describe('maskApiKey', () => {
  it('null/undefined/空 返回 "null"', () => {
    expect(maskApiKey(null)).toBe('null');
    expect(maskApiKey(undefined)).toBe('null');
    expect(maskApiKey('')).toBe('null');
  });

  it('≤8 字符返回 ****', () => {
    expect(maskApiKey('short')).toBe('****');
    expect(maskApiKey('12345678')).toBe('****');
  });

  it('长 key 保留前4+后4', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-1****cdef');
  });
});

describe('maskPassword', () => {
  it('null 返回 "null"', () => {
    expect(maskPassword(null)).toBe('null');
  });

  it('非空统一返回 ********', () => {
    expect(maskPassword('secret123')).toBe('********');
    expect(maskPassword('any')).toBe('********');
  });
});

describe('maskPrivateKey', () => {
  it('null 返回 "null"', () => {
    expect(maskPrivateKey(null)).toBe('null');
  });

  it('保留首行前20字符 + ...(redacted)...', () => {
    const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAI...\n-----END RSA PRIVATE KEY-----';
    const masked = maskPrivateKey(key);
    expect(masked).toContain('...(redacted)...');
    expect(masked).toContain('BEGIN RSA');
  });
});

describe('maskSensitiveData', () => {
  it('password 字段被脱敏', () => {
    const result = maskSensitiveData({ username: 'admin', password: 'secret123' });
    expect(result).toEqual({ username: 'admin', password: '********' });
  });

  it('token 字段被 maskApiKey', () => {
    const result = maskSensitiveData({ token: 'sk-1234567890abcdef' }) as Record<string, unknown>;
    expect(result.token).toBe('sk-1****cdef');
  });

  it('api_key 字段被 maskApiKey', () => {
    const result = maskSensitiveData({ api_key: 'ak-1234567890abcdef' }) as Record<string, unknown>;
    expect(result.api_key).toBe('ak-1****cdef');
  });

  it('嵌套对象递归脱敏', () => {
    const result = maskSensitiveData({
      user: { name: 'admin', password: 'pw' },
      normal: 'value',
    }) as Record<string, unknown>;
    expect((result.user as Record<string, unknown>).password).toBe('********');
    expect(result.normal).toBe('value');
  });

  it('数组递归脱敏', () => {
    const result = maskSensitiveData([
      { name: 'a', password: 'pw1' },
      { name: 'b', password: 'pw2' },
    ]) as Array<Record<string, unknown>>;
    expect(result[0].password).toBe('********');
    expect(result[1].password).toBe('********');
  });

  it('非敏感字段保持原值', () => {
    const result = maskSensitiveData({ name: 'admin', email: 'a@b.com' });
    expect(result).toEqual({ name: 'admin', email: 'a@b.com' });
  });

  it('private_key 字段被 maskPrivateKey', () => {
    const result = maskSensitiveData({
      private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAA\n-----END-----',
    }) as Record<string, unknown>;
    expect(result.private_key).toContain('(redacted)');
  });
});
