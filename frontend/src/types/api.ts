/**
 * 统一 API 响应类型定义
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}
