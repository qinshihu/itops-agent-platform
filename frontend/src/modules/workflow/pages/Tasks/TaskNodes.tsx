import { FileText, CheckCircle, XCircle as XIcon } from 'lucide-react';
import clsx from 'clsx';
import MarkdownOutput from '../../../../shared/components/MarkdownOutput';
import type { TaskDisplay, WorkflowDisplay } from '../types';

interface TaskNodesProps {
  task: TaskDisplay;
  workflow: WorkflowDisplay | undefined;
  executingNodeId: string | null;
}

/**
 * 节点结果 tab 内容组件（2026-07-21 拆分）
 * 把 653 行的 Tasks.tsx 中 L419-528 的节点结果 tab 抽离
 */
export function TaskNodes({ task, workflow, executingNodeId }: TaskNodesProps) {
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

  if (orderedNodes.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>暂无节点执行结果</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orderedNodes.map((node, index) => {
        const result = task.node_results?.[node.id as string];
        const isRunning = executingNodeId === node.id;
        const status = (result as Record<string, unknown>)?.status || (isRunning ? 'running' : 'pending');

        return (
          <div
            key={String(node.id)}
            className={clsx(
              'rounded-xl border-2 overflow-hidden transition-all',
              status === 'completed' && 'border-status-success/30 bg-status-success/5',
              status === 'running' && 'border-status-running/30 bg-status-running/5 animate-pulse',
              status === 'failed' && 'border-status-failed/30 bg-status-failed/5',
              status === 'pending' && 'border-border bg-background/50'
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface">
                  <span className="text-xl">{((node as Record<string, unknown>).data as Record<string, unknown>)?.avatar as string || '🤖'}</span>
                </div>
                <div>
                  <h4 className="font-medium text-text-primary flex items-center gap-2">
                    {((node as Record<string, unknown>).data as Record<string, unknown>)?.label as string || '未知节点'}
                    {status === 'completed' && <CheckCircle className="w-4 h-4 text-status-success" />}
                    {status === 'failed' && <XIcon className="w-4 h-4 text-status-failed" />}
                    {status === 'running' && (
                      <div className="w-4 h-4 border-2 border-status-running border-t-transparent rounded-full animate-spin" />
                    )}
                  </h4>
                  <p className="text-sm text-text-secondary">
                    步骤 {index + 1} / {orderedNodes.length}
                  </p>
                </div>
              </div>
              <span
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  status === 'completed' && 'bg-status-success/10 text-status-success',
                  status === 'running' && 'bg-status-running/10 text-status-running',
                  status === 'failed' && 'bg-status-failed/10 text-status-failed',
                  status === 'pending' && 'bg-status-pending/10 text-status-pending'
                )}
              >
                {status === 'completed' && '已完成'}
                {status === 'running' && '执行中'}
                {status === 'failed' && '失败'}
                {status === 'pending' && '等待执行'}
              </span>
            </div>

            {result && (
              <div className="p-4">
                {(result as Record<string, unknown>).output !== null && (
                  <div className="mb-3">
                    <h5 className="text-sm font-medium text-text-secondary mb-2">输出结果</h5>
                    <div className="bg-surface rounded-lg p-3 border border-border">
                      <MarkdownOutput content={(result as Record<string, unknown>).output as string} />
                    </div>
                  </div>
                )}
                {(result as Record<string, unknown>).error !== null && (
                  <div>
                    <h5 className="text-sm font-medium text-status-failed mb-2">错误信息</h5>
                    <div className="bg-status-failed/5 rounded-lg p-3 border border-status-failed/20">
                      <p className="text-sm text-status-failed">{(result as Record<string, unknown>).error as string}</p>
                    </div>
                  </div>
                )}
                {(result as Record<string, unknown>).metadata !== null && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-text-secondary">
                      执行时间: {new Date(((result as Record<string, unknown>).metadata as Record<string, unknown>).executionTime as string).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}