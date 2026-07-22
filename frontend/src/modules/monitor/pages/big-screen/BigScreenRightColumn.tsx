/**
 * BigScreenDashboard - Right Column（2026-07-21 拆分）
 *
 * 从原 BigScreenDashboard.tsx L744-880 抽出右列 3 个 panel：
 * - 实时告警（最多 6 条，支持 skeleton loading）
 * - Agent 调用统计（4 项数字 + agent list）
 * - 任务状态分布（BarChart）
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { formatDistanceToNow } from 'date-fns';
import AnimatedBarChart from '../../components/AnimatedBarChart';
import { getSeverityBadge } from './BigScreenStatCard';
import type { Alert, AgentStat } from './types';

export interface BigScreenRightColumnProps {
  stats: unknown;
  alerts: Alert[] | null | undefined;
  hasCriticalAlerts: boolean;
  agentStats:
    | {
        overall: {
          totalExecutions: number;
          totalSuccess: number;
          overallSuccessRate: number;
          todayExecutions: number;
        };
        agents: AgentStat[];
      }
    | null
    | undefined;
  taskDistData: Array<{ label: string; value: number; color: string }>;
  onNavigate: (path: string) => void;
}

export default function BigScreenRightColumn({
  stats,
  alerts,
  hasCriticalAlerts,
  agentStats,
  taskDistData,
  onNavigate,
}: BigScreenRightColumnProps) {
  const overall = agentStats?.overall;
  const agentList = agentStats?.agents.slice(0, 6) ?? [];
  const visibleAlerts = alerts?.slice(0, 6) ?? [];

  return (
    <div className="col-span-3 flex flex-col gap-4">
      {/* 实时告警 */}
      <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            实时告警
          </h2>
          <span
            className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-600/50"
            onClick={() => onNavigate('/alerts')}
          >
            全部 →
          </span>
        </div>
        <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
          {stats
            ? visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 bg-slate-900/50 rounded-lg border transition-all cursor-pointer ${alert.severity === 'critical' && hasCriticalAlerts ? 'border-red-500/60 animate-pulse bg-red-900/20' : 'border-slate-700/30 hover:border-red-500/30'}`}
                  onClick={() => onNavigate('/alerts')}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm text-white flex-1 truncate">{alert.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ml-2 ${getSeverityBadge(alert.severity)}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span
                      className={`px-2 py-0.5 rounded ${alert.status === 'new' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50'}`}
                    >
                      {alert.status}
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 animate-pulse"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 bg-slate-700 rounded w-3/4" />
                    <div className="h-4 bg-slate-700 rounded w-12" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-3 bg-slate-700 rounded w-16" />
                    <div className="h-3 bg-slate-700 rounded w-20" />
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* Agent 调用统计 */}
      <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Agent调用统计
          </h2>
          <span
            className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-600/50"
            onClick={() => onNavigate('/agents')}
          >
            详情 →
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/25">
            <div className="text-2xl font-bold text-blue-300">{overall?.totalExecutions || 0}</div>
            <div className="text-xs text-blue-300/80">总调用次数</div>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/25">
            <div className="text-2xl font-bold text-green-300">
              {overall?.overallSuccessRate || 0}%
            </div>
            <div className="text-xs text-green-300/80">总体成功率</div>
          </div>
          <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/25">
            <div className="text-2xl font-bold text-purple-300">
              {overall?.todayExecutions || 0}
            </div>
            <div className="text-xs text-purple-300/80">今日调用</div>
          </div>
          <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/25">
            <div className="text-2xl font-bold text-red-300">
              {(overall?.totalExecutions || 0) - (overall?.totalSuccess || 0)}
            </div>
            <div className="text-xs text-red-300/80">失败次数</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 space-y-2">
          {agentList.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-3 p-2 bg-slate-700/30 rounded-lg border border-slate-700/40"
            >
              <span className="text-xl">{agent.avatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{agent.name}</div>
                <div className="text-xs text-slate-400">
                  {agent.total_executions}次调用 · 成功率{agent.successRate ?? 'N/A'}%
                </div>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${agent.enabled !== 0 ? 'bg-status-success' : 'bg-slate-500'}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 任务状态分布 */}
      <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          任务状态分布
        </h2>
        {taskDistData.length > 0 ? (
          <AnimatedBarChart data={taskDistData} height={140} />
        ) : (
          <div className="flex items-center justify-center h-[140px] text-slate-500 text-sm">
            暂无任务数据
          </div>
        )}
      </div>
    </div>
  );
}
