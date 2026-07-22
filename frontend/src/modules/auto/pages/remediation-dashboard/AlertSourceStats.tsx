import { AlertTriangle } from 'lucide-react';
import type { AlertSourceStats } from './types';

interface AlertSourceStatsProps {
  sources?: AlertSourceStats[];
}

export function AlertSourceStatsComponent({ sources }: AlertSourceStatsProps) {
  return (
    <div className="bg-surface/30 border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          按告警来源分组统计
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources && sources.length > 0 ? (
          sources.slice(0, 6).map((source) => {
            const resolveRate =
              source.total_alerts > 0
                ? ((source.resolved_alerts / source.total_alerts) * 100).toFixed(1)
                : '0';
            return (
              <div
                key={source.source}
                className="p-4 rounded-lg bg-surface border border-border/30 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-text-primary text-sm">{source.source}</h3>
                  <span className="text-xs text-text-secondary">
                    解决率 {resolveRate}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-center p-2 bg-surface/50 rounded">
                    <div className="text-lg font-bold text-text-primary">{source.total_alerts}</div>
                    <div className="text-[10px] text-text-tertiary">总告警</div>
                  </div>
                  <div className="text-center p-2 bg-green-500/5 rounded">
                    <div className="text-lg font-bold text-green-400">{source.resolved_alerts}</div>
                    <div className="text-[10px] text-text-tertiary">已解决</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {source.critical_count > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
                      严重 {source.critical_count}
                    </span>
                  )}
                  {source.high_count > 0 && (
                    <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded">
                      高 {source.high_count}
                    </span>
                  )}
                  {source.medium_count > 0 && (
                    <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">
                      中 {source.medium_count}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-3 text-center py-8 text-text-tertiary">
            暂无告警来源数据
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertSourceStatsComponent;
