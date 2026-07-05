import { Copy, RefreshCw } from 'lucide-react';
import type { VM } from './types';

interface CloneVMModalProps {
  target: VM;
  cloneName: string;
  clonePowerOn: boolean;
  cloning: boolean;
  onCloneNameChange: (name: string) => void;
  onClonePowerOnChange: (powerOn: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function CloneVMModal({
  target,
  cloneName,
  clonePowerOn,
  cloning,
  onCloneNameChange,
  onClonePowerOnChange,
  onClose,
  onSubmit,
}: CloneVMModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-4" onClick={event => event.stopPropagation()}>
        <h3 className="text-lg font-bold text-text-primary mb-4">克隆虚拟机: {target.name}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">新虚拟机名称 *</label>
            <input
              type="text"
              value={cloneName}
              onChange={event => onCloneNameChange(event.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={clonePowerOn}
              onChange={event => onClonePowerOnChange(event.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-text-secondary">克隆后立即开机</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={!cloneName.trim() || cloning}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cloning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                克隆中...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                克隆
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
