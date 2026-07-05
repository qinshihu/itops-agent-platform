import { X, Upload, Wifi, Activity, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface ImportClusterModalProps {
  kubeconfigContent: string;
  setKubeconfigContent: (val: string) => void;
  testResult: { success: boolean; message: string } | null;
  testingConfig: boolean;
  isImporting: boolean;
  onTest: () => void;
  onImport: () => void;
  onClose: () => void;
}

export default function ImportClusterModal({
  kubeconfigContent,
  setKubeconfigContent,
  testResult,
  testingConfig,
  isImporting,
  onTest,
  onImport,
  onClose,
}: ImportClusterModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary">导入集群</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Kubeconfig 内容</label>
            <textarea
              value={kubeconfigContent}
              onChange={(e) => { setKubeconfigContent(e.target.value); /* testResult cleared by parent */ }}
              placeholder="粘贴 kubeconfig YAML 内容到此处..."
              rows={12}
              className="w-full bg-[#0d1117] border border-border text-green-300 font-mono text-sm rounded-xl p-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none scrollbar-thin"
            />
          </div>

          {testResult && (
            <div className={clsx(
              'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
              testResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20',
            )}>
              {testResult.success ? (
                <Activity size={16} className="text-green-400" />
              ) : (
                <AlertCircle size={16} className="text-red-400" />
              )}
              {testResult.message}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between p-5 border-t border-border">
          <button
            onClick={onTest}
            disabled={testingConfig || !kubeconfigContent.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors disabled:opacity-50"
          >
            {testingConfig ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border border-text-tertiary border-t-transparent" />
            ) : (
              <Wifi size={14} />
            )}
            测试连接
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={onImport}
              disabled={isImporting || !kubeconfigContent.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <Upload size={14} />
              )}
              确认导入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}