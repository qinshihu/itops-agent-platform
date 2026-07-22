import axios, { type AxiosError, type AxiosInstance, type CreateAxiosDefaults } from 'axios';
import { logger } from '../../../utils/logger';

/**
 * Prometheus HTTP API 客户端
 *
 * 封装 Prometheus / VictoriaMetrics 兼容的 HTTP API：
 *   - /api/v1/query
 *   - /api/v1/query_range
 *   - /api/v1/series
 *   - /api/v1/labels
 *   - /api/v1/metadata
 *   - /-/healthy
 *
 * 设计要点：
 *   1. 每次调用基于 opts 动态创建 axios 实例（不缓存长连接），避免跨调用状态泄漏；
 *      对于高频调用场景，调用方可在外部基于 prometheusService 二次封装。
 *   2. 不强制每次实例化：queryFamily() 返回的实例仅本次请求使用。
 *   3. 统一返回 { success, data?, error? }，便于上层 routes 直接转发。
 */

export interface PrometheusClientBasicAuth {
  username: string;
  password: string;
}

export interface PrometheusClientOptions {
  url: string;
  basicAuth?: PrometheusClientBasicAuth;
  bearerToken?: string;
  timeoutMs?: number;
}

/** Prometheus API 统一响应 envelope */
export interface PrometheusApiEnvelope<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  errorType?: string;
  error?: string;
  warnings?: string[];
}

/** 标准 instant query 数据 */
export interface PrometheusQueryResult {
  resultType: 'matrix' | 'vector' | 'scalar' | 'string';
  result: Array<{
    metric: Record<string, string>;
    value?: [number, string];
    values?: Array<[number, string]>;
  }>;
}

/** series 接口数据 */
export type PrometheusSeriesResult = Array<Record<string, string>>;

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 10000;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildAuthHeaders(opts: PrometheusClientOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.bearerToken && opts.bearerToken.length > 0) {
    headers.Authorization = `Bearer ${opts.bearerToken}`;
  }
  return headers;
}

function buildAxiosConfig(opts: PrometheusClientOptions): CreateAxiosDefaults {
  const config: CreateAxiosDefaults = {
    baseURL: normalizeBaseUrl(opts.url),
    timeout: opts.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_TIMEOUT_MS,
    headers: buildAuthHeaders(opts),
    // 阻止 axios 抛非 2xx，统一在外层 try/catch 中处理
    validateStatus: () => true,
  };

  if (opts.basicAuth?.username) {
    config.auth = {
      username: opts.basicAuth.username,
      password: opts.basicAuth.password ?? '',
    };
  }
  return config;
}

function describeAxiosError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError;
    if (ax.code === 'ECONNABORTED') {
      return `请求超时（${ax.config?.timeout ?? '?'}ms）`;
    }
    if (ax.code === 'ENOTFOUND' || ax.code === 'EAI_AGAIN') {
      return ax.message || 'DNS 解析失败';
    }
    if (ax.code === 'ECONNREFUSED') {
      return ax.message || '连接被拒绝';
    }
    if (ax.code === 'ECONNRESET') {
      return ax.message || '连接被重置';
    }
    if (ax.code === 'CERT_HAS_EXPIRED' || ax.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return ax.message || 'TLS 证书校验失败';
    }
    return ax.message || `HTTP 请求失败 (${ax.code ?? 'UNKNOWN'})`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function isEnvelope<T>(value: unknown): value is PrometheusApiEnvelope<T> {
  return typeof value === 'object' && value !== null && 'status' in value;
}

class PrometheusService {
  private buildClient(opts: PrometheusClientOptions): AxiosInstance {
    return axios.create(buildAxiosConfig(opts));
  }

  private buildConnectionError(err: unknown): ServiceResult<never> {
    const msg = describeAxiosError(err);
    return { success: false, error: `无法连接到 Prometheus: ${msg}` };
  }

  private async sendRequest<T>(
    client: AxiosInstance,
    method: 'GET' | 'POST',
    path: string,
    options: { params?: Record<string, unknown>; data?: unknown } = {},
  ): Promise<ServiceResult<T>> {
    try {
      const response = await client.request({
        method,
        url: path,
        params: options.params,
        data: options.data,
        headers:
          method === 'POST'
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : undefined,
      });

      const envelope: PrometheusApiEnvelope<T> | undefined = isEnvelope<T>(response.data)
        ? response.data
        : undefined;

      if (response.status < 200 || response.status >= 300) {
        const detail = envelope?.error || envelope?.errorType || `HTTP ${response.status}`;
        return {
          success: false,
          error: `Prometheus 返回错误 (${response.status}): ${detail}`,
        };
      }

      if (!envelope) {
        return {
          success: false,
          error: `Prometheus 返回内容无法解析 (HTTP ${response.status})`,
        };
      }

      if (envelope.status === 'error') {
        return {
          success: false,
          error: envelope.error || envelope.errorType || 'Prometheus 业务错误',
        };
      }

      return { success: true, data: envelope.data };
    } catch (err) {
      logger.error('Prometheus HTTP 调用失败:', err);
      return this.buildConnectionError(err);
    }
  }

  /** instant query: POST /api/v1/query */
  async query(
    promql: string,
    opts: PrometheusClientOptions & { time?: string | number | Date } = {} as PrometheusClientOptions,
  ): Promise<ServiceResult<PrometheusQueryResult>> {
    const { time, ...clientOpts } = opts;
    const client = this.buildClient(clientOpts);
    const data: Record<string, string> = { query: promql };
    if (time !== undefined && time !== null) {
      const t = time instanceof Date ? time.toISOString() : String(time);
      data.time = t;
    }
    return this.sendRequest<PrometheusQueryResult>(client, 'POST', '/api/v1/query', {
      data: new URLSearchParams(data).toString(),
    });
  }

  /** range query: POST /api/v1/query_range */
  async queryRange(
    promql: string,
    start: string | number | Date,
    end: string | number | Date,
    step: string | number,
    opts: PrometheusClientOptions = {} as PrometheusClientOptions,
  ): Promise<ServiceResult<PrometheusQueryResult>> {
    const client = this.buildClient(opts);
    const fmt = (v: string | number | Date): string =>
      v instanceof Date ? v.toISOString() : String(v);
    const form = new URLSearchParams({
      query: promql,
      start: fmt(start),
      end: fmt(end),
      step: typeof step === 'number' ? `${step}s` : String(step),
    });
    return this.sendRequest<PrometheusQueryResult>(client, 'POST', '/api/v1/query_range', {
      data: form.toString(),
    });
  }

  /** series metadata: POST /api/v1/series */
  async getSeries(
    match: string[],
    opts: PrometheusClientOptions & {
      start?: string | number | Date;
      end?: string | number | Date;
    } = {} as PrometheusClientOptions,
  ): Promise<ServiceResult<PrometheusSeriesResult>> {
    const { start, end, ...clientOpts } = opts;
    const client = this.buildClient(clientOpts);
    const form = new URLSearchParams();
    for (const m of match) {
      form.append('match[]', m);
    }
    if (start !== undefined && start !== null) {
      form.set(
        'start',
        start instanceof Date ? start.toISOString() : String(start),
      );
    }
    if (end !== undefined && end !== null) {
      form.set(
        'end',
        end instanceof Date ? end.toISOString() : String(end),
      );
    }
    return this.sendRequest<PrometheusSeriesResult>(client, 'POST', '/api/v1/series', {
      data: form.toString(),
    });
  }

  /** labels list: GET /api/v1/labels */
  async getLabels(
    opts: PrometheusClientOptions & {
      start?: string | number | Date;
      end?: string | number | Date;
      match?: string[];
    } = {} as PrometheusClientOptions,
  ): Promise<ServiceResult<string[]>> {
    const { start, end, match, ...clientOpts } = opts;
    const client = this.buildClient(clientOpts);
    const params: Record<string, unknown> = {};
    if (start !== undefined && start !== null) {
      params.start = start instanceof Date ? start.toISOString() : String(start);
    }
    if (end !== undefined && end !== null) {
      params.end = end instanceof Date ? end.toISOString() : String(end);
    }
    if (match && match.length > 0) {
      params['match[]'] = match;
    }
    return this.sendRequest<string[]>(client, 'GET', '/api/v1/labels', { params });
  }

  /** metric metadata: GET /api/v1/metadata */
  async getMetadata(
    metric: string | undefined,
    opts: PrometheusClientOptions = {} as PrometheusClientOptions,
  ): Promise<ServiceResult<Record<string, Array<Record<string, unknown>>>>> {
    const client = this.buildClient(opts);
    const params: Record<string, unknown> = {};
    if (metric && metric.length > 0) {
      params.metric = metric;
    }
    return this.sendRequest<Record<string, Array<Record<string, unknown>>>>(
      client,
      'GET',
      '/api/v1/metadata',
      { params },
    );
  }

  /** health check: GET /-/healthy */
  async checkConnection(
    opts: PrometheusClientOptions,
  ): Promise<ServiceResult<{ status: string; latencyMs: number; target: string }>> {
    const start = Date.now();
    const client = this.buildClient(opts);
    try {
      const response = await client.get('/-/healthy', {
        // 健康检查使用略短的超时（向上覆盖）
        timeout: opts.timeoutMs && opts.timeoutMs > 0 ? Math.min(opts.timeoutMs, 5000) : 5000,
      });
      const latencyMs = Date.now() - start;
      if (response.status === 200) {
        return {
          success: true,
          data: {
            status: 'healthy',
            latencyMs,
            target: normalizeBaseUrl(opts.url),
          },
        };
      }
      return {
        success: false,
        error: `Prometheus 健康检查失败 (HTTP ${response.status})`,
        data: {
          status: 'unhealthy',
          latencyMs,
          target: normalizeBaseUrl(opts.url),
        },
      };
    } catch (err) {
      return {
        ...this.buildConnectionError(err),
        data: {
          status: 'unreachable',
          latencyMs: Date.now() - start,
          target: normalizeBaseUrl(opts.url),
        },
      };
    }
  }
}

export const prometheusService = new PrometheusService();
export { PrometheusService };
