/**
 * Zabbix 页面共享类型、常量与列定义
 */

import type { ReactNode } from 'react';

export type AuthMode = 'password' | 'token';

export type TabKey = 'hosts' | 'items' | 'triggers' | 'problems' | 'history' | 'test';

export interface ConnectionConfig {
  url: string;
  username: string;
  password: string;
  apiToken: string;
  authMode: AuthMode;
  timeoutMs: number;
}

export interface ZabbixResponse<T> {
  result?: T[];
  error?: string;
}

export interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: string;
}

export interface ZabbixItem {
  itemid: string;
  hostid: string;
  name: string;
  key_: string;
  lastvalue?: string;
  units?: string;
}

export interface ZabbixTrigger {
  triggerid: string;
  description: string;
  priority: string;
  value: string;
}

export interface ZabbixProblem {
  eventid: string;
  name: string;
  severity: string;
  acknowledged: string;
}

export interface ZabbixHistoryRow {
  itemid: string;
  clock: string;
  value: string;
  ns?: string;
}

export interface ColumnDef<T> {
  key: keyof T;
  title: string;
  render?: (row: T) => ReactNode;
}

export const PRIORITY_LABELS: Record<string, string> = {
  '0': '未分类', '1': '信息', '2': '警告', '3': '一般严重',
  '4': '严重', '5': '灾难',
};

export const PRIORITY_COLORS: Record<string, string> = {
  '0': 'text-slate-400', '1': 'text-blue-400', '2': 'text-yellow-400',
  '3': 'text-orange-400', '4': 'text-red-400', '5': 'text-red-600',
};

export function buildPayload(cfg: ConnectionConfig, extras: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = { url: cfg.url.trim(), timeoutMs: cfg.timeoutMs };
  if (cfg.authMode === 'token') {
    base.apiToken = cfg.apiToken.trim();
  } else {
    base.username = cfg.username.trim();
    base.password = cfg.password;
  }
  return { ...base, ...extras };
}

const priorityBadge = (priority: string) => (
  <span className={PRIORITY_COLORS[priority] ?? 'text-text-secondary'}>
    {PRIORITY_LABELS[priority] ?? priority}
  </span>
);

export const HOST_COLUMNS: ColumnDef<ZabbixHost>[] = [
  { key: 'hostid', title: 'Host ID' },
  { key: 'host', title: 'Host' },
  { key: 'name', title: 'Name' },
  { key: 'status', title: 'Status',
    render: r => r.status === '0'
      ? <span className="text-status-success">enabled</span>
      : <span className="text-status-failed">disabled</span> },
];

export const ITEM_COLUMNS: ColumnDef<ZabbixItem>[] = [
  { key: 'itemid', title: 'Item ID' },
  { key: 'name', title: 'Name' },
  { key: 'key_', title: 'Key' },
  { key: 'lastvalue', title: 'Last Value' },
  { key: 'units', title: 'Units' },
];

export const TRIGGER_COLUMNS: ColumnDef<ZabbixTrigger>[] = [
  { key: 'triggerid', title: 'Trigger ID' },
  { key: 'description', title: 'Description' },
  { key: 'priority', title: 'Priority', render: r => priorityBadge(r.priority) },
  { key: 'value', title: 'Value',
    render: r => r.value === '1'
      ? <span className="text-status-failed">PROBLEM</span>
      : <span className="text-status-success">OK</span> },
];

export const PROBLEM_COLUMNS: ColumnDef<ZabbixProblem>[] = [
  { key: 'eventid', title: 'Event ID' },
  { key: 'name', title: 'Name' },
  { key: 'severity', title: 'Severity', render: r => priorityBadge(r.severity) },
  { key: 'acknowledged', title: 'Acknowledged',
    render: r => r.acknowledged === '1'
      ? <span className="text-status-success">Yes</span>
      : <span className="text-status-warning">No</span> },
];

export const HISTORY_COLUMNS: ColumnDef<ZabbixHistoryRow>[] = [
  { key: 'itemid', title: 'Item ID' },
  { key: 'clock', title: 'Clock' },
  { key: 'value', title: 'Value' },
  { key: 'ns', title: 'ns' },
];