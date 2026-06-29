import { useState, useEffect } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import type { VM } from './VirtualMachines';

interface VmFormData {
  name: string;
  os: string;
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  ip_address: string;
  notes: string;
  tags: string;
}

interface VmCreateWizardProps {
  open: boolean;
  onClose: () => void;
  vm: VM | null;
  onSave: (data: VmFormData) => void;
  isSaving: boolean;
  saveLabel?: string;
}

export default function VmCreateWizard({ open, onClose, vm, onSave, isSaving, saveLabel }: VmCreateWizardProps) {
  const [form, setForm] = useState<VmFormData>({
    name: '',
    os: '',
    cpu_cores: 2,
    memory_mb: 2048,
    disk_gb: 40,
    ip_address: '',
    notes: '',
    tags: '',
  });

  useEffect(() => {
    if (open) {
      if (vm) {
        setForm({
          name: vm.name,
          os: vm.guestOs || '',
          cpu_cores: vm.numCPUs || 2,
          memory_mb: vm.memoryMB || 2048,
          disk_gb: vm.disks?.[0]?.sizeGB || 40,
          ip_address: vm.ipAddress || '',
          notes: '',
          tags: '',
        });
      } else {
        setForm({
          name: '',
          os: '',
          cpu_cores: 2,
          memory_mb: 2048,
          disk_gb: 40,
          ip_address: '',
          notes: '',
          tags: '',
        });
      }
    }
  }, [open, vm]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <form className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className="text-lg font-bold text-text-primary mb-4">
          {vm ? '编辑虚拟机' : '新建虚拟机'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VM 名称"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">操作系统</label>
            <input
              type="text"
              value={form.os}
              onChange={e => setForm(f => ({ ...f, os: e.target.value }))}
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
                onChange={e => setForm(f => ({ ...f, cpu_cores: parseInt(e.target.value) || 1 }))}
                min={1}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">内存 (MB)</label>
              <input
                type="number"
                value={form.memory_mb}
                onChange={e => setForm(f => ({ ...f, memory_mb: parseInt(e.target.value) || 128 }))}
                min={128}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">磁盘 (GB)</label>
              <input
                type="number"
                value={form.disk_gb}
                onChange={e => setForm(f => ({ ...f, disk_gb: parseInt(e.target.value) || 10 }))}
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
              onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
              placeholder="192.168.1.50"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">标签 (逗号分隔)</label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="prod, web, db"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="备注信息..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!form.name || isSaving}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                {vm ? null : <Plus className="w-4 h-4" />}
                {saveLabel || (vm ? '保存更改' : '创建虚拟机')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
