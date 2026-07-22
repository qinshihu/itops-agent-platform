/**
 * ToolLinks 删除确认 Modal（2026-07-21 拆分）
 *
 * 从原 ToolLinks.tsx L577-610 抽出
 * 独立 modal：点击删除按钮后弹出的最终确认 dialog
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { Trash2 } from 'lucide-react';
import type { ToolLink } from '../../api';

export interface DeleteToolModalProps {
  tool: ToolLink | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  deletePending: boolean;
}

export function DeleteToolModal({ tool, onClose, onConfirm, deletePending }: DeleteToolModalProps) {
  if (!tool) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border/60 rounded-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">确认删除</h3>
          <p className="text-sm text-text-secondary mb-6">
            确定要删除工具「{tool.name}」吗？此操作不可撤销。
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border/60 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onConfirm(tool.id)}
              disabled={deletePending}
              className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-500/90 transition-colors disabled:opacity-50"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
