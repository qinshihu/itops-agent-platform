import { Camera, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import type { Snapshot, SnapshotForm, VM } from './types';

interface SnapshotsDrawerProps {
  vm: VM;
  snapshots: Snapshot[];
  showCreate: boolean;
  form: SnapshotForm;
  creating: boolean;
  restoring: boolean;
  deleting: boolean;
  onClose: () => void;
  onShowCreate: () => void;
  onHideCreate: () => void;
  onFormChange: (updater: (form: SnapshotForm) => SnapshotForm) => void;
  onCreate: () => void;
  onRestore: (snapshotId: string) => void;
  onDelete: (snapshotId: string) => void;
}

export function SnapshotsDrawer({
  vm,
  snapshots,
  showCreate,
  form,
  creating,
  restoring,
  deleting,
  onClose,
  onShowCreate,
  onHideCreate,
  onFormChange,
  onCreate,
  onRestore,
  onDelete,
}: SnapshotsDrawerProps) {
  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-md bg-surface border-l border-border h-full overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-text-primary">快照管理</h3>
              <p className="text-sm text-text-secondary">{vm.name}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-background rounded-lg transition-colors">
              <Trash2 className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          <button
            onClick={onShowCreate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 mb-4 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            <Camera className="w-4 h-4" />
            创建快照
          </button>

          <div className="space-y-3">
            {snapshots.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无双照</p>
              </div>
            ) : (
              snapshots.map(snapshot => (
                <div key={snapshot.id} className="bg-background border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-text-primary font-medium text-sm">{snapshot.name}</p>
                      {snapshot.description && (
                        <p className="text-text-tertiary text-xs mt-0.5">{snapshot.description}</p>
                      )}
                      <p className="text-text-tertiary text-xs mt-1">
                        {snapshot.creationTime ? new Date(snapshot.creationTime).toLocaleString() : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (confirm('确定恢复到此快照？当前状态将丢失。')) onRestore(snapshot.id);
                        }}
                        disabled={restoring}
                        className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-400 transition-colors disabled:opacity-50"
                        title="恢复快照"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('确定删除此快照？')) onDelete(snapshot.id);
                        }}
                        disabled={deleting}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50"
                        title="删除快照"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" onClick={onHideCreate}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-4" onClick={event => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">创建快照</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={event => onFormChange(current => ({ ...current, name: event.target.value }))}
                  placeholder="快照名称"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={event => onFormChange(current => ({ ...current, description: event.target.value }))}
                  rows={2}
                  placeholder="快照描述..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.memory}
                  onChange={event => onFormChange(current => ({ ...current, memory: event.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm text-text-secondary">包含内存状态</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={onHideCreate}
                className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={onCreate}
                disabled={!form.name || creating}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    创建快照
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
