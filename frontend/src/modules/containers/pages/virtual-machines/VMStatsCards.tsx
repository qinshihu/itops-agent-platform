import { AlertCircle, Play, Server, Square } from 'lucide-react';
import type { AggregatedStats } from './types';

interface VMStatsCardsProps {
  aggregatedStats?: AggregatedStats;
}

export function VMStatsCards({ aggregatedStats }: VMStatsCardsProps) {
  const summary = aggregatedStats?.summary ?? { total: 0, poweredOn: 0, poweredOff: 0, suspended: 0 };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
            <Server className="w-4 h-4" />
            虚拟机总数
          </div>
          <div className="text-2xl font-bold text-text-primary">{summary.total}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
            <Play className="w-4 h-4" />
            运行中
          </div>
          <div className="text-2xl font-bold text-green-400">{summary.poweredOn}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
            <Square className="w-4 h-4" />
            已关机
          </div>
          <div className="text-2xl font-bold text-red-400">{summary.poweredOff}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
            <AlertCircle className="w-4 h-4" />
            已挂起
          </div>
          <div className="text-2xl font-bold text-yellow-400">{summary.suspended}</div>
        </div>
      </div>

      {(aggregatedStats?.platforms ?? []).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {(aggregatedStats?.platforms ?? []).map(platformStats => (
            <div key={platformStats.platformId} className="bg-surface border border-border rounded-lg px-4 py-2 flex items-center gap-3 text-sm">
              <span className="text-text-primary font-medium">{platformStats.platformName}</span>
              <span className="text-text-tertiary">|</span>
              <span className="text-text-secondary">共 {platformStats.total}</span>
              <span className="text-green-400">运行 {platformStats.poweredOn}</span>
              <span className="text-red-400">关机 {platformStats.poweredOff}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
