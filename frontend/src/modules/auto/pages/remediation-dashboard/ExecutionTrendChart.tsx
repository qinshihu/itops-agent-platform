import { BarChart3 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ExecutionTrendItem } from './types';

interface ExecutionTrendChartProps {
  executionTrend?: ExecutionTrendItem[];
  maxTriggers: number;
  trendPeriod: '24h' | '7d';
}

export function ExecutionTrendChart({
  executionTrend,
  maxTriggers,
  trendPeriod,
}: ExecutionTrendChartProps) {
  return (
    <div className="lg:col-span-2 bg-surface/30 border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          执行趋势
        </h2>
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            成功
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            失败
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            执行中
          </span>
        </div>
      </div>
      <div className="h-48 flex items-end gap-1.5">
        {executionTrend && executionTrend.length > 0 ? (
          executionTrend.slice(-24).map((item, index) => {
            const successHeight = (item.completed / maxTriggers) * 100;
            const failedHeight = (item.failed / maxTriggers) * 100;
            const runningHeight = (item.running / maxTriggers) * 100;
            const label = trendPeriod === '24h'
              ? format(parseISO(item.time_bucket), 'HH:mm')
              : format(parseISO(item.time_bucket), 'MM/dd');
            return (
              <div key={index} className="flex-1 flex flex-col items-center group">
                <div className="relative w-full flex flex-col items-center h-40 justify-end">
                  <div className="absolute bottom-0 w-full flex flex-col items-center">
                    {runningHeight > 0 && (
                      <div
                        className="w-full bg-purple-500/60 rounded-t-sm min-h-[2px] transition-all hover:bg-purple-400"
                        style={{ height: `${runningHeight}%` }}
                      />
                    )}
                    {successHeight > 0 && (
                      <div
                        className="w-full bg-green-500/60 min-h-[2px] transition-all hover:bg-green-400"
                        style={{ height: `${successHeight}%` }}
                      />
                    )}
                    {failedHeight > 0 && (
                      <div
                        className="w-full bg-red-500/60 rounded-b-sm min-h-[2px] transition-all hover:bg-red-400"
                        style={{ height: `${failedHeight}%` }}
                      />
                    )}
                  </div>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    总数: {item.total}
                  </div>
                </div>
                <span className="text-[10px] text-text-tertiary mt-2 truncate w-full text-center">
                  {label}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-tertiary">
            暂无执行数据
          </div>
        )}
      </div>
    </div>
  );
}

export default ExecutionTrendChart;
