import { Activity } from 'lucide-react';
import type { PolicyWithStats } from './types';
import { formatDuration } from './utils';

interface PolicySuccessRankingProps {
  policies: PolicyWithStats[];
}

export function PolicySuccessRanking({ policies }: PolicySuccessRankingProps) {
  return (
    <div className="bg-surface/30 border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          策略成功率排行
        </h2>
      </div>
      <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-thin">
        {policies.length > 0 ? (
          policies.map((policy, index) => (
            <div
              key={policy.id}
              className="p-3 rounded-lg bg-surface hover:bg-slate-700/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : index === 1
                        ? 'bg-slate-400/20 text-text-primary'
                        : index === 2
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-slate-700/50 text-text-tertiary'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm text-text-primary font-medium truncate max-w-[120px]">
                    {policy.name}
                  </span>
                </div>
                <span
                  className={`text-sm font-bold ${
                    policy.stats.success_rate >= 80
                      ? 'text-green-400'
                      : policy.stats.success_rate >= 50
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {policy.stats.success_rate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    policy.stats.success_rate >= 80
                      ? 'bg-green-500'
                      : policy.stats.success_rate >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${policy.stats.success_rate}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs text-text-tertiary">
                <span>触发 {policy.stats.total_triggers} 次</span>
                <span>平均 {formatDuration(policy.stats.avg_duration_ms)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-text-tertiary">
            暂无策略执行数据
          </div>
        )}
      </div>
    </div>
  );
}

export default PolicySuccessRanking;
