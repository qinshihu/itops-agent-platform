import { Plus, RefreshCw, Server, Trash2, Wifi } from 'lucide-react';
import type { Platform, PlatformForm } from './types';
import { platformStatusIcon } from './vmDisplay';

interface PlatformManagementModalProps {
  platforms: Platform[];
  isLoading: boolean;
  form: PlatformForm;
  creating: boolean;
  testing: boolean;
  onFormChange: (updater: (form: PlatformForm) => PlatformForm) => void;
  onClose: () => void;
  onSubmit: () => void;
  onTestConnection: (platformId: string) => void;
  onDelete: (platformId: string) => void;
}

export function PlatformManagementModal({
  platforms,
  isLoading,
  form,
  creating,
  testing,
  onFormChange,
  onClose,
  onSubmit,
  onTestConnection,
  onDelete,
}: PlatformManagementModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <h3 className="text-lg font-bold text-text-primary mb-4">管理虚拟化平台</h3>

        <div className="mb-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-12 bg-background rounded animate-pulse" />
              ))}
            </div>
          ) : platforms.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">
              <Server className="w-10 h-10 mx-auto mb-2 opacity-30" />
              暂无平台，请添加
            </div>
          ) : (
            <div className="space-y-2">
              {platforms.map(platform => (
                <div key={platform.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-medium">{platform.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{platform.hypervisorType}</span>
                      {platformStatusIcon(platform.status)}
                    </div>
                    <div className="text-xs text-text-tertiary mt-0.5">{platform.host}:{platform.port}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onTestConnection(platform.id)}
                      disabled={testing}
                      className="p-2 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
                      title="测试连接"
                    >
                      <Wifi className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`确定要删除平台 "${platform.name}" 吗？`)) {
                          onDelete(platform.id);
                        }
                      }}
                      className="p-2 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium text-text-primary mb-3">添加新平台</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs text-text-secondary mb-1">名称</label>
              <input
                type="text"
                value={form.name}
                onChange={event => onFormChange(current => ({ ...current, name: event.target.value }))}
                placeholder="例如: Proxmox-Prod"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">类型</label>
              <select
                value={form.hypervisorType}
                onChange={event => onFormChange(current => ({ ...current, hypervisorType: event.target.value as Platform['hypervisorType'] }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="proxmox">Proxmox</option>
                <option value="vmware">VMware ESXi / vSphere</option>
                <option value="kvm">KVM</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">主机</label>
              <input
                type="text"
                value={form.host}
                onChange={event => onFormChange(current => ({ ...current, host: event.target.value }))}
                placeholder="192.168.1.100"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">端口</label>
              <input
                type="number"
                value={form.port}
                onChange={event => onFormChange(current => ({ ...current, port: parseInt(event.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">用户名</label>
              <input
                type="text"
                value={form.username}
                onChange={event => onFormChange(current => ({ ...current, username: event.target.value }))}
                placeholder="root"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">密码</label>
              <input
                type="password"
                value={form.password}
                onChange={event => onFormChange(current => ({ ...current, password: event.target.value }))}
                placeholder="********"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
            >
              关闭
            </button>
            <button
              onClick={onSubmit}
              disabled={!form.name || !form.host || creating}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  添加中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  添加平台
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
