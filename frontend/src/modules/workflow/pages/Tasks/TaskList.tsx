import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { TaskDisplay } from '../types';

interface TaskListProps {
  tasks: TaskDisplay[] | undefined;
  selectedTaskId: string | undefined;
  onSelectTask: (task: TaskDisplay) => void;
}

/**
 * 左侧任务列表 sidebar（2026-07-21 拆分）
 * 把 653 行的 Tasks.tsx 中 L196-238 的任务列表渲染抽离
 */
export function TaskList({ tasks, selectedTaskId, onSelectTask }: TaskListProps) {
  return (
    <div className="w-1/3 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-2">任务执行</h1>
        <p className="text-text-secondary">查看和管理任务执行进度</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
        {tasks?.map(task => (
          <div
            key={task.id}
            onClick={() => onSelectTask(task)}
            className={clsx(
              'p-4 rounded-lg border cursor-pointer transition-all',
              selectedTaskId === task.id
                ? 'bg-primary/10 border-primary'
                : 'bg-surface border-border hover:border-primary/50'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-text-primary">{task.name}</h3>
              <span
                className={clsx(
                  'px-2 py-1 rounded text-xs font-medium',
                  task.status === 'completed' && 'bg-status-success/10 text-status-success',
                  task.status === 'running' && 'bg-status-running/10 text-status-running',
                  task.status === 'failed' && 'bg-status-failed/10 text-status-failed',
                  task.status === 'paused' && 'bg-status-paused/10 text-status-paused',
                  task.status === 'pending' && 'bg-status-pending/10 text-status-pending',
                  task.status === 'cancelled' && 'bg-status-pending/10 text-status-pending'
                )}
              >
                {task.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}