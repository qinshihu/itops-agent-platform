import { AlertTriangle } from 'lucide-react';

interface ServerDeleteConfirmModalProps {
  isOpen: boolean;
  serverName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ServerDeleteConfirmModal({
  isOpen,
  serverName,
  onClose,
  onConfirm,
}: ServerDeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-surface/70 to-background/70 backdrop-blur-xl rounded-xl p-6 w-full max-w-md mx-4 border border-red-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          删除服务器
        </h3>
        <p className="text-text-secondary mb-6">
          确定要删除服务器{' '}
          <span className="text-text-primary font-medium">{serverName}</span>{' '}
          吗？此操作不可撤销。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}