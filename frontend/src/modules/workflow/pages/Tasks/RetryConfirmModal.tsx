import { Modal } from 'antd';
import { RefreshCw } from 'lucide-react';
import type { TaskDisplay, WorkflowDisplay } from '../types';

interface RetryConfirmModalProps {
  task: TaskDisplay | null;
  workflow: WorkflowDisplay | undefined;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 失败重投确认 Modal（2026-07-21 拆分）
 * 把 653 行的 Tasks.tsx 中 L613-649 的 Modal 抽离
 */
export function RetryConfirmModal({
  task,
  workflow,
  isPending,
  onCancel,
  onConfirm,
}: RetryConfirmModalProps) {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          <span>确认失败重投</span>
        </div>
      }
      open={!!task}
      onCancel={() => !isPending && onCancel()}
      confirmLoading={isPending}
      onOk={onConfirm}
      okText="立即重投"
      cancelText="取消"
    >
      <div className="py-2 space-y-3">
        <p>
          将基于任务 <span className="font-mono font-semibold text-text-primary">{task?.name}</span> 创建新任务并立即重新执行。
        </p>
        <div className="bg-surface border border-border rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-text-secondary">工作流:</span>
            <span className="font-medium">{workflow?.name || '未知'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">原任务状态:</span>
            <span className="font-medium text-status-failed">{task?.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">原任务 ID:</span>
            <span className="font-mono text-xs">{task?.id.slice(0, 8)}...</span>
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          ℹ️ 重投将继承原任务的 context，但作为新任务独立执行，不会修改原任务状态。
        </p>
      </div>
    </Modal>
  );
}