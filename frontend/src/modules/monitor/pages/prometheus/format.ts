// Prometheus 查询页面 - 格式化与请求构造工具

import type { AuthConfig } from './types';

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ms);
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

export function parseTimestamp(s: string): number {
  const n = Number(s);
  if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

export function formatValue(s: string | undefined): string {
  if (s === undefined) return '-';
  const n = Number(s);
  return Number.isFinite(n) ? n.toString() : s;
}

export function buildRequestBody(
  auth: AuthConfig,
  promql: string,
  extras?: { start?: string; end?: string; step?: string; time?: string },
): Record<string, unknown> {
  const body: Record<string, unknown> = { url: auth.url.trim(), promql };
  const username = auth.username.trim();
  const password = auth.password;
  if (username || password) {
    body.basicAuth = { username, password };
  }
  const token = auth.bearerToken.trim();
  if (token) {
    body.bearerToken = token;
  }
  const t = auth.timeoutMs.trim();
  if (t) {
    const ms = Number(t);
    if (Number.isFinite(ms) && ms > 0) body.timeoutMs = ms;
  }
  if (extras?.start) body.start = extras.start;
  if (extras?.end) body.end = extras.end;
  if (extras?.step) body.step = extras.step;
  if (extras?.time) body.time = extras.time;
  return body;
}

export function unwrapResponse(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const inner = (raw as { data: unknown }).data;
    if (inner && typeof inner === 'object' && 'data' in inner && 'status' in inner) {
      return inner;
    }
    if (inner && typeof inner === 'object' && 'status' in inner) {
      return inner;
    }
    return inner;
  }
  return raw;
}