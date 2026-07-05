/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 统一 API 响应格式工具
 * 所有路由统一使用此工具返回，保证前端始终收到一致格式
 */

import type { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function respond<T = any>(res: Response, data?: T, status = 200) {
  const body: ApiResponse<T> = { success: true };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}

export function respondMessage(res: Response, message: string, status = 200) {
  return res.status(status).json({ success: true, message, data: null } satisfies ApiResponse);
}

export function respondError(res: Response, error: string, status = 400, details?: unknown) {
  const body: ApiResponse = { success: false, error };
  if (details && process.env.NODE_ENV !== 'production') {
    (body as any).details = details;
  }
  return res.status(status).json(body);
}

export function respondPagination<T = any>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return res.status(200).json({
    success: true,
    data,
    pagination: { page, pageSize, total },
  } satisfies ApiResponse<T[]>);
}
