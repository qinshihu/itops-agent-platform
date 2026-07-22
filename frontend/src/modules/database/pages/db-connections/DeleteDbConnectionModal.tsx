/**
 * DbConnection 删除确认 modal（2026-07-21 拆分）
 *
 * 从原 DbConnections.tsx L553-583 抽出
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { AlertTriangle } from 'lucide-react';

export interface DeleteDbConnectionModalProps {
  pendingDelete: { id: string; name: string } | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteDbConnectionModal({
  pendingDelete,
  onClose,
  onConfirm,
  isPending,
}: DeleteDbConnectionModalProps) {
  if (!pendingDelete) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface backdrop-blur-xl rounded-2xl w-full max-w-md border border-red-500/20 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">确认删除</h3>
        </div>
        <p className="text-text-primary mb-6">
          确定要删除数据库连接{' '}
          <span className="font-semibold text-text-primary">"{pendingDelete.name}"</span> 吗？此操作不可撤销。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all font-medium"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {isPending ? '删除中...' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}
