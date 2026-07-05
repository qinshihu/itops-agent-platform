import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { useToast } from '../../../../contexts/ToastContext';
import type { AggregatedStats, ApiError, Platform, PlatformForm, Snapshot, SnapshotForm, VM, VMForm, VMStats } from './types';

const defaultPlatformForm: PlatformForm = {
  name: '',
  hypervisorType: 'proxmox',
  host: '',
  port: 8006,
  username: '',
  password: '',
};

const defaultVMForm: VMForm = {
  name: '',
  os: '',
  cpu_cores: 2,
  memory_mb: 2048,
  disk_gb: 40,
  ip_address: '',
  notes: '',
  tags: '',
};

const defaultSnapshotForm: SnapshotForm = {
  name: '',
  description: '',
  memory: true,
};

export function useVirtualMachines() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedPlatformId, setSelectedPlatformId] = useState('');
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [platformForm, setPlatformForm] = useState<PlatformForm>(defaultPlatformForm);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [showVMModal, setShowVMModal] = useState(false);
  const [editingVM, setEditingVM] = useState<VM | null>(null);
  const [vmForm, setVMForm] = useState<VMForm>(defaultVMForm);

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<VM | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [clonePowerOn, setClonePowerOn] = useState(false);

  const [showSnapshotDrawer, setShowSnapshotDrawer] = useState(false);
  const [snapshotVM, setSnapshotVM] = useState<VM | null>(null);
  const [showSnapshotCreate, setShowSnapshotCreate] = useState(false);
  const [snapshotForm, setSnapshotForm] = useState<SnapshotForm>(defaultSnapshotForm);

  const [showStatsDrawer, setShowStatsDrawer] = useState(false);
  const [statsVM, setStatsVM] = useState<VM | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const { data: platforms, isLoading: platformsLoading } = useQuery<Platform[]>({
    queryKey: ['vm-platforms'],
    queryFn: async () => {
      const res = await api.get('/virtual-machines/platforms');
      return res.data.data;
    },
  });

  const selectedPlatform = platforms?.find((platform) => platform.id === selectedPlatformId);

  const { data: vmsData, isLoading: vmsLoading, refetch: refetchVMs } = useQuery<{ data: VM[]; total: number; source: string }>({
    queryKey: ['virtual-machines', page, pageSize, search, statusFilter, selectedPlatformId],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, pageSize, search };
      if (statusFilter) params.status = statusFilter;
      if (selectedPlatformId) params.platformId = selectedPlatformId;
      const res = await api.get('/virtual-machines', { params });
      return { data: res.data.data, total: res.data.total, source: res.data.source };
    },
  });

  const { data: aggregatedStats, refetch: refetchStats } = useQuery<AggregatedStats>({
    queryKey: ['vm-stats'],
    queryFn: async () => {
      const res = await api.get('/virtual-machines/stats');
      return res.data.data;
    },
  });

  const { data: vmStatsData } = useQuery<VMStats>({
    queryKey: ['vm-perf-stats', statsVM?.id],
    queryFn: async () => {
      if (!statsVM) return {};
      const res = await api.get(`/virtual-machines/${statsVM.id}/stats`);
      return res.data.data;
    },
    enabled: !!statsVM,
    refetchInterval: 5000,
  });

  const { data: snapshots, refetch: refetchSnapshots } = useQuery<Snapshot[]>({
    queryKey: ['vm-snapshots', snapshotVM?.id],
    queryFn: async () => {
      if (!snapshotVM) return [];
      const res = await api.get(`/virtual-machines/${snapshotVM.id}/snapshots`);
      return res.data.data;
    },
    enabled: !!snapshotVM && showSnapshotDrawer,
  });

  const resetPlatformForm = () => setPlatformForm(defaultPlatformForm);
  const resetVMForm = () => setVMForm(defaultVMForm);

  const createPlatformMutation = useMutation({
    mutationFn: async (data: PlatformForm) => {
      const res = await api.post('/virtual-machines/platforms', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vm-platforms'] });
      setShowPlatformModal(false);
      resetPlatformForm();
      toast.success('平台已添加');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '添加平台失败'),
  });

  const deletePlatformMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/virtual-machines/platforms/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['vm-platforms'] });
      if (selectedPlatformId === id) setSelectedPlatformId('');
      toast.success('平台已删除');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '删除平台失败'),
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/virtual-machines/platforms/${id}/test`);
      return res.data;
    },
    onSuccess: (data) => toast.success(data.data?.message || '连接测试成功'),
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '连接测试失败'),
  });

  const createVMMutation = useMutation({
    mutationFn: async (data: VMForm) => {
      const payload: Record<string, unknown> = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
        platformId: selectedPlatformId || undefined,
      };
      const res = await api.post('/virtual-machines', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      setShowVMModal(false);
      resetVMForm();
      toast.success('虚拟机已创建');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '创建虚拟机失败'),
  });

  const updateVMMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VMForm }) => {
      const payload: Record<string, unknown> = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      };
      const res = await api.put(`/virtual-machines/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      setShowVMModal(false);
      setEditingVM(null);
      resetVMForm();
      toast.success('虚拟机已更新');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '更新虚拟机失败'),
  });

  const deleteVMMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/virtual-machines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      setDeleteConfirm(null);
      toast.success('虚拟机已删除');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '删除虚拟机失败'),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await api.post(`/virtual-machines/${id}/${action}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      toast.success('操作成功');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '操作失败'),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/virtual-machines/sync', { platformId: selectedPlatformId || undefined });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['virtual-machines'] });
      queryClient.invalidateQueries({ queryKey: ['vm-stats'] });
      toast.success(`同步完成: ${data.data?.synced || 0} 台`);
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '同步失败'),
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!cloneTarget) return;
      const res = await api.post(`/virtual-machines/${cloneTarget.id}/clone`, {
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
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '克隆失败'),
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      if (!snapshotVM) return;
      const res = await api.post(`/virtual-machines/${snapshotVM.id}/snapshots`, snapshotForm);
      return res.data;
    },
    onSuccess: () => {
      refetchSnapshots();
      setShowSnapshotCreate(false);
      setSnapshotForm(defaultSnapshotForm);
      toast.success('快照已创建');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '创建快照失败'),
  });

  const restoreSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      if (!snapshotVM) return;
      const res = await api.post(`/virtual-machines/${snapshotVM.id}/snapshots/${snapshotId}/restore`);
      return res.data;
    },
    onSuccess: () => {
      refetchSnapshots();
      toast.success('快照已恢复');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '恢复快照失败'),
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      if (!snapshotVM) return;
      await api.delete(`/virtual-machines/${snapshotVM.id}/snapshots/${snapshotId}`);
    },
    onSuccess: () => {
      refetchSnapshots();
      toast.success('快照已删除');
    },
    onError: (err: ApiError) => toast.error(err.response?.data?.message || '删除快照失败'),
  });

  const selectPlatform = (platformId: string) => {
    setSelectedPlatformId(platformId);
    setPage(1);
  };

  const openPlatformModal = () => {
    resetPlatformForm();
    setShowPlatformModal(true);
  };

  const closePlatformModal = () => {
    setShowPlatformModal(false);
    resetPlatformForm();
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const refreshVMs = () => {
    refetchVMs();
    refetchStats();
  };

  const openCreateVM = () => {
    setEditingVM(null);
    resetVMForm();
    setShowVMModal(true);
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

  const closeVMModal = () => {
    setShowVMModal(false);
    setEditingVM(null);
    resetVMForm();
  };

  const submitVM = () => {
    if (editingVM) {
      updateVMMutation.mutate({ id: editingVM.id, data: vmForm });
    } else {
      createVMMutation.mutate(vmForm);
    }
  };

  const openCloneModal = (vm: VM) => {
    setCloneTarget(vm);
    setCloneName(`${vm.name}-clone`);
    setClonePowerOn(false);
    setShowCloneModal(true);
  };

  const closeCloneModal = () => {
    setShowCloneModal(false);
    setCloneTarget(null);
  };

  const openSnapshots = (vm: VM) => {
    setSnapshotVM(vm);
    setShowSnapshotDrawer(true);
  };

  const closeSnapshots = () => setShowSnapshotDrawer(false);

  const openStats = (vm: VM) => {
    setStatsVM(vm);
    setShowStatsDrawer(true);
  };

  return {
    platforms: platforms ?? [],
    platformsLoading,
    selectedPlatformId,
    selectedPlatform,
    selectPlatform,
    showPlatformModal,
    platformForm,
    setPlatformForm,
    openPlatformModal,
    closePlatformModal,

    search,
    statusFilter,
    page,
    pageSize,
    setPage,
    updateSearch,
    updateStatusFilter,
    vms: vmsData?.data ?? [],
    totalVMs: vmsData?.total ?? 0,
    vmsLoading,
    aggregatedStats,
    refreshVMs,

    showVMModal,
    editingVM,
    vmForm,
    setVMForm,
    openCreateVM,
    openEditVM,
    closeVMModal,
    submitVM,

    showCloneModal,
    cloneTarget,
    cloneName,
    clonePowerOn,
    setCloneName,
    setClonePowerOn,
    openCloneModal,
    closeCloneModal,

    showSnapshotDrawer,
    snapshotVM,
    snapshots: snapshots ?? [],
    showSnapshotCreate,
    snapshotForm,
    setSnapshotForm,
    setShowSnapshotCreate,
    openSnapshots,
    closeSnapshots,

    showStatsDrawer,
    statsVM,
    vmStatsData,
    openStats,
    closeStats: () => setShowStatsDrawer(false),

    deleteConfirm,
    setDeleteConfirm,

    createPlatformMutation,
    deletePlatformMutation,
    testConnectionMutation,
    createVMMutation,
    updateVMMutation,
    deleteVMMutation,
    actionMutation,
    syncMutation,
    cloneMutation,
    createSnapshotMutation,
    restoreSnapshotMutation,
    deleteSnapshotMutation,
  };
}
