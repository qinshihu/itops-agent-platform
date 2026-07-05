import type { VM, VMForm } from './types';

interface VMFormModalProps {
  editingVM: VM | null;
  form: VMForm;
  saving: boolean;
  onFormChange: (updater: (form: VMForm) => VMForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function VMFormModal({ editingVM, form, saving, onFormChange, onClose, onSubmit }: VMFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <h3 className="text-lg font-bold text-text-primary mb-4">
          {editingVM ? '编辑虚拟机' : '新建虚拟机'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={event => onFormChange(current => ({ ...current, name: event.target.value }))}
              placeholder="VM 名称"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">操作系统</label>
            <input
              type="text"
              value={form.os}
              onChange={event => onFormChange(current => ({ ...current, os: event.target.value }))}
              placeholder="例如: Ubuntu 22.04"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">CPU 核数</label>
              <input
                type="number"
                value={form.cpu_cores}
                onChange={event => onFormChange(current => ({ ...current, cpu_cores: parseInt(event.target.value) || 1 }))}
                min={1}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">内存 (MB)</label>
              <input
                type="number"
                value={form.memory_mb}
                onChange={event => onFormChange(current => ({ ...current, memory_mb: parseInt(event.target.value) || 128 }))}
                min={128}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">磁盘 (GB)</label>
              <input
                type="number"
                value={form.disk_gb}
                onChange={event => onFormChange(current => ({ ...current, disk_gb: parseInt(event.target.value) || 10 }))}
                min={10}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">IP 地址</label>
            <input
              type="text"
              value={form.ip_address}
              onChange={event => onFormChange(current => ({ ...current, ip_address: event.target.value }))}
              placeholder="192.168.1.50"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">标签 (逗号分隔)</label>
            <input
              type="text"
              value={form.tags}
              onChange={event => onFormChange(current => ({ ...current, tags: event.target.value }))}
              placeholder="prod, web, db"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={event => onFormChange(current => ({ ...current, notes: event.target.value }))}
              rows={2}
              placeholder="备注信息..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary resize-none"
            />
          </div>
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
            disabled={!form.name || saving}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {editingVM ? '保存更改' : '创建虚拟机'}
          </button>
        </div>
      </div>
    </div>
  );
}
