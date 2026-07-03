// ── 辅助函数 ──

import type { AlertRecord } from './types';

export const MAX_LIMIT = 100;

export function parseMetadata(alert: AlertRecord | undefined): AlertRecord | undefined {
  if (!alert) return undefined;
  if (alert.metadata) {
    try {
      alert.metadata = JSON.parse(alert.metadata);
    } catch {
      alert.metadata = '{}';
    }
  }
  return alert;
}

export function parseMetadataList(alerts: AlertRecord[]): AlertRecord[] {
  return alerts.map((a) => {
    if (a.metadata) {
      try {
        a.metadata = JSON.parse(a.metadata);
      } catch {
        a.metadata = '{}';
      }
    }
    return a;
  });
}

export function clampLimit(limit?: number): number | undefined {
  if (!limit) return undefined;
  if (isNaN(limit) || limit <= 0) return undefined;
  return Math.min(limit, MAX_LIMIT);
}
