/**
 * ToolLinks 工具表单 Modal（2026-07-21 拆分）
 *
 * 从原 ToolLinks.tsx L446-575 抽出
 * 新增/编辑工具表单（name / url / category / icon picker / description / is_external）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { X } from 'lucide-react';
import { ToolIcon } from './ToolIcon';
import { ICON_OPTIONS } from './constants';
import type { ToolLinkFormData } from './types';

export interface ToolFormModalProps {
  isOpen: boolean;
  selectedToolId: string | null;
  formData: ToolLinkFormData;
  setFormData: React.Dispatch<React.SetStateAction<ToolLinkFormData>>;
  showIconPicker: boolean;
  setShowIconPicker: (b: boolean) => void;
  createPending: boolean;
  updatePending: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ToolFormModal({
  isOpen,
  selectedToolId,
  formData,
  setFormData,
  showIconPicker,
  setShowIconPicker,
  createPending,
  updatePending,
  onClose,
  onSubmit,
}: ToolFormModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            {selectedToolId ? '编辑工具' : '添加工具'}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">工具名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入工具名称"
              className="w-full px-3 py-2 bg-bg-muted border border-border/60 rounded-lg text-text-primary focus:outline-none focus:border-primary text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">链接地址</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com"
              className="w-full px-3 py-2 bg-bg-muted border border-border/60 rounded-lg text-text-primary focus:outline-none focus:border-primary text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">分类</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="未分类"
              className="w-full px-3 py-2 bg-bg-muted border border-border/60 rounded-lg text-text-primary focus:outline-none focus:border-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">图标</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full px-3 py-2 bg-bg-muted border border-border/60 rounded-lg text-text-primary flex items-center justify-between text-sm hover:border-primary/40 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ToolIcon iconName={formData.icon} className="w-4 h-4" />
                  {formData.icon}
                </span>
                <span className="text-text-tertiary text-xs">点击选择</span>
              </button>
              {showIconPicker && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border/60 rounded-xl p-3 z-10 grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                  {ICON_OPTIONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, icon: name });
                        setShowIconPicker(false);
                      }}
                      className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all ${
                        formData.icon === name
                          ? 'bg-primary/15 text-primary'
                          : 'bg-bg-muted text-text-tertiary hover:text-text-primary hover:bg-border/40'
                      }`}
                    >
                      <ToolIcon iconName={name} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="工具描述（可选）"
              rows={2}
              className="w-full px-3 py-2 bg-bg-muted border border-border/60 rounded-lg text-text-primary focus:outline-none focus:border-primary text-sm resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-external"
              checked={formData.is_external}
              onChange={(e) => setFormData({ ...formData, is_external: e.target.checked })}
              className="w-4 h-4 rounded border-border/60 text-primary focus:ring-primary bg-bg-muted"
            />
            <label htmlFor="is-external" className="text-sm text-text-secondary cursor-pointer">
              外部链接（新窗口打开）
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createPending || updatePending}
              className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {selectedToolId ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
