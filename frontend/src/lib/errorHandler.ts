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

export function handleApiError(err: unknown, context?: string): string {
  const msg = getAxiosErrorMessage(err, '请求失败');
  const fullMsg = context ? `${context}: ${msg}` : msg;
  logger.error(`[API Error]${context ? ` ${context}` : ''}:`, err);
  return fullMsg;
}
