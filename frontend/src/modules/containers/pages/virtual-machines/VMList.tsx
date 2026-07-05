import { AlertCircle, Camera, Copy, Cpu, HardDrive, Monitor, Play, RotateCcw, Server, Settings, Square, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { VM } from './types';
import { formatMem, powerColors, powerLabels } from './vmDisplay';

interface VMListProps {
  vms: VM[];
  isLoading: boolean;
  totalVMs: number;
  page: number;
  pageSize: number;
  selectedPlatformId: string;
  actionPending: boolean;
  onAction: (id: string, action: string) => void;
  onOpenSnapshots: (vm: VM) => void;
  onOpenClone: (vm: VM) => void;
  onOpenStats: (vm: VM) => void;
  onEdit: (vm: VM) => void;
  onDelete: (vm: VM) => void;
  onPageChange: (updater: (page: number) => number) => void;
}

export function VMList({
  vms,
  isLoading,
  totalVMs,
  page,
  pageSize,
  selectedPlatformId,
  actionPending,
  onAction,
  onOpenSnapshots,
  onOpenClone,
  onOpenStats,
  onEdit,
  onDelete,
  onPageChange,
}: VMListProps) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {isLoading ? (
        <div className="p-8 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 bg-background rounded animate-pulse" />
          ))}
        </div>
      ) : vms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Server className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">暂无虚拟机</p>
          <p className="text-sm mt-1">
            {selectedPlatformId ? '该平台下暂无虚拟机，请点击同步按钮从平台拉取' : '请选择平台或点击同步按钮获取虚拟机列表'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-left">
                  <th className="px-4 py-3 font-medium">名称</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">平台</th>
                  <th className="px-4 py-3 font-medium">操作系统</th>
                  <th className="px-4 py-3 font-medium">CPU</th>
                  <th className="px-4 py-3 font-medium">内存</th>
                  <th className="px-4 py-3 font-medium">磁盘</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {vms.map(vm => (
                  <tr key={vm.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                        <span className="text-text-primary font-medium truncate max-w-[160px]">{vm.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', powerColors[vm.powerState] || 'bg-text-tertiary/20 text-text-tertiary')}>
                        {vm.powerState === 'poweredOn' ? <Play className="w-3 h-3" /> : vm.powerState === 'poweredOff' ? <Square className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {powerLabels[vm.powerState] || vm.powerState}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{vm.hypervisorType || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary truncate max-w-[120px]">{vm.guestOs || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <Cpu className="w-3.5 h-3.5" />
                        {vm.numCPUs || 0} 核
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <HardDrive className="w-3.5 h-3.5" />
                        {formatMem(vm.memoryMB || 0)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {vm.disks && vm.disks.length > 0
                        ? `${vm.disks.reduce((sum, disk) => sum + (disk.sizeGB || 0), 0)} GB`
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                      {vm.ipAddress || (vm.networkInterfaces?.[0]?.ipAddress) || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => onAction(vm.id, 'start')}
                          disabled={actionPending}
                          className="p-1.5 rounded hover:bg-green-500/10 text-green-400 transition-colors disabled:opacity-50"
                          title="开机"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onAction(vm.id, 'stop')}
                          disabled={actionPending}
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50"
                          title="关机"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onAction(vm.id, 'restart')}
                          disabled={actionPending}
                          className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-400 transition-colors disabled:opacity-50"
                          title="重启"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenSnapshots(vm)}
                          className="p-1.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                          title="快照"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenClone(vm)}
                          className="p-1.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                          title="克隆"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenStats(vm)}
                          className="p-1.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                          title="性能监控"
                        >
                          <Cpu className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(vm)}
                          className="p-1.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                          title="编辑"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(vm)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalVMs > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-text-secondary">
              <span>
                共 {totalVMs} 台，第 {page} / {Math.ceil(totalVMs / pageSize)} 页
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => onPageChange(current => Math.max(1, current - 1))}
                  className="px-3 py-1 bg-background border border-border rounded hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  disabled={page >= Math.ceil(totalVMs / pageSize)}
                  onClick={() => onPageChange(current => current + 1)}
                  className="px-3 py-1 bg-background border border-border rounded hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
