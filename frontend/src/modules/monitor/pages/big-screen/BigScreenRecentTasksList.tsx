/**
 * BigScreenDashboard - 最近任务执行列表（2026-07-21 拆分）
 *
 * 从原 BigScreenDashboard.tsx L678-739 抽出
 * 任务执行列表 + 进度条 + 时间显示
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { formatDistanceToNow } from 'date-fns';
import { getStatusColor } from './BigScreenStatCard';
import type { TaskWithProgress } from './types';

export interface BigScreenRecentTasksListProps {
  tasks: TaskWithProgress[];
  onViewAll: () => void;
}

export default function BigScreenRecentTasksList({
  tasks,
  onViewAll,
}: BigScreenRecentTasksListProps) {
  const visibleTasks = tasks?.slice(0, 6) ?? [];
  const totalTasks = tasks?.length || 0;

  return (
    <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          最近任务执行
        </h2>
        <span
          className="text-xs text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full cursor-pointer hover:bg-slate-600/50"
          onClick={onViewAll}
        >
          {totalTasks} 条记录 →
        </span>
      </div>
      <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin">
        {visibleTasks.map((task) => (
          <div
            key={task.id}
            className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-blue-500/30 transition-all cursor-pointer"
            onClick={onViewAll}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${task.status === 'running' ? 'bg-status-running animate-pulse' : task.status === 'completed' ? 'bg-status-success' : task.status === 'failed' ? 'bg-status-failed' : 'bg-status-pending'}`}
                />
                <span className="text-sm text-white truncate max-w-[200px]">
                  {task.name}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(task.status)} bg-slate-700/50`}
              >
                {task.status}
              </span>
            </div>
            {task.status === 'running' && task.totalNodes > 0 && (
              <div className="ml-5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">
                    {task.completedNodes}/{task.totalNodes} 节点完成
                  </span>
                  <span className="text-sky-300 font-mono font-bold">
                    {task.progress}%
                  </span>
                </div>
                <div className="relative h-1.5 bg-slate-700/60 rounded-full overflow-hidden ring-1 ring-inset ring-white/15">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-end mt-1">
              <span className="text-xs text-slate-400">
                {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
