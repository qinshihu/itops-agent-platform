import { Activity } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import MarkdownOutput from '../../../../shared/components/MarkdownOutput';
import type { TaskLogEntry } from '../types';

interface TaskLogsProps {
  logs: TaskLogEntry[];
}

/**
 * 日志 tab 内容组件（2026-07-21 拆分）
 * 把 653 行的 Tasks.tsx 中 L377-416 的日志 tab 抽离
 */
export function TaskLogs({ logs }: TaskLogsProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>暂无执行日志</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log, index) => (
        <div
          key={index}
          className={clsx(
            'p-3 rounded-lg text-sm',
            log.type === 'thinking' && 'bg-blue-500/5 border-l-4 border-blue-500',
            log.type === 'output' && 'bg-green-500/5 border-l-4 border-green-500',
            log.type === 'success' && 'bg-green-500/10 border-l-4 border-green-500',
            log.type === 'error' && 'bg-red-500/10 border-l-4 border-red-500',
            log.type === 'info' && 'bg-surface border-l-4 border-primary'
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary">
              {format(new Date(log.timestamp), 'HH:mm:ss')}
            </span>
            {log.type === 'thinking' && <span className="text-xs text-blue-500">分析中</span>}
            {log.type === 'output' && <span className="text-xs text-green-500">输出</span>}
          </div>
          {log.type === 'output' ? (
            <div className="text-text-primary">
              <MarkdownOutput content={log.content} />
            </div>
          ) : (
            <p className="text-text-primary whitespace-pre-wrap">{log.content}</p>
          )}
        </div>
      ))}
    </div>
  );
}