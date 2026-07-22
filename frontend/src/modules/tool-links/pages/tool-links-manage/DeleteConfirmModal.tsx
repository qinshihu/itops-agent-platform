/**
 * 工具链接管理 - 删除确认弹窗
 *
 * 从原 infra/pages/tool-links-manage/DeleteConfirmModal.tsx 抽离（2026-07-08 增量-12）。
 */

import { AlertTriangle, Trash2 } from 'lucide-react';
import type { ToolLink } from './types';
import type { UseMutationResult } from '@tanstack/react-query';

type DeleteMutation = UseMutationResult<unknown, unknown, string, unknown>;

interface DeleteConfirmModalProps {
  tool: ToolLink;
  setDeleteConfirm: (tool: ToolLink | null) => void;
  deleteMutation: DeleteMutation;
}

export function DeleteConfirmModal({
  tool,
  setDeleteConfirm,
  deleteMutation,
}: DeleteConfirmModalProps) {
  return (
    <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-text-primary">确认删除</h3>
      </div>
      <p className="text-sm text-text-secondary mb-2">
        确定要删除工具链接 <strong className="text-text-primary">{tool.name}</strong> 吗？
      </p>
      <p className="text-xs text-text-tertiary mb-6">此操作不可撤销</p>
      <div className="flex gap-3">
        <button
          onClick={() => setDeleteConfirm(null)}
          className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
        >
          取消
        </button>
        <button
          onClick={() => deleteMutation.mutate(tool.id)}
          className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          删除
        </button>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
