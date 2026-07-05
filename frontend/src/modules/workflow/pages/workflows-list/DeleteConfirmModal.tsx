import { XCircle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({
  isPending,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-500/10 rounded-full">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-text-primary">确认删除</h3>
        </div>
        <p className="text-text-secondary mb-6">
          确定要删除这个工作流吗？此操作不可撤销。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isPending ? '删除中...' : '删除'}
          </button>
        </div>
      </div>
    </div>
  );
}