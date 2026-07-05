import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

interface DeleteVMConfirmProps {
  vmName: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteVMConfirm({ vmName, deleting, onCancel, onConfirm }: DeleteVMConfirmProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-4 border border-red-500/20" onClick={event => event.stopPropagation()}>
        <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          删除虚拟机
        </h3>
        <p className="text-text-secondary mb-6">
          确定要删除虚拟机 <span className="text-text-primary font-medium">{vmName}</span> 吗？此操作将同时从虚拟化平台和本地数据库中移除。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                删除中...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                确认删除
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
