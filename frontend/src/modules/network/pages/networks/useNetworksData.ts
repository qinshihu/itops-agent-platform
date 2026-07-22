/**
 * Networks 数据 hook（2026-07-21 拆分）
 *
 * 把原 Networks.tsx L68-220 的 state + query + mutation + handlers 抽出
 * 包含：
 * - 7 useState（searchTerm + typeFilter + selectedSubnet + ipSearch + ipStatusFilter + modal + setSubmitting）
 * - 1 useState Set<string>（selectedIps）
 * - 1 useState form 5 个 field（subnetName / subnetCidr 等聚合为 subnetForm Data）
 * - 2 query（subnets list + single subnet ips）
 * - 4 mutation（create + update + delete subnet + batch ip operation）
 * - 5 handlers（handleEdit / handleDelete / openCreateModal / closeSubnetModal / handleBatchAction）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import { useToast } from '@/contexts/ToastContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import {
  type IpBatchAction,
  type IpListData,
  type SubnetFormData,
  type SubnetInfo,
  DEFAULT_SUBNET_FORM,
} from './types';

export interface UseNetworksDataResult {
  // main state
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  typeFilter: string;
  setTypeFilter: (s: string) => void;
  selectedSubnet: SubnetInfo | null;
  setSelectedSubnet: (s: SubnetInfo | null) => void;

  // ip list state
  ipSearch: string;
  setIpSearch: (s: string) => void;
  ipStatusFilter: string;
  setIpStatusFilter: (s: string) => void;

  // subnet modal
  subnetModal: boolean;
  setSubnetModal: (b: boolean) => void;
  editingSubnet: SubnetInfo | null;
  subnetForm: SubnetFormData;
  setSubnetForm: React.Dispatch<React.SetStateAction<SubnetFormData>>;

  // ip selection + batch action
  selectedIps: Set<string>;
  setSelectedIps: (s: Set<string>) => void;
  ipActionModal: IpBatchAction | null;
  setIpActionModal: (a: IpBatchAction | null) => void;

  // queries
  subnets: SubnetInfo[];
  isLoadingSubnets: boolean;
  ipData: IpListData | null;
  isLoadingIps: boolean;

  // mutations
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isBatchOperating: boolean;

  // mutations
  refetch: () => void;

  // handlers
  openCreateModal: () => void;
  handleEditSubnet: (s: SubnetInfo) => void;
  handleDeleteSubnet: (id: string) => void;
  closeSubnetModal: () => void;
  handleSubmitSubnet: () => void;
  handleBatchAction: (status: IpBatchAction) => void;
}

export function useNetworksData(): UseNetworksDataResult {
  const queryClient = useQueryClient();
  const toast = useToast();

  // main state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedSubnet, setSelectedSubnet] = useState<SubnetInfo | null>(null);
  const [ipSearch, setIpSearch] = useState('');
  const [ipStatusFilter, setIpStatusFilter] = useState('');

  // subnet modal
  const [subnetModal, setSubnetModal] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<SubnetInfo | null>(null);
  const [subnetForm, setSubnetForm] = useState<SubnetFormData>(DEFAULT_SUBNET_FORM);

  // IP selection
  const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set());
  const [ipActionModal, setIpActionModal] = useState<IpBatchAction | null>(null);

  useEscapeKey({ onEscape: () => setSubnetModal(false), enabled: subnetModal });
  useEscapeKey({ onEscape: () => setSelectedSubnet(null), enabled: !!selectedSubnet });

  // ── Queries ──
  const { data: subnets = [], isLoading: isLoadingSubnets } = useQuery<SubnetInfo[]>({
    queryKey: ['network-subnets'],
    queryFn: async () => {
      const { data } = await api.get('/network-subnets');
      return data as SubnetInfo[];
    },
    refetchInterval: 30000,
  });

  const { data: ipData, isLoading: isLoadingIps } = useQuery<IpListData>({
    queryKey: ['network-subnet-ips', selectedSubnet?.id, ipStatusFilter, ipSearch],
    queryFn: async () => {
      const { data } = await api.get(`/network-subnets/${selectedSubnet!.id}/ips`, {
        params: {
          status: ipStatusFilter || undefined,
          search: ipSearch || undefined,
          pageSize: 500,
        },
      });
      return data as IpListData;
    },
    enabled: !!selectedSubnet,
  });

  // ── Subnet CRUD mutations ──
  const createMutation = useMutation({
    mutationFn: async () => {
      return api.post('/network-subnets', {
        name: subnetForm.name,
        cidr: subnetForm.cidr,
        gateway: subnetForm.gateway || undefined,
        vlan_id: subnetForm.vlan_id ? parseInt(subnetForm.vlan_id, 10) : undefined,
        network_type: subnetForm.network_type,
        location: subnetForm.location || undefined,
        description: subnetForm.description || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-subnets'] });
      toast.success('子网已创建');
      closeSubnetModal();
    },
    onError: (err: unknown) => toast.error(getAxiosErrorMessage(err, '创建失败')),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      return api.put(`/network-subnets/${editingSubnet!.id}`, {
        name: subnetForm.name,
        gateway: subnetForm.gateway || null,
        vlan_id: subnetForm.vlan_id ? parseInt(subnetForm.vlan_id, 10) : null,
        network_type: subnetForm.network_type,
        location: subnetForm.location || null,
        description: subnetForm.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-subnets'] });
      toast.success('子网已更新');
      closeSubnetModal();
    },
    onError: (err: unknown) => toast.error(getAxiosErrorMessage(err, '更新失败')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/network-subnets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-subnets'] });
      toast.success('子网已删除');
    },
    onError: () => toast.error('删除失败'),
  });

  // ── IP 批量操作 mutation ──
  const batchIpMutation = useMutation({
    mutationFn: async (status: IpBatchAction) => {
      return api.post(`/network-subnets/${selectedSubnet!.id}/ips/batch`, {
        ip_ids: Array.from(selectedIps),
        status,
        device_name: status === 'use' ? '手动分配' : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-subnet-ips', selectedSubnet?.id] });
      queryClient.invalidateQueries({ queryKey: ['network-subnets'] });
      toast.success('操作成功');
      setSelectedIps(new Set());
      setIpActionModal(null);
    },
    onError: () => toast.error('操作失败'),
  });

  // ── Handlers ──
  const closeSubnetModal = useCallback(() => {
    setSubnetModal(false);
    setEditingSubnet(null);
    setSubnetForm(DEFAULT_SUBNET_FORM);
  }, []);

  const openCreateModal = useCallback(() => {
    setSubnetModal(true);
    setEditingSubnet(null);
    setSubnetForm(DEFAULT_SUBNET_FORM);
  }, []);

  const handleEditSubnet = useCallback((s: SubnetInfo) => {
    setEditingSubnet(s);
    setSubnetForm({
      name: s.name,
      cidr: s.cidr,
      gateway: s.gateway || '',
      vlan_id: s.vlan_id?.toString() || '',
      network_type: s.network_type || 'lan',
      location: s.location || '',
      description: s.description || '',
    });
    setSubnetModal(true);
  }, []);

  const handleDeleteSubnet = useCallback(
    (id: string) => {
      if (window.confirm('确定删除该子网吗？')) {
        deleteMutation.mutate(id);
      }
    },
    [deleteMutation],
  );

  const handleSubmitSubnet = useCallback(() => {
    if (editingSubnet) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }, [editingSubnet, createMutation, updateMutation]);

  const handleBatchAction = useCallback(
    (status: IpBatchAction) => {
      setIpActionModal(status);
      batchIpMutation.mutate(status);
    },
    [batchIpMutation],
  );

  return {
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    selectedSubnet,
    setSelectedSubnet,

    ipSearch,
    setIpSearch,
    ipStatusFilter,
    setIpStatusFilter,

    subnetModal,
    setSubnetModal,
    editingSubnet,
    subnetForm,
    setSubnetForm,

    selectedIps,
    setSelectedIps,
    ipActionModal,
    setIpActionModal,

    subnets,
    isLoadingSubnets,
    ipData: ipData ?? null,
    isLoadingIps,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBatchOperating: batchIpMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['network-subnets'] }),

    openCreateModal,
    handleEditSubnet,
    handleDeleteSubnet,
    closeSubnetModal,
    handleSubmitSubnet,
    handleBatchAction,
  };
}
