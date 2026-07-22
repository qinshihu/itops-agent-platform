import { AlertCircle } from 'lucide-react';
import type { PromResponse } from './types';
import { formatTimestamp, parseTimestamp, formatValue } from './format';

interface ResultsTableProps {
  loading: boolean;
  response: PromResponse | null;
}

export function ResultsTable({ loading, response }: ResultsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!response) {
    return (
      <div className="text-center py-12 text-text-tertiary text-sm">
        输入 PromQL 并点击「查询」开始
      </div>
    );
  }

  if (response.status === 'error' || !response.data) {
    return (
      <div className="flex items-start gap-2 p-4 rounded-lg bg-status-failed/10 border border-status-failed/30">
        <AlertCircle className="w-5 h-5 text-status-failed flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-status-failed font-medium text-sm">查询失败</p>
          <p className="text-status-failed/80 text-xs mt-1 font-mono break-all">
            {response.errorType ? `[${response.errorType}] ` : ''}
            {response.error || '未知错误'}
          </p>
        </div>
      </div>
    );
  }

  const { resultType, result } = response.data;

  if (result.length === 0) {
    return (
      <div className="text-center py-12 text-text-tertiary text-sm">
        查询成功，但无数据（result 为空）
      </div>
    );
  }

  if (resultType === 'scalar' || resultType === 'string') {
    const first = result[0];
    const ts = first.value?.[0];
    const v = first.value?.[1];
    return (
      <div className="p-4 rounded-lg bg-background border border-border">
        <div className="text-text-secondary text-xs mb-1">结果类型：{resultType}</div>
        <div className="font-mono text-lg text-emerald-400">{formatValue(v)}</div>
        {ts !== undefined && (
          <div className="text-text-tertiary text-xs mt-1 font-mono">
            @ {formatTimestamp(parseTimestamp(String(ts)))}
          </div>
        )}
      </div>
    );
  }

  const labelKeys = Array.from(
    new Set(result.flatMap((r) => Object.keys(r.metric || {}))),
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-background">
          <tr className="text-text-secondary border-b border-border">
            <th className="px-3 py-2 text-left font-medium text-xs">#</th>
            {labelKeys.map((k) => (
              <th key={k} className="px-3 py-2 text-left font-medium text-xs">{k}</th>
            ))}
            <th className="px-3 py-2 text-left font-medium text-xs">时间</th>
            <th className="px-3 py-2 text-right font-medium text-xs">值</th>
          </tr>
        </thead>
        <tbody>
          {result.flatMap((r, idx) => {
            const rows = r.values && r.values.length > 0 ? r.values : (r.value ? [r.value] : []);
            return rows.map(([ts, v], rowIdx) => (
              <tr key={`${idx}-${rowIdx}`} className="border-b border-border/50 hover:bg-background/50">
                <td className="px-3 py-2 text-text-tertiary text-xs">{rowIdx === 0 ? idx + 1 : ''}</td>
                {labelKeys.map((k) => (
                  <td key={k} className="px-3 py-2 text-text-primary text-xs font-mono">
                    {rowIdx === 0 ? (r.metric?.[k] ?? '') : ''}
                  </td>
                ))}
                <td className="px-3 py-2 text-text-secondary text-xs font-mono whitespace-nowrap">
                  {formatTimestamp(parseTimestamp(String(ts)))}
                </td>
                <td className="px-3 py-2 text-right text-emerald-400 text-xs font-mono">
                  {formatValue(v)}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}