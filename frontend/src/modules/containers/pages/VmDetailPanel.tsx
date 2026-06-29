import { useState } from 'react';
import {
  Cpu, HardDrive, Camera, RotateCcw, Trash2, RefreshCw,
  Play, Square, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import type { VM } from './VirtualMachines';

interface Snapshot {
  id: string;
  name: string;
  description?: string;
  creationTime: string;
}

interface VMStats {
  cpuUsage?: number;
  memoryUsage?: number;
}

const powerLabels: Record<string, string> = {
  poweredOn: '运行中',
  poweredOff: '已关机',
  suspended: '已挂起',
};

const formatMem = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
};

interface VmDetailPanelProps {
  open: boolean;
  onClose: () => void;
  vm: VM | null;
}

export default function VmDetailPanel({ open, onClose, vm }: VmDetailPanelProps) {
  const toast = useToast();
  const [showSnapshotCreate, setShowSnapshotCreate] = useState(false);
  const [snapshotForm, setSnapshotForm] = useState({ name: '', description: '', memory: true });

  const { data: vmStatsData } = useQuery<VMStats>({
    queryKey: ['vm-perf-stats', vm?.id],
    queryFn: async () => {
      if (!vm) return {};
      const res = await api.get(`/api/virtual-machines/${vm.id}/stats`);
      return res.data.data;
    },
    enabled: !!vm && open,
    refetchInterval: 5000,
  });

  const { data: snapshots, refetch: refetchSnapshots } = useQuery<Snapshot[]>({
    queryKey: ['vm-snapshots', vm?.id],
    queryFn: async () => {
      if (!vm) return [];
      const res = await api.get(`/api/virtual-machines/${vm.id}/snapshots`);
      return res.data.data;
    },
    enabled: !!vm && open,
  });

  const createSnapshot = async () => {
    if (!vm) return;
    try {
      await api.post(`/api/virtual-machines/${vm.id}/snapshots`, snapshotForm);
      refetchSnapshots();
      setShowSnapshotCreate(false);
      setSnapshotForm({ name: '', description: '', memory: true });
      toast.success('快照已创建');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '创建快照失败');
    }
  };

  const restoreSnapshot = async (snapshotId: string) => {
    if (!vm) return;
    try {
      await api.post(`/api/virtual-machines/${vm.id}/snapshots/${snapshotId}/restore`);
      refetchSnapshots();
      toast.success('快照已恢复');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '恢复快照失败');
    }
  };

  const deleteSnapshot = async (snapshotId: string) => {
    if (!vm) return;
    try {
      await api.delete(`/api/virtual-machines/${vm.id}/snapshots/${snapshotId}`);
      refetchSnapshots();
      toast.success('快照已删除');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除快照失败');
    }
  };

  if (!open || !vm) return null;

  return (
    <>
      {/* Stats + Snapshots Drawer */}
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-md bg-surface border-l border-border h-full overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-text-primary">虚拟机详情</h3>
              <p className="text-sm text-text-secondary">{vm.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-background rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Performance Stats */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-text-primary mb-3">性能监控</h4>
            <div className="space-y-4">
              <div className="bg-background border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Cpu className="w-4 h-4" />
                    CPU 使用率
                  </div>
                  <span className="text-lg font-bold text-text-primary">
                    {vmStatsData?.cpuUsage != null ? `${vmStatsData.cpuUsage.toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(vmStatsData?.cpuUsage ?? 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-background border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <HardDrive className="w-4 h-4" />
                    内存使用率
                  </div>
                  <span className="text-lg font-bold text-text-primary">
                    {vmStatsData?.memoryUsage != null ? `${vmStatsData.memoryUsage.toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-500',
                      (vmStatsData?.memoryUsage ?? 0) > 80 ? 'bg-red-500' :
                        (vmStatsData?.memoryUsage ?? 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    )}
                    style={{ width: `${Math.min(vmStatsData?.memoryUsage ?? 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-background border border-border rounded-lg p-4">
                <h4 className="text-sm font-medium text-text-primary mb-3">基本信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">状态</span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      vm.powerState === 'poweredOn' ? 'bg-green-500/20 text-green-400' :
                        vm.powerState === 'poweredOff' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                    )}>
                      {powerLabels[vm.powerState] || vm.powerState}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">操作系统</span>
                    <span className="text-text-primary">{vm.guestOs || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">CPU</span>
                    <span className="text-text-primary">{vm.numCPUs || 0} 核</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">内存</span>
                    <span className="text-text-primary">{formatMem(vm.memoryMB || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">磁盘</span>
                    <span className="text-text-primary">
                      {vm.disks?.length ? `${vm.disks.reduce((s: number, d: { sizeGB?: number }) => s + (d.sizeGB || 0), 0)} GB` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">IP 地址</span>
                    <span className="text-text-primary font-mono text-xs">{vm.ipAddress || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">平台</span>
                    <span className="text-text-primary">{vm.hypervisorType || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Snapshots */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-text-primary">快照管理</h4>
              <span className="text-xs text-text-tertiary">{snapshots?.length ?? 0} 个快照</span>
            </div>

            <button
              onClick={() => setShowSnapshotCreate(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 mb-4 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
            >
              <Camera className="w-4 h-4" />
              创建快照
            </button>

            <div className="space-y-3">
              {(snapshots ?? []).length === 0 ? (
                <div className="text-center py-12 text-text-secondary">
                  <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无快照</p>
                </div>
              ) : (
                (snapshots ?? []).map(snap => (
                  <div key={snap.id} className="bg-background border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-text-primary font-medium text-sm">{snap.name}</p>
                        {snap.description && (
                          <p className="text-text-tertiary text-xs mt-0.5">{snap.description}</p>
                        )}
                        <p className="text-text-tertiary text-xs mt-1">
                          {snap.creationTime ? new Date(snap.creationTime).toLocaleString() : '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (confirm('确定恢复到此快照？当前状态将丢失。')) {
                              restoreSnapshot(snap.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-400 transition-colors"
                          title="恢复快照"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('确定删除此快照？')) {
                              deleteSnapshot(snap.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors"
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
      </div>

      {/* Create Snapshot Sub-Modal */}
      {showSnapshotCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" onClick={() => setShowSnapshotCreate(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">创建快照</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">名称 *</label>
                <input
                  type="text"
                  value={snapshotForm.name}
                  onChange={e => setSnapshotForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="快照名称"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">描述</label>
                <textarea
                  value={snapshotForm.description}
                  onChange={e => setSnapshotForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="快照描述..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snapshotForm.memory}
                  onChange={e => setSnapshotForm(f => ({ ...f, memory: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm text-text-secondary">包含内存状态</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSnapshotCreate(false)}
                className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={createSnapshot}
                disabled={!snapshotForm.name}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                创建快照
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
