/**
 * SSHKey 删除确认 Modal（2026-07-21 拆分）
 *
 * 从原 SSHKeys.tsx L568-609 抽出
 * 删除 dialog（带 usage_count > 0 警告）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import clsx from 'clsx';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { SshKey } from './types';

export interface DeleteSSHKeyModalProps {
  keyData: SshKey | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteSSHKeyModal({ keyData, onClose, onConfirm }: DeleteSSHKeyModalProps) {
  if (!keyData) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">确认删除</h3>
        </div>
        <div className="text-sm text-text-secondary mb-4">
          <p>
            确定要删除密钥 <strong className="text-text-primary">{keyData.name}</strong> 吗？
          </p>
          {(keyData.usage_count ?? 0) > 0 && (
            <p className="mt-2 text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              该密钥正被 <strong>{keyData.usage_count ?? 0}</strong> 台服务器使用，无法删除
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={(keyData.usage_count ?? 0) > 0}
            className={clsx(
              'flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2',
              (keyData.usage_count ?? 0) > 0
                ? 'bg-red-500/20 text-red-400/50 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600',
            )}
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
