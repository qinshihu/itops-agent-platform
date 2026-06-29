/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import {
  Server, Monitor, Cpu, HardDrive, Play, Square, RotateCcw,
  Camera, Copy, Plus, Trash2, Search, RefreshCw, Settings,
  Wifi, WifiOff, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  hypervisorType: 'vmware' | 'proxmox' | 'kvm';
  host: string;
  port: number;
  status: 'active' | 'inactive' | 'error';
  tags: string[];
}

export interface VM {
  id: string;
  name: string;
  powerState: 'poweredOn' | 'poweredOff' | 'suspended';
  hostName: string;
  guestOs: string;
  numCPUs: number;
  memoryMB: number;
  disks: Array<{ id: string; name: string; sizeGB: number; type: string }>;
  networkInterfaces: Array<{ name: string; ipAddress: string; macAddress: string }>;
  ipAddress: string;
  hypervisorType: string;
  cpuUsage?: number;
  memoryUsage?: number;
}

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

interface PlatformStatsSummary {
  platformId: string;
  platformName: string;
  total: number;
  poweredOn: number;
  poweredOff: number;
  suspended: number;
}

interface AggregatedStats {
  platforms: PlatformStatsSummary[];
  summary: { total: number; poweredOn: number; poweredOff: number; suspended: number };
  sqliteFallback: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const powerColors: Record<string, string> = {
  poweredOn: 'bg-green-500/20 text-green-400 border-green-500/30',
  poweredOff: 'bg-red-500/20 text-red-400 border-red-500/30',
  suspended: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const powerLabels: Record<string, string> = {
  poweredOn: '运行中',
  poweredOff: '已关机',
  suspended: '已挂起',
};

const platformStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return <Wifi className="w-4 h-4 text-green-400" />;
    case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
    default: return <WifiOff className="w-4 h-4 text-text-tertiary" />;
  }
};

const formatMem = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
};

// ── Component ────────────────────────────────────────────────────────────────

export default function VirtualMachines() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Platform
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [platformForm, setPlatformForm] = useState({
    name: '', hypervisorType: 'proxmox' as 'vmware' | 'proxmox' | 'kvm',
    host: '', port: 8006, username: '', password: '',
  });
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);

  // VM list
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Modals / Drawers
  const [showVMModal, setShowVMModal] = useState(false);
  const [editingVM, setEditingVM] = useState<VM | null>(null);
  const [vmForm, setVMForm] = useState({
    name: '', os: '', cpu_cores: 2, memory_mb: 2048, disk_gb: 40, ip_address: '', notes: '', tags: '',
  });

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<VM | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [clonePowerOn, setClonePowerOn] = useState(false);

  const [showSnapshotDrawer, setShowSnapshotDrawer] = useState(false);
  const [snapshotVM, setSnapshotVM] = useState<VM | null>(null);
  const [showSnapshotCreate, setShowSnapshotCreate] = useState(false);
  const [snapshotForm, setSnapshotForm] = useState({ name: '', description: '', memory: true });

  const [showStatsDrawer, setShowStatsDrawer] = useState(false);
  const [statsVM, setStatsVM] = useState<VM | null>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: platforms, isLoading: platformsLoading } = useQuery<Platform[]>({
    queryKey: ['vm-platforms'],
    queryFn: async () => {
      const res = await api.get('/api/virtual-machines/platforms');
      return res.data.data;
    },
  });

  const selectedPlatform = platforms?.find(p => p.id === selectedPlatformId);

  const { data: vmsData, isLoading: vmsLoading, refetch: refetchVMs } = useQuery<{ data: VM[]; total: number; source: string }>({
    queryKey: ['virtual-machines', page, pageSize, search, statusFilter, selectedPlatformId],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, pageSize, search };
      if (statusFilter) params.status = statusFilter;
      if (selectedPlatformId) params.platformId = selectedPlatformId;
      const res = await api.get('/api/virtual-machines', { params });
      return { data: res.data.data, total: res.data.total, source: res.data.source };
    },
  });

  const vms = vmsData?.data ?? [];
  const totalVMs = vmsData?.total ?? 0;

  const { data: aggregatedStats, refetch: refetchStats } = useQuery<AggregatedStats>({
    queryKey: ['vm-stats'],
    queryFn: async () => {
      const res = await api.get('/api/virtual-machines/stats');
      return res.data.data;
    },
  });

  // Per-VM stats
  const { data: vmStatsData } = useQuery<VMStats>({
    queryKey: ['vm-perf-stats', statsVM?.id],
    queryFn: async () => {
      if (!statsVM) return {};
      const res = await api.get(`/api/virtual-machines/${statsVM.id}/stats`);
      return res.data.data;
    },
    enabled: !!statsVM,
    refetchInterval: 5000,
  });

  // Snapshots
  const { data: snapshots, refetch: refetchSnapshots } = useQuery<Snapshot[]>({
    queryKey: ['vm-snapshots', snapshotVM?.id],
    queryFn: async () => {
      if (!snapshotVM) return [];
      const res = await api.get(`/api/virtual-machines/${snapshotVM.id}/snapshots`);
      return res.data.data;
    },
    enabled: !!snapshotVM && showSnapshotDrawer,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createPlatformMutation = useMutation({
    mutationFn: async (data: typeof platformForm) => {
      const res = await api.post('/api/virtual-machines/platforms', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vm-platforms'] });
      setShowPlatformModal(false);
      resetPlatformForm();
      toast.success('平台已添加');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '添加平台失败'),
  });

  const deletePlatformMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/virtual-machines/platforms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vm-platforms'] });
      if (selectedPlatformId === editingPlatform?.id) setSelectedPlatformId('');
      toast.success('平台已删除');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '删除平台失败'),
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/virtual-machines/platforms/${id}/test`);
      return res.data;
    },
    onSuccess: (data) => toast.success(data.data?.message || '连接测试成功'),
    onError: (err: any) => toast.error(err.response?.data?.message || '连接测试失败'),
  });

  const createVMMutation = useMutation({
    mutationFn: async (data: typeof vmForm) => {
      const payload: Record<string, unknown> = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        platformId: selectedPlatformId || undefined,
      };
      const res = await api.post('/api/virtual-machines', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      setShowVMModal(false);
      resetVMForm();
      toast.success('虚拟机已创建');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '创建虚拟机失败'),
  });

  const updateVMMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof vmForm }) => {
      const payload: Record<string, unknown> = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      };
      const res = await api.put(`/api/virtual-machines/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      setShowVMModal(false);
      setEditingVM(null);
      resetVMForm();
      toast.success('虚拟机已更新');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '更新虚拟机失败'),
  });

  const deleteVMMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/virtual-machines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      setDeleteConfirm(null);
      toast.success('虚拟机已删除');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '删除虚拟机失败'),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await api.post(`/api/virtual-machines/${id}/${action}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      toast.success('操作成功');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '操作失败'),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/virtual-machines/sync', { platformId: selectedPlatformId || undefined });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      toast.success(`同步完成: ${data.data?.synced || 0} 台`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '同步失败'),
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!cloneTarget) return;
      const res = await api.post(`/api/virtual-machines/${cloneTarget.id}/clone`, {
        name: cloneName,
        powerOn: clonePowerOn,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      setShowCloneModal(false);
      setCloneTarget(null);
      toast.success('克隆成功');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '克隆失败'),
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      if (!snapshotVM) return;
      const res = await api.post(`/api/virtual-machines/${snapshotVM.id}/snapshots`, snapshotForm);
      return res.data;
    },
    onSuccess: () => {
      refetchSnapshots();
      setShowSnapshotCreate(false);
      setSnapshotForm({ name: '', description: '', memory: true });
      toast.success('快照已创建');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '创建快照失败'),
  });

  const restoreSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      if (!snapshotVM) return;
      const res = await api.post(`/api/virtual-machines/${snapshotVM.id}/snapshots/${snapshotId}/restore`);
      return res.data;
    },
    onSuccess: () => {
      refetchSnapshots();
      toast.success('快照已恢复');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '恢复快照失败'),
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      if (!snapshotVM) return;
      await api.delete(`/api/virtual-machines/${snapshotVM.id}/snapshots/${snapshotId}`);
    },
    onSuccess: () => {
      refetchSnapshots();
      toast.success('快照已删除');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || '删除快照失败'),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const resetPlatformForm = () => {
    setPlatformForm({ name: '', hypervisorType: 'proxmox', host: '', port: 8006, username: '', password: '' });
    setEditingPlatform(null);
  };

  const resetVMForm = () => {
    setVMForm({ name: '', os: '', cpu_cores: 2, memory_mb: 2048, disk_gb: 40, ip_address: '', notes: '', tags: '' });
  };

  const openEditVM = (vm: VM) => {
    setEditingVM(vm);
    setVMForm({
      name: vm.name,
      os: vm.guestOs || '',
      cpu_cores: vm.numCPUs || 2,
      memory_mb: vm.memoryMB || 2048,
      disk_gb: vm.disks?.[0]?.sizeGB || 40,
      ip_address: vm.ipAddress || '',
      notes: '',
      tags: '',
    });
    setShowVMModal(true);
  };

  const openCreateVM = () => {
    setEditingVM(null);
    resetVMForm();
    setShowVMModal(true);
  };

  const handleVMSubmit = () => {
    if (editingVM) {
      updateVMMutation.mutate({ id: editingVM.id, data: vmForm });
    } else {
      createVMMutation.mutate(vmForm);
    }
  };

  const handlePlatformSubmit = () => {
    createPlatformMutation.mutate(platformForm);
  };

  const summary = aggregatedStats?.summary ?? { total: 0, poweredOn: 0, poweredOff: 0, suspended: 0 };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">虚拟机管理</h1>
          <p className="text-sm text-text-secondary mt-1">
            跨平台管理 Proxmox / ESXi / KVM 虚拟机
          </p>
        </div>
      </div>

      {/* ── Platform Selector ────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-text-secondary" />
          <span className="text-sm text-text-secondary whitespace-nowrap">虚拟化平台:</span>
          <select
            value={selectedPlatformId}
            onChange={(e) => { setSelectedPlatformId(e.target.value); setPage(1); }}
            className="flex-1 max-w-xs px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="">全部平台</option>
            {(platforms ?? []).map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.hypervisorType})
              </option>
            ))}
          </select>
          {selectedPlatform && (
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              {platformStatusIcon(selectedPlatform.status)}
              {selectedPlatform.status === 'active' ? '已连接' : selectedPlatform.status === 'error' ? '异常' : '未连接'}
            </span>
          )}
          <button
            onClick={() => { resetPlatformForm(); setShowPlatformModal(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors ml-auto"
          >
            <Settings className="w-4 h-4" />
            管理平台
          </button>
        </div>
      </div>

      {/* ── Stats Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
            <Server className="w-4 h-4" />
            虚拟机总数
          </div>
          <div className="text-2xl font-bold text-text-primary">{summary.total}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
            <Play className="w-4 h-4" />
            运行中
          </div>
          <div className="text-2xl font-bold text-green-400">{summary.poweredOn}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
            <Square className="w-4 h-4" />
            已关机
          </div>
          <div className="text-2xl font-bold text-red-400">{summary.poweredOff}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
            <AlertCircle className="w-4 h-4" />
            已挂起
          </div>
          <div className="text-2xl font-bold text-yellow-400">{summary.suspended}</div>
        </div>
      </div>

      {/* Platform-specific stats */}
      {(aggregatedStats?.platforms ?? []).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {(aggregatedStats?.platforms ?? []).map(ps => (
            <div key={ps.platformId} className="bg-surface border border-border rounded-lg px-4 py-2 flex items-center gap-3 text-sm">
              <span className="text-text-primary font-medium">{ps.platformName}</span>
              <span className="text-text-tertiary">|</span>
              <span className="text-text-secondary">共 {ps.total}</span>
              <span className="text-green-400">运行 {ps.poweredOn}</span>
              <span className="text-red-400">关机 {ps.poweredOff}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索名称/IP..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="">全部状态</option>
          <option value="running">运行中</option>
          <option value="stopped">已关机</option>
          <option value="suspended">已挂起</option>
        </select>
        <button
          onClick={() => { refetchVMs(); refetchStats(); }}
          className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', syncMutation.isPending && 'animate-spin')} />
          同步
        </button>
        <button
          onClick={openCreateVM}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors ml-auto"
        >
          <Plus className="w-4 h-4" />
          新建 VM
        </button>
      </div>

      {/* ── VM Table ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {vmsLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-background rounded animate-pulse" />
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
                          ? `${vm.disks.reduce((s, d) => s + (d.sizeGB || 0), 0)} GB`
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                        {vm.ipAddress || (vm.networkInterfaces?.[0]?.ipAddress) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => actionMutation.mutate({ id: vm.id, action: 'start' })}
                            disabled={actionMutation.isPending}
                            className="p-1.5 rounded hover:bg-green-500/10 text-green-400 transition-colors disabled:opacity-50"
                            title="开机"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => actionMutation.mutate({ id: vm.id, action: 'stop' })}
                            disabled={actionMutation.isPending}
                            className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50"
                            title="关机"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => actionMutation.mutate({ id: vm.id, action: 'restart' })}
                            disabled={actionMutation.isPending}
                            className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-400 transition-colors disabled:opacity-50"
                            title="重启"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setSnapshotVM(vm); setShowSnapshotDrawer(true); }}
                            className="p-1.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                            title="快照"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setCloneTarget(vm); setCloneName(`${vm.name}-clone`); setClonePowerOn(false); setShowCloneModal(true); }}
                            className="p-1.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                            title="克隆"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setStatsVM(vm); setShowStatsDrawer(true); }}
                            className="p-1.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                            title="性能监控"
                          >
                            <Cpu className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditVM(vm)}
                            className="p-1.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors"
                            title="编辑"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ id: vm.id, name: vm.name })}
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
            {/* Pagination */}
            {totalVMs > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-text-secondary">
                <span>
                  共 {totalVMs} 台，第 {page} / {Math.ceil(totalVMs / pageSize)} 页
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-background border border-border rounded hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    disabled={page >= Math.ceil(totalVMs / pageSize)}
                    onClick={() => setPage(p => p + 1)}
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

      {/* ════════════════════════════════════════════════════════════════
          Platform Management Modal
          ════════════════════════════════════════════════════════════════ */}
      {showPlatformModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setShowPlatformModal(false); resetPlatformForm(); }}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">管理虚拟化平台</h3>

            {/* Platform List */}
            <div className="mb-6">
              {platformsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 bg-background rounded animate-pulse" />
                  ))}
                </div>
              ) : (platforms ?? []).length === 0 ? (
                <div className="text-center py-8 text-text-secondary text-sm">
                  <Server className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  暂无平台，请添加
                </div>
              ) : (
                <div className="space-y-2">
                  {(platforms ?? []).map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-text-primary font-medium">{p.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{p.hypervisorType}</span>
                          {platformStatusIcon(p.status)}
                        </div>
                        <div className="text-xs text-text-tertiary mt-0.5">{p.host}:{p.port}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testConnectionMutation.mutate(p.id)}
                          disabled={testConnectionMutation.isPending}
                          className="p-2 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
                          title="测试连接"
                        >
                          <Wifi className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`确定要删除平台 "${p.name}" 吗？`)) {
                              deletePlatformMutation.mutate(p.id);
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

            {/* Add Platform Form */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-text-primary mb-3">添加新平台</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">名称</label>
                  <input
                    type="text"
                    value={platformForm.name}
                    onChange={e => setPlatformForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="例如: Proxmox-Prod"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">类型</label>
                  <select
                    value={platformForm.hypervisorType}
                    onChange={e => setPlatformForm(p => ({ ...p, hypervisorType: e.target.value as any }))}
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
                    value={platformForm.host}
                    onChange={e => setPlatformForm(p => ({ ...p, host: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">端口</label>
                  <input
                    type="number"
                    value={platformForm.port}
                    onChange={e => setPlatformForm(p => ({ ...p, port: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">用户名</label>
                  <input
                    type="text"
                    value={platformForm.username}
                    onChange={e => setPlatformForm(p => ({ ...p, username: e.target.value }))}
                    placeholder="root"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">密码</label>
                  <input
                    type="password"
                    value={platformForm.password}
                    onChange={e => setPlatformForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="********"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setShowPlatformModal(false); resetPlatformForm(); }}
                  className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={handlePlatformSubmit}
                  disabled={!platformForm.name || !platformForm.host || createPlatformMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createPlatformMutation.isPending ? (
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
      )}

      {/* ════════════════════════════════════════════════════════════════
          Create / Edit VM Modal
          ════════════════════════════════════════════════════════════════ */}
      {showVMModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setShowVMModal(false); setEditingVM(null); resetVMForm(); }}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">
              {editingVM ? '编辑虚拟机' : '新建虚拟机'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">名称 *</label>
                <input
                  type="text"
                  value={vmForm.name}
                  onChange={e => setVMForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VM 名称"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">操作系统</label>
                <input
                  type="text"
                  value={vmForm.os}
                  onChange={e => setVMForm(f => ({ ...f, os: e.target.value }))}
                  placeholder="例如: Ubuntu 22.04"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">CPU 核数</label>
                  <input
                    type="number"
                    value={vmForm.cpu_cores}
                    onChange={e => setVMForm(f => ({ ...f, cpu_cores: parseInt(e.target.value) || 1 }))}
                    min={1}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">内存 (MB)</label>
                  <input
                    type="number"
                    value={vmForm.memory_mb}
                    onChange={e => setVMForm(f => ({ ...f, memory_mb: parseInt(e.target.value) || 128 }))}
                    min={128}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">磁盘 (GB)</label>
                  <input
                    type="number"
                    value={vmForm.disk_gb}
                    onChange={e => setVMForm(f => ({ ...f, disk_gb: parseInt(e.target.value) || 10 }))}
                    min={10}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">IP 地址</label>
                <input
                  type="text"
                  value={vmForm.ip_address}
                  onChange={e => setVMForm(f => ({ ...f, ip_address: e.target.value }))}
                  placeholder="192.168.1.50"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">标签 (逗号分隔)</label>
                <input
                  type="text"
                  value={vmForm.tags}
                  onChange={e => setVMForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="prod, web, db"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">备注</label>
                <textarea
                  value={vmForm.notes}
                  onChange={e => setVMForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="备注信息..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowVMModal(false); setEditingVM(null); resetVMForm(); }}
                className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleVMSubmit}
                disabled={!vmForm.name || createVMMutation.isPending || updateVMMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editingVM ? '保存更改' : '创建虚拟机'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          Clone VM Modal
          ════════════════════════════════════════════════════════════════ */}
      {showCloneModal && cloneTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setShowCloneModal(false); setCloneTarget(null); }}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">克隆虚拟机: {cloneTarget.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">新虚拟机名称 *</label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={e => setCloneName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clonePowerOn}
                  onChange={e => setClonePowerOn(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-text-secondary">克隆后立即开机</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowCloneModal(false); setCloneTarget(null); }}
                className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => cloneMutation.mutate()}
                disabled={!cloneName.trim() || cloneMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cloneMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    克隆中...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    克隆
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          Snapshots Drawer
          ════════════════════════════════════════════════════════════════ */}
      {showSnapshotDrawer && snapshotVM && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSnapshotDrawer(false)} />
          <div className="relative w-full max-w-md bg-surface border-l border-border h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-text-primary">快照管理</h3>
                <p className="text-sm text-text-secondary">{snapshotVM.name}</p>
              </div>
              <button
                onClick={() => setShowSnapshotDrawer(false)}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5 text-text-secondary" />
              </button>
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
                  <p className="text-sm">暂无双照</p>
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
                              restoreSnapshotMutation.mutate(snap.id);
                            }
                          }}
                          disabled={restoreSnapshotMutation.isPending}
                          className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-400 transition-colors disabled:opacity-50"
                          title="恢复快照"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('确定删除此快照？')) {
                              deleteSnapshotMutation.mutate(snap.id);
                            }
                          }}
                          disabled={deleteSnapshotMutation.isPending}
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
      )}

      {/* Create Snapshot Sub-Modal */}
      {showSnapshotCreate && snapshotVM && (
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
                onClick={() => createSnapshotMutation.mutate()}
                disabled={!snapshotForm.name || createSnapshotMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createSnapshotMutation.isPending ? (
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

      {/* ════════════════════════════════════════════════════════════════
          VM Stats Drawer
          ════════════════════════════════════════════════════════════════ */}
      {showStatsDrawer && statsVM && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowStatsDrawer(false)} />
          <div className="relative w-full max-w-sm bg-surface border-l border-border h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-text-primary">性能监控</h3>
                <p className="text-sm text-text-secondary">{statsVM.name}</p>
              </div>
              <button
                onClick={() => setShowStatsDrawer(false)}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-6">
              {/* CPU */}
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

              {/* Memory */}
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

              {/* VM Info */}
              <div className="bg-background border border-border rounded-lg p-4">
                <h4 className="text-sm font-medium text-text-primary mb-3">基本信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">状态</span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      statsVM.powerState === 'poweredOn' ? 'bg-green-500/20 text-green-400' :
                        statsVM.powerState === 'poweredOff' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                    )}>
                      {powerLabels[statsVM.powerState] || statsVM.powerState}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">操作系统</span>
                    <span className="text-text-primary">{statsVM.guestOs || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">CPU</span>
                    <span className="text-text-primary">{statsVM.numCPUs || 0} 核</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">内存</span>
                    <span className="text-text-primary">{formatMem(statsVM.memoryMB || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">磁盘</span>
                    <span className="text-text-primary">
                      {statsVM.disks?.length ? `${statsVM.disks.reduce((s, d) => s + (d.sizeGB || 0), 0)} GB` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">IP 地址</span>
                    <span className="text-text-primary font-mono text-xs">{statsVM.ipAddress || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">平台</span>
                    <span className="text-text-primary">{statsVM.hypervisorType || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          Delete Confirm
          ════════════════════════════════════════════════════════════════ */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-4 border border-red-500/20" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              删除虚拟机
            </h3>
            <p className="text-text-secondary mb-6">
              确定要删除虚拟机 <span className="text-text-primary font-medium">{deleteConfirm.name}</span> 吗？此操作将同时从虚拟化平台和本地数据库中移除。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => deleteVMMutation.mutate(deleteConfirm.id)}
                disabled={deleteVMMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteVMMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    确认删除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
