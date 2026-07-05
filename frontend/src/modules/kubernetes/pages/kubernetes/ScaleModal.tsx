import { X, Minus, Plus } from 'lucide-react';
import type { Deployment } from './types';

interface ScaleModalProps {
  scaleTarget: Deployment;
  scaleReplicas: number;
  setScaleReplicas: (val: number) => void;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ScaleModal({
  scaleTarget,
  scaleReplicas,
  setScaleReplicas,
  isPending,
  onConfirm,
  onClose,
}: ScaleModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary">扩缩容</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Deployment</span>
            <span className="text-text-primary font-medium">{scaleTarget.namespace}/{scaleTarget.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">当前副本数</span>
            <span className="text-text-primary font-medium">{scaleTarget.replicas}</span>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">目标副本数</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScaleReplicas(Math.max(1, scaleReplicas - 1))}
                className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={1}
                max={100}
                value={scaleReplicas}
                onChange={(e) => setScaleReplicas(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="w-20 text-center bg-surface border border-border text-text-primary text-sm rounded-lg py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
              <button
                onClick={() => setScaleReplicas(Math.min(100, scaleReplicas + 1))}
                className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
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
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
            ) : null}
            确认
          </button>
        </div>
      </div>
    </div>
  );
}