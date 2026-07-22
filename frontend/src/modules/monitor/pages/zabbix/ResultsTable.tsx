/**
 * Zabbix 通用结果表格
 *
 * 用于展示 Zabbix JSON-RPC 返回的 result[] 数据。
 */

import type { ReactNode } from 'react';
import type { ColumnDef } from './types';

export type { ColumnDef } from './types';

export function ResultsTable<T>({
  rows, columns, loading, emptyText = '暂无数据',
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyText?: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary text-sm py-6">
        <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        正在请求 Zabbix ...
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="text-text-tertiary text-sm py-6 text-center">{emptyText}</div>;
  }
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-secondary border-b border-border">
            {columns.map(c => (
              <th key={String(c.key)} className="py-2 px-3 font-medium">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-border/50 hover:bg-background/50">
              {columns.map(c => (
                <td key={String(c.key)} className="py-2 px-3 text-text-primary align-top">
                  {c.render ? c.render(row) : (row[c.key] as unknown as ReactNode) ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}