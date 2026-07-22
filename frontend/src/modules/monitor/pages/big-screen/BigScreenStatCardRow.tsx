/**
 * BigScreenDashboard - 顶部 StatCard 4 列（2026-07-21 拆分）
 *
 * 从原 BigScreenDashboard.tsx L564-597 抽出
 * 4 个 StatCard + 4 个 SLA mini-card：服务器 / Agent / 任务 / 告警
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { Server, Bot, Play, Bell, Clock, TrendingUp, Target, CheckCircle } from 'lucide-react';
import { StatCard } from './BigScreenStatCard';
import type { DashboardStats, SlaStats } from './types';

export interface BigScreenStatCardRowProps {
  stats: DashboardStats | null | undefined;
  slaStats: SlaStats | null | undefined;
  onNavigate: (path: string) => void;
}

export default function BigScreenStatCardRow({
  stats,
  slaStats,
  onNavigate,
}: BigScreenStatCardRowProps) {
  return (
    <>
      {/* 4 个 StatCard */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Server}
          label="服务器"
          value={`${stats?.servers.enabled || 0}/${stats?.servers.total || 0}`}
          subValue="已启用 / 总计"
          color={{ bg: 'bg-purple-500/15', fg: 'text-purple-400' }}
          onClick={() => onNavigate('/servers')}
        />
        <StatCard
          icon={Bot}
          label="Agent"
          value={`${stats?.agents.enabled || 0}/${stats?.agents.total || 0}`}
          subValue="在线 / 总计"
          color={{ bg: 'bg-blue-500/15', fg: 'text-blue-400' }}
          onClick={() => onNavigate('/agents')}
        />
        <StatCard
          icon={Play}
          label="任务成功率"
          value={`${stats?.tasks.successRate || 0}%`}
          subValue={`成功 ${stats?.tasks.completed || 0} / 总计 ${stats?.tasks.total || 0}`}
          color={{ bg: 'bg-green-500/15', fg: 'text-green-400' }}
          onClick={() => onNavigate('/tasks')}
        />
        <StatCard
          icon={Bell}
          label="活跃告警"
          value={stats?.alerts.active || 0}
          subValue={`严重 ${stats?.alerts.critical || 0} / 高 ${stats?.alerts.high || 0}`}
          color={{ bg: 'bg-red-500/15', fg: 'text-red-400' }}
          onClick={() => onNavigate('/alerts')}
        />
      </div>

      {/* 4 个 SLA mini-card */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-text-secondary">MTTR (平均修复时间)</span>
          </div>
          <div className="text-xl font-bold text-text-primary">
            {slaStats?.mttr_minutes ? `${slaStats.mttr_minutes} min` : '--'}
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-text-secondary">系统可用性</span>
          </div>
          <div className="text-xl font-bold text-text-primary">
            {slaStats?.uptime_percentage ? `${slaStats.uptime_percentage}%` : '--'}
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-text-secondary">告警响应时间</span>
          </div>
          <div className="text-xl font-bold text-text-primary">
            {slaStats?.avg_response_seconds ? `${slaStats.avg_response_seconds} s` : '--'}
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-text-secondary">今日告警解决率</span>
          </div>
          <div className="text-xl font-bold text-text-primary">
            {slaStats?.alert_resolution_rate ? `${slaStats.alert_resolution_rate}%` : '--'}
          </div>
        </div>
      </div>
    </>
  );
}
