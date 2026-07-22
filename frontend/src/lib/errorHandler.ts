/**
 * 错误处理工具
 *
 * P2-9: 错误日志脱敏 — 防止 axios 错误对象中的请求体（含 api_key）写入浏览器日志
 * - logger.error 调用前先调用 sanitizeAxiosError
 * - 关键策略：剥离 config.data（请求体）中的 api_key / password / token
 */

interface AxiosErrorLike {
  response?: { data?: { error?: string; message?: string } };
  message?: string;
}

import { logger } from './logger';

function isAxiosErrorLike(err: unknown): err is AxiosErrorLike {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export function getErrorMessage(err: unknown, fallback = '操作失败'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

/** 提取 axios 错误中的服务端错误信息，优先取 response.data.error */
export function getAxiosErrorMessage(err: unknown, fallback = '操作失败'): string {
  if (isAxiosErrorLike(err)) {
    return err.response?.data?.error || err.response?.data?.message || getErrorMessage(err, fallback);
  }
  return getErrorMessage(err, fallback);
}

const SENSITIVE_KEYS = ['api_key', 'apiKey', 'password', 'privateKey', 'token', 'secret', 'authorization'];

/**
 * P2-9: 递归脱敏 axios 错误对象中的敏感字段
 * - 用 '***REDACTED***' 替换原值
 * - 仅对 string 类型值生效，避免破坏其他类型
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length <= 8) return '***';
    return `${value.slice(0, 4)}***${value.slice(-4)}`;
  }
  return value;
}

function sanitizeObject<T = unknown>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lowerKey === sk.toLowerCase() || lowerKey.includes(sk.toLowerCase()))) {
      result[k] = sanitizeValue(v);
    } else if (typeof v === 'object' && v !== null) {
      result[k] = sanitizeObject(v);
    } else {
      result[k] = v;
    }
  }
  return result as T;
}

/**
 * P2-9: 脱敏 axios 错误对象后再交给 logger
 * - 剥离 request body 中的 api_key 等敏感字段
 * - 保留 response.status / response.data（非敏感）等诊断信息
 */
export function sanitizeAxiosError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  const e = err as Record<string, unknown>;

  // 拷贝浅层（保留 message / stack），递归脱敏 config / request
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'config' || k === 'request' || k === 'response') {
      sanitized[k] = sanitizeObject(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export function handleApiError(err: unknown, context?: string): string {
  const msg = getAxiosErrorMessage(err, '请求失败');
  const fullMsg = context ? `${context}: ${msg}` : msg;
  // P2-9: 脱敏后再写日志，防止敏感字段泄露
  logger.error(`[API Error]${context ? ` ${context}` : ''}:`, sanitizeAxiosError(err));
  return fullMsg;
}