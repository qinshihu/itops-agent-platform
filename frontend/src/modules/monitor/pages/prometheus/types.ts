// Prometheus 查询页面 - 类型定义

export type ResultType = 'vector' | 'matrix' | 'scalar' | 'string';

export interface PromResultItem {
  metric?: Record<string, string>;
  value?: [number, string];
  values?: Array<[number, string]>;
}

export interface PromResponse {
  status: 'success' | 'error';
  data?: { resultType: ResultType; result: PromResultItem[] };
  errorType?: string;
  error?: string;
}

export interface AuthConfig {
  url: string;
  username: string;
  password: string;
  bearerToken: string;
  timeoutMs: string;
}

export type QueryMode = 'instant' | 'range';