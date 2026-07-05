import { AlertCircle, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  title: string;
  subtitle: string;
  targetName: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteConfirmModal({
  title,
  subtitle,
  targetName,
  isPending,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 animate-fade-in">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
              <p className="text-text-secondary text-sm mt-0.5">{subtitle}</p>
            </div>
          </div>
          <p className="text-text-secondary text-sm">
            确定要删除 <span className="text-text-primary font-medium">"{targetName}"</span> 吗？
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
            ) : (
              <Trash2 size={14} />
            )}
            删除
          </button>
        </div>
      </div>
    </div>
  );
}