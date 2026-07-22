/**
 * 敏感信息脱敏工具
 */

import { logger } from './logger';

/**
 * 脱敏 API Key / Token
 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return 'null';
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

/**
 * 脱敏密码
 */
export function maskPassword(password: string | null | undefined): string {
  if (!password) return 'null';
  return '********';
}

/**
 * 脱敏 SSH 私钥
 */
export function maskPrivateKey(key: string | null | undefined): string {
  if (!key) return 'null';
  const firstLine = key.trim().split('\n')[0];
  if (firstLine) {
    return firstLine.substring(0, 20) + '...(redacted)...';
  }
  return '(redacted private key)';
}

/**
 * 深度脱敏对象中的敏感信息
 */
export function maskSensitiveData(obj: unknown): unknown {
  if (!obj) return obj;
  
  if (typeof obj === 'string') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }
  
  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      
      // 敏感字段直接脱敏
      if (lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('passwd') ||
          lowerKey.includes('api_secret') ||
          lowerKey.includes('access_key')) {
        masked[key] = maskPassword(value as string);
      }
      else if (lowerKey.includes('token') ||
               lowerKey.includes('apikey') ||
               lowerKey.includes('api_key') ||
               lowerKey.includes('api-key') ||
               lowerKey.includes('accesskey') ||
               lowerKey.includes('access-key')) {
        masked[key] = maskApiKey(value as string);
      }
      else if (lowerKey.includes('private') && lowerKey.includes('key')) {
        masked[key] = maskPrivateKey(value as string);
      }
      else if (lowerKey === 'key' || lowerKey.endsWith('_key') || lowerKey.includes('credential')) {
        masked[key] = maskApiKey(value as string);
      }
      // 递归处理
      else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }
  
  return obj;
}

/**
 * 安全的日志输出函数 - 自动脱敏
 */
export function safeLog(...args: unknown[]): void {
  const maskedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return maskSensitiveData(arg);
    }
    return arg;
  });
  logger.info(...(maskedArgs as Parameters<typeof logger.info>));
}

export function safeError(...args: unknown[]): void {
  const maskedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return maskSensitiveData(arg);
    }
    return arg;
  });
  console.error(...maskedArgs);
}
