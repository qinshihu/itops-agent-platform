import { X } from 'lucide-react';

export interface CreateTemplateFormState {
  name: string;
  description: string;
  type: 'incident' | 'inspection' | 'change';
  content: string;
  variables: string[];
}

interface CreateTemplateModalProps {
  open: boolean;
  form: CreateTemplateFormState;
  onChange: (next: CreateTemplateFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

export function CreateTemplateModal({ open, form, onChange, onClose, onSubmit, submitting }: CreateTemplateModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">创建报告模板</h2>
            <button onClick={onClose} className="p-2 hover:bg-background rounded-lg text-text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-primary mb-1">模板名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                className="w-full bg-background border border-border rounded-lg p-2 text-text-primary"
                placeholder="输入模板名称"
              />
            </div>
            <div>
              <label className="block text-sm text-text-primary mb-1">描述</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => onChange({ ...form, description: e.target.value })}
                className="w-full bg-background border border-border rounded-lg p-2 text-text-primary"
                placeholder="输入模板描述"
              />
            </div>
            <div>
              <label className="block text-sm text-text-primary mb-1">报告类型</label>
              <select
                value={form.type}
                onChange={(e) => onChange({ ...form, type: e.target.value as 'incident' | 'inspection' | 'change' })}
                className="w-full bg-background border border-border rounded-lg p-2 text-text-primary"
              >
                <option value="incident">故障报告</option>
                <option value="inspection">巡检报告</option>
                <option value="change">变更记录</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-primary mb-1">
                模板内容 (使用 {'{{variable}}'} 定义变量)
              </label>
              <textarea
                value={form.content}
                onChange={(e) => onChange({ ...form, content: e.target.value })}
                className="w-full bg-background border border-border rounded-lg p-2 text-text-primary font-mono text-sm"
                rows={10}
                placeholder="输入模板内容..."
              />
            </div>
            <div>
              <label className="block text-sm text-text-primary mb-1">
                变量列表 (每行一个)
              </label>
              <textarea
                value={form.variables?.join('\n') || ''}
                onChange={(e) => onChange({
                  ...form,
                  variables: e.target.value.split('\n').filter((v) => v.trim()),
                })}
                className="w-full bg-background border border-border rounded-lg p-2 text-text-primary font-mono text-sm"
                rows={4}
                placeholder="variable1&#10;variable2&#10;..."
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-background hover:bg-surface text-text-primary py-2 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2 rounded-lg"
            >
              {submitting ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
