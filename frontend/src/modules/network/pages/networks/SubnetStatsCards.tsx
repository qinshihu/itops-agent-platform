/**
 * 统计卡片 widget（2026-07-21 拆分）
 *
 * 从原 Networks.tsx L409-423 抽出
 * 3 个统计卡片（子网总数 / IP 总量 / 已分配）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { Layers, Network, Router } from 'lucide-react';

export interface SubnetStatsCardsProps {
  totalSubnets: number;
  totalIps: number;
  usedIps: number;
}

export function SubnetStatsCards({
  totalSubnets,
  totalIps,
  usedIps,
}: SubnetStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-text-tertiary text-xs">子网总数</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totalSubnets}</p>
        </div>
        <Layers size={28} className="text-blue-400" />
      </div>
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-text-tertiary text-xs">IP 总量</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totalIps.toLocaleString()}</p>
        </div>
        <Network size={28} className="text-green-400" />
      </div>
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-text-tertiary text-xs">已分配</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{usedIps.toLocaleString()}</p>
        </div>
        <Router size={28} className="text-yellow-400" />
      </div>
    </div>
  );
}
