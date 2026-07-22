import { useState } from 'react';
import { Play, Pause, XCircle, RefreshCw, List, FileText, FileCheck } from 'lucide-react';
import clsx from 'clsx';
import type {
  TaskDisplay,
  WorkflowDisplay,
  Report,
  TaskLogEntry,
} from '../types';
import { TaskLogs } from './TaskLogs';
import { TaskNodes } from './TaskNodes';
import { TaskReports } from './TaskReports';

interface TaskDetailProps {
  task: TaskDisplay;
  taskLogs: TaskLogEntry[];
  workflow: WorkflowDisplay | undefined;
  executingNodeId: string | null;
  reports: Report[] | undefined;
  pauseMutation: { isPending: boolean; mutate: (id: string) => void };
  resumeMutation: { isPending: boolean; mutate: (id: string) => void };
  cancelMutation: { isPending: boolean; mutate: (id: string) => void };
  retryMutation: { isPending: boolean; mutate: (id: string) => void };
  onShowReport: (report: Report) => void;
  onDownloadReport: (reportId: string, format?: 'markdown') => Promise<void>;
  onRetryClick: (task: TaskDisplay) => void;
}

type TabKey = 'logs' | 'nodes' | 'related_reports';

const TABS: ReadonlyArray<readonly [TabKey, React.ComponentType<{ className?: string }>, string]> = [
  ['logs', List, '执行日志'],
  ['nodes', FileText, '节点结果'],
  ['related_reports', FileCheck, '相关报告'],
];

/**
 * 右侧详情面板（2026-07-21 拆分）
 * 把 653 行的 Tasks.tsx 中 L240-600 的详情渲染抽离（不含 modal）
 */
export function TaskDetail({
  task,
  taskLogs,
  workflow,
  executingNodeId,
  reports,
  pauseMutation,
  resumeMutation,
  cancelMutation,
  retryMutation,
  onShowReport,
  onDownloadReport,
  onRetryClick,
}: TaskDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('logs');

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{task.name}</h2>
            <p className="text-sm text-text-secondary">
              工作流: {workflow?.name || '未知'}
            </p>
          </div>
          <div className="flex gap-2">
            {task.status === 'running' && (
              <button
                onClick={() => pauseMutation.mutate(task.id)}
                className="p-2 bg-status-warning/10 text-status-warning rounded-lg hover:bg-status-warning/20"
                title="暂停任务"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {task.status === 'paused' && (
              <button
                onClick={() => resumeMutation.mutate(task.id)}
                className="p-2 bg-status-success/10 text-status-success rounded-lg hover:bg-status-success/20"
                title="恢复任务"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            {(task.status === 'running' || task.status === 'paused') && (
              <button
                onClick={() => cancelMutation.mutate(task.id)}
                className="p-2 bg-status-failed/10 text-status-failed rounded-lg hover:bg-status-failed/20"
                title="取消任务"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            {(task.status === 'failed' || task.status === 'cancelled') && (
              <button
                onClick={() => onRetryClick(task)}
                disabled={retryMutation.isPending}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-primary/10 text-primary hover:bg-primary/20',
                  retryMutation.isPending && 'opacity-50 cursor-not-allowed'
                )}
                title="失败重投：将基于原任务创建新任务重新执行"
              >
                <RefreshCw className={clsx('w-4 h-4', retryMutation.isPending && 'animate-spin')} />
                失败重投
              </button>
            )}
          </div>
        </div>

        {/* Node Flow */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(() => {
            const nodes = workflow?.nodes || [];
            const nodeMap = new Map(nodes.map(node => [String(node.id), node]));
            const executionOrder = task.execution_order;

            let orderedNodes;
            if (executionOrder && executionOrder.length > 0) {
              orderedNodes = executionOrder
                .map(id => nodeMap.get(id))
                .filter(node => node !== undefined);
            } else {
              orderedNodes = nodes;
            }

            return orderedNodes.map((node, index) => {
              const result = task.node_results?.[node.id as string];
              const isRunning = executingNodeId === node.id;
              const status = (result as Record<string, unknown>)?.status || (isRunning ? 'running' : 'pending');

              return (
                <div key={String(node.id)} className="flex items-center gap-2">
                  <div
                    className={clsx(
                      'px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2',
                      status === 'completed' && 'border-status-success bg-status-success/10',
                      status === 'running' && 'border-status-running bg-status-running/10 animate-pulse',
                      status === 'failed' && 'border-status-failed bg-status-failed/10',
                      status === 'pending' && 'border-status-pending'
                    )}
                  >
                    <span className="text-lg">{((node as Record<string, unknown>).data as Record<string, unknown>)?.avatar as string || '🤖'}</span>
                    <span className="text-sm font-medium text-text-primary whitespace-nowrap">
                      {((node as Record<string, unknown>).data as Record<string, unknown>)?.label as string}
                    </span>
                    {status === 'completed' && <span className="w-4 h-4 text-status-success">✓</span>}
                    {status === 'failed' && <span className="w-4 h-4 text-status-failed">✗</span>}
                    {status === 'running' && (
                      <div className="w-4 h-4 border-2 border-status-running border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {index < orderedNodes.length - 1 && <span className="text-text-secondary">→</span>}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex border-b border-border px-6 pt-4">
          {TABS.map(([tab, Icon, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 transition-all',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'logs' && <TaskLogs logs={taskLogs} />}
          {activeTab === 'nodes' && (
            <TaskNodes task={task} workflow={workflow} executingNodeId={executingNodeId} />
          )}
          {activeTab === 'related_reports' && (
            <TaskReports
              task={task}
              reports={reports}
              onShowReport={onShowReport}
              onDownloadReport={onDownloadReport}
            />
          )}
        </div>
      </div>
    </>
  );
}