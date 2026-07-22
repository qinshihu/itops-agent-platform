/**
 * 子网创建/编辑 Modal widget（2026-07-21 拆分）
 *
 * 从原 Networks.tsx L515-595 抽出
 * 创建/编辑子网表单（name / CIDR / VLAN / 网关 / 类型 / 位置 / 备注）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { X, Check, Plus } from 'lucide-react';
import type { SubnetFormData, SubnetInfo } from './types';
import { TYPE_MAP } from './types';

export interface SubnetCreateModalProps {
  isOpen: boolean;
  editingSubnet: SubnetInfo | null;
  form: SubnetFormData;
  setForm: React.Dispatch<React.SetStateAction<SubnetFormData>>;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function SubnetCreateModal({
  isOpen,
  editingSubnet,
  form,
  setForm,
  isSubmitting,
  onClose,
  onSubmit,
}: SubnetCreateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary">
            {editingSubnet ? '编辑子网' : '新建子网'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：生产环境-核心网段"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                CIDR <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.cidr}
                onChange={(e) => setForm({ ...form, cidr: e.target.value })}
                disabled={!!editingSubnet}
                placeholder="192.168.1.0/24"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">VLAN ID</label>
              <input
                type="number"
                value={form.vlan_id}
                onChange={(e) => setForm({ ...form, vlan_id: e.target.value })}
                placeholder="1-4094"
                min={1}
                max={4094}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">网关</label>
            <input
              type="text"
              value={form.gateway}
              onChange={(e) => setForm({ ...form, gateway: e.target.value })}
              placeholder="192.168.1.1"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">网络类型</label>
              <select
                value={form.network_type}
                onChange={(e) => setForm({ ...form, network_type: e.target.value })}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
              >
                {Object.entries(TYPE_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">位置/机房</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="例如：北京-A机房"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">备注</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="子网用途说明..."
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary resize-none"
            />
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
            onClick={onSubmit}
            disabled={isSubmitting || !form.name.trim() || (!editingSubnet && !form.cidr.trim())}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
          >
            {editingSubnet ? <Check size={14} /> : <Plus size={14} />}
            {editingSubnet ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
