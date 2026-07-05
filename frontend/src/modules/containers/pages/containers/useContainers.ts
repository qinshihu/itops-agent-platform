import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { useToast } from '../../../../contexts/ToastContext';
import type { Tab, EndpointHost, ContainerItem, NetworkItem, EndpointItem } from '../types';
import { withEndpointParams } from '../types';

export function useContainers() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('containers');
  const [endpointId, setEndpointId] = useState('local');

  // ── Container tab state ──
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [showStatsDrawer, setShowStatsDrawer] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [selectedContainerName, setSelectedContainerName] = useState('');
  // Create form
  const [createImage, setCreateImage] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPorts, setCreatePorts] = useState('');
  const [createEnv, setCreateEnv] = useState('');
  const [createVolumes, setCreateVolumes] = useState('');
  const [createRestart, setCreateRestart] = useState('no');
  const [createMemory, setCreateMemory] = useState('');
  const [createCpuShares, setCreateCpuShares] = useState('');

  // ── Network tab state ──
  const [showNetCreateModal, setShowNetCreateModal] = useState(false);
  const [showNetDetailDrawer, setShowNetDetailDrawer] = useState(false);
  const [netDetailData, setNetDetailData] = useState<NetworkItem | null>(null);
  const [netName, setNetName] = useState('');
  const [netDriver, setNetDriver] = useState('bridge');
  const [netSubnet, setNetSubnet] = useState('');
  const [netGateway, setNetGateway] = useState('');
  const [netInternal, setNetInternal] = useState(false);
  const [netAttachable, setNetAttachable] = useState(false);

  // ── Endpoint tab state ──
  const [showEpCreateModal, setShowEpCreateModal] = useState(false);
  const [editingEpId, setEditingEpId] = useState<string | null>(null);
  const [epName, setEpName] = useState('');
  const [epHost, setEpHost] = useState('');
  const [epPort, setEpPort] = useState('2375');
  const [epProtocol, setEpProtocol] = useState('tcp');
  const [epTlsCa, setEpTlsCa] = useState('');
  const [epTlsCert, setEpTlsCert] = useState('');
  const [epTlsKey, setEpTlsKey] = useState('');

  // ═══ QUERIES ═══════════════════════════════════════════

  const endpointsQueryKey = ['containers-hosts'];
  const { data: hosts = [] } = useQuery<EndpointHost[]>({
    queryKey: endpointsQueryKey,
    queryFn: async () => {
      const res = await api.get('/containers/hosts');
      return res.data.data || [];
    },
  });

  const containersQueryKey = ['containers-list', endpointId, page, pageSize, search, statusFilter];
  const { data: containerData, isLoading: containersLoading, error: containersError } = useQuery({
    queryKey: containersQueryKey,
    queryFn: async () => {
      const res = await api.get('/containers', {
        params: { page, pageSize, search, status: statusFilter || undefined, endpointId: endpointId !== 'local' ? endpointId : undefined },
      });
      return { data: (res.data.data || []) as ContainerItem[], total: res.data.total as number };
    },
    enabled: activeTab === 'containers',
  });

  const networksQueryKey = ['containers-networks', endpointId];
  const { data: networks = [], isLoading: networksLoading, error: networksError } = useQuery<NetworkItem[]>({
    queryKey: networksQueryKey,
    queryFn: async () => {
      const res = await api.get('/containers/networks/list', {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      });
      return res.data.data || [];
    },
    enabled: activeTab === 'networks',
  });

  const endpointsListQueryKey = ['containers-endpoints'];
  const { data: endpoints = [], isLoading: endpointsLoading, error: endpointsError } = useQuery<EndpointItem[]>({
    queryKey: endpointsListQueryKey,
    queryFn: async () => {
      const res = await api.get('/containers/endpoints');
      return res.data.data || [];
    },
    enabled: activeTab === 'endpoints',
  });

  // ═══ MUTATIONS ═════════════════════════════════════════

  const containerActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/containers/${id}/${action}`, null, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: containersQueryKey });
      toast.success(`容器已${vars.action === 'start' ? '启动' : vars.action === 'stop' ? '停止' : '重启'}`);
    },
    onError: () => toast.error('操作失败'),
  });

  const deleteContainerMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/containers/${id}`, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: containersQueryKey });
      toast.success('容器已删除');
    },
    onError: () => toast.error('删除失败'),
  });

  const createContainerMutation = useMutation({
    mutationFn: () =>
      api.post('/containers/run', {
        image: createImage,
        name: createName || undefined,
        ports: createPorts ? createPorts.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        env: createEnv ? createEnv.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        volumes: createVolumes ? createVolumes.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        restartPolicy: createRestart,
        memory: createMemory ? parseInt(createMemory) * 1024 * 1024 : undefined,
        cpuShares: createCpuShares ? parseInt(createCpuShares) : undefined,
      }, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: containersQueryKey });
      toast.success('容器已创建');
      setShowCreateModal(false);
      resetCreateForm();
    },
    onError: () => toast.error('创建容器失败'),
  });

  const createNetworkMutation = useMutation({
    mutationFn: () =>
      api.post('/containers/networks', {
        name: netName, driver: netDriver,
        subnet: netSubnet || undefined, gateway: netGateway || undefined,
        internal: netInternal, attachable: netAttachable,
      }, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: networksQueryKey });
      toast.success('网络已创建');
      setShowNetCreateModal(false);
      resetNetForm();
    },
    onError: () => toast.error('创建网络失败'),
  });

  const deleteNetworkMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/containers/networks/${id}`, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: networksQueryKey });
      toast.success('网络已删除');
    },
    onError: () => toast.error('删除网络失败'),
  });

  const createEndpointMutation = useMutation({
    mutationFn: () =>
      api.post('/containers/endpoints', {
        name: epName, host: epHost,
        port: parseInt(epPort) || 2375, protocol: epProtocol,
        tlsCa: epProtocol === 'tcp+tls' ? epTlsCa || undefined : undefined,
        tlsCert: epProtocol === 'tcp+tls' ? epTlsCert || undefined : undefined,
        tlsKey: epProtocol === 'tcp+tls' ? epTlsKey || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
      toast.success('端点已添加');
      setShowEpCreateModal(false);
      resetEpForm();
    },
    onError: () => toast.error('添加端点失败'),
  });

  const updateEndpointMutation = useMutation({
    mutationFn: () =>
      api.put(`/containers/endpoints/${editingEpId}`, {
        name: epName, host: epHost,
        port: parseInt(epPort) || 2375, protocol: epProtocol,
        tlsCa: epProtocol === 'tcp+tls' ? epTlsCa || undefined : undefined,
        tlsCert: epProtocol === 'tcp+tls' ? epTlsCert || undefined : undefined,
        tlsKey: epProtocol === 'tcp+tls' ? epTlsKey || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
      toast.success('端点已更新');
      setShowEpCreateModal(false);
      resetEpForm();
    },
    onError: () => toast.error('更新端点失败'),
  });

  const deleteEndpointMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/containers/endpoints/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
      toast.success('端点已删除');
    },
    onError: () => toast.error('删除端点失败'),
  });

  const testEndpointMutation = useMutation({
    mutationFn: (ep: { host: string; port: number; protocol: string; tlsCa?: string; tlsCert?: string; tlsKey?: string }) =>
      api.post('/containers/endpoints/test', ep),
    onSuccess: (res) => {
      const d = res.data.data;
      toast.success(d?.success ? '连接测试成功' : `连接失败: ${d?.message || '未知错误'}`);
    },
    onError: () => toast.error('测试请求失败'),
  });

  const refreshEndpointMutation = useMutation({
    mutationFn: (id: string) => api.post(`/containers/endpoints/${id}/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      toast.success('端点已刷新');
    },
    onError: () => toast.error('刷新端点失败'),
  });

  // ═══ HELPERS ═══════════════════════════════════════════

  function resetCreateForm() {
    setCreateImage(''); setCreateName(''); setCreatePorts(''); setCreateEnv('');
    setCreateVolumes(''); setCreateRestart('no'); setCreateMemory(''); setCreateCpuShares('');
  }

  function resetNetForm() {
    setNetName(''); setNetDriver('bridge'); setNetSubnet('');
    setNetGateway(''); setNetInternal(false); setNetAttachable(false);
  }

  function resetEpForm() {
    setEpName(''); setEpHost(''); setEpPort('2375'); setEpProtocol('tcp');
    setEpTlsCa(''); setEpTlsCert(''); setEpTlsKey('');
    setEditingEpId(null);
  }

  function openEpEditModal(ep: EndpointItem) {
    setEditingEpId(ep.id);
    setEpName(ep.name);
    setEpHost(ep.host);
    setEpPort(String(ep.port || 2375));
    setEpProtocol(ep.protocol || 'tcp');
    setEpTlsCa(ep.tlsCa || '');
    setEpTlsCert(ep.tlsCert || '');
    setEpTlsKey(ep.tlsKey || '');
    setShowEpCreateModal(true);
  }

  // ═══ NETWORK DETAIL QUERY ═════════════════════════════

  const { data: networkDetailData } = useQuery({
    queryKey: ['network-detail', netDetailData?.Id || netDetailData?.id],
    queryFn: async () => {
      const id = netDetailData?.Id || netDetailData?.id;
      const res = await api.get(`/containers/networks/${id}`, {
        params: withEndpointParams(endpointId),
      });
      return res.data.data as NetworkItem;
    },
    enabled: showNetDetailDrawer && !!(netDetailData?.Id || netDetailData?.id),
  });

  const displayNetDetail = networkDetailData || netDetailData;

  return {
    // Shared
    queryClient,
    activeTab, setActiveTab,
    endpointId, setEndpointId,

    // Hosts
    hosts,
    endpointsQueryKey,

    // Containers
    containersQueryKey,
    containerData, containersLoading, containersError,
    page, setPage, pageSize,
    search, setSearch,
    statusFilter, setStatusFilter,
    showCreateModal, setShowCreateModal,
    showLogsDrawer, setShowLogsDrawer,
    showStatsDrawer, setShowStatsDrawer,
    showDetailDrawer, setShowDetailDrawer,
    selectedContainerId, setSelectedContainerId,
    selectedContainerName, setSelectedContainerName,
    // Create form
    createImage, setCreateImage,
    createName, setCreateName,
    createPorts, setCreatePorts,
    createEnv, setCreateEnv,
    createVolumes, setCreateVolumes,
    createRestart, setCreateRestart,
    createMemory, setCreateMemory,
    createCpuShares, setCreateCpuShares,
    // Container mutations
    containerActionMutation,
    deleteContainerMutation,
    createContainerMutation,
    resetCreateForm,

    // Networks
    networksQueryKey,
    networks, networksLoading, networksError,
    showNetCreateModal, setShowNetCreateModal,
    showNetDetailDrawer, setShowNetDetailDrawer,
    netDetailData, setNetDetailData,
    netName, setNetName,
    netDriver, setNetDriver,
    netSubnet, setNetSubnet,
    netGateway, setNetGateway,
    netInternal, setNetInternal,
    netAttachable, setNetAttachable,
    createNetworkMutation,
    deleteNetworkMutation,
    networkDetailData, displayNetDetail,
    resetNetForm,

    // Endpoints
    endpointsListQueryKey,
    endpoints, endpointsLoading, endpointsError,
    showEpCreateModal, setShowEpCreateModal,
    editingEpId, setEditingEpId,
    epName, setEpName,
    epHost, setEpHost,
    epPort, setEpPort,
    epProtocol, setEpProtocol,
    epTlsCa, setEpTlsCa,
    epTlsCert, setEpTlsCert,
    epTlsKey, setEpTlsKey,
    createEndpointMutation,
    updateEndpointMutation,
    deleteEndpointMutation,
    testEndpointMutation,
    refreshEndpointMutation,
    resetEpForm,
    openEpEditModal,
  };
}