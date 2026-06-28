import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Image, HardDrive, Globe, Server, Plus, Trash2, Search, RefreshCw,
  Play, Square, RotateCcw, Eye, FileText, Activity, Download, X,
  ChevronLeft, ChevronRight, Monitor, Terminal, Edit,
} from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

// ── Types ──────────────────────────────────────────────

type Tab = 'containers' | 'images' | 'volumes' | 'networks' | 'endpoints';

interface EndpointHost {
  id: string;
  name: string;
  host: string;
  port?: number;
  protocol?: string;
  status: string;
}

interface ContainerItem {
  id: string;
  Names?: string[];
  name?: string;
  Image?: string;
  image?: string;
  State?: string;
  state?: string;
  Status?: string;
  status?: string;
  Ports?: Array<{ PublicPort?: number; PrivatePort?: number; Type?: string }>;
  Created?: number;
  created?: number;
}

interface ImageItem {
  Id?: string;
  id?: string;
  RepoTags?: string[];
  RepoDigests?: string[];
  Size?: number;
  Created?: number;
}

interface VolumeItem {
  Name?: string;
  name?: string;
  Driver?: string;
  driver?: string;
  Mountpoint?: string;
  mountpoint?: string;
  CreatedAt?: string;
  createdAt?: string;
}

interface NetworkItem {
  Id?: string;
  id?: string;
  Name?: string;
  name?: string;
  Driver?: string;
  driver?: string;
  Scope?: string;
  scope?: string;
  IPAM?: { Driver?: string; Config?: Array<{ Subnet?: string; Gateway?: string }> };
  Containers?: Record<string, { Name: string; IPv4Address: string }>;
  containers?: Record<string, { Name: string; IPv4Address: string }>;
}

interface EndpointItem {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  status: string;
  tlsCa?: string;
  tlsCert?: string;
  tlsKey?: string;
  error_message?: string;
}

// ── Helpers ────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(ts: number | string | undefined): string {
  if (!ts) return '-';
  const d = new Date(typeof ts === 'string' ? ts : ts * 1000);
  return d.toLocaleString('zh-CN');
}

function statusBadge(status: string): { bg: string; text: string; dot: string } {
  const s = status?.toLowerCase() || '';
  if (s === 'running' || s === 'active' || s === 'up') return { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', dot: 'bg-green-500' };
  if (s === 'stopped' || s === 'exited' || s === 'inactive') return { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' };
  if (s === 'paused') return { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-500' };
  if (s === 'error') return { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' };
  return { bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-gray-400', dot: 'bg-gray-500' };
}

function containerName(c: ContainerItem): string {
  const name = (c.Names?.[0] || c.name || '').replace(/^\//, '');
  return name || c.id?.substring(0, 12) || '-';
}

function imageRepo(img: ImageItem): string {
  const tag = img.RepoTags?.[0] || '';
  const idx = tag.lastIndexOf(':');
  return idx > 0 ? tag.substring(0, idx) : tag || '<none>';
}

function imageTagOnly(img: ImageItem): string {
  const tag = img.RepoTags?.[0] || '';
  const idx = tag.lastIndexOf(':');
  return idx > 0 ? tag.substring(idx + 1) : 'latest';
}

// ── Component ──────────────────────────────────────────

export default function Containers() {
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

  // ── Image tab state ──
  const [showPullModal, setShowPullModal] = useState(false);
  const [pullImageName, setPullImageName] = useState('');

  // ── Volume tab state ──
  const [showVolCreateModal, setShowVolCreateModal] = useState(false);
  const [volName, setVolName] = useState('');
  const [volDriver, setVolDriver] = useState('local');

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
      const res = await api.get('/api/containers/hosts');
      return res.data.data || [];
    },
  });

  const containersQueryKey = ['containers-list', endpointId, page, pageSize, search, statusFilter];
  const { data: containerData, isLoading: containersLoading, error: containersError } = useQuery({
    queryKey: containersQueryKey,
    queryFn: async () => {
      const res = await api.get('/api/containers', {
        params: { page, pageSize, search, status: statusFilter || undefined, endpointId: endpointId !== 'local' ? endpointId : undefined },
      });
      return { data: (res.data.data || []) as ContainerItem[], total: res.data.total as number };
    },
    enabled: activeTab === 'containers',
  });

  const imagesQueryKey = ['containers-images', endpointId];
  const { data: images = [], isLoading: imagesLoading, error: imagesError } = useQuery<ImageItem[]>({
    queryKey: imagesQueryKey,
    queryFn: async () => {
      const res = await api.get('/api/containers/images/list', {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      });
      return res.data.data || [];
    },
    enabled: activeTab === 'images',
  });

  const volumesQueryKey = ['containers-volumes', endpointId];
  const { data: volumes = [], isLoading: volumesLoading, error: volumesError } = useQuery<VolumeItem[]>({
    queryKey: volumesQueryKey,
    queryFn: async () => {
      const res = await api.get('/api/containers/volumes/list', {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      });
      return res.data.data || [];
    },
    enabled: activeTab === 'volumes',
  });

  const networksQueryKey = ['containers-networks', endpointId];
  const { data: networks = [], isLoading: networksLoading, error: networksError } = useQuery<NetworkItem[]>({
    queryKey: networksQueryKey,
    queryFn: async () => {
      const res = await api.get('/api/containers/networks/list', {
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
      const res = await api.get('/api/containers/endpoints');
      return res.data.data || [];
    },
    enabled: activeTab === 'endpoints',
  });

  // ═══ MUTATIONS ═════════════════════════════════════════

  const containerActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/api/containers/${id}/${action}`, null, {
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
      api.delete(`/api/containers/${id}`, {
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
      api.post('/api/containers/run', {
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

  const pullImageMutation = useMutation({
    mutationFn: () =>
      api.post('/api/containers/images/pull', { image: pullImageName }, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagesQueryKey });
      toast.success('镜像拉取成功');
      setShowPullModal(false);
      setPullImageName('');
    },
    onError: () => toast.error('拉取镜像失败'),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/containers/images/${id}`, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagesQueryKey });
      toast.success('镜像已删除');
    },
    onError: () => toast.error('删除镜像失败'),
  });

  const createVolumeMutation = useMutation({
    mutationFn: () =>
      api.post('/api/containers/volumes', { name: volName, driver: volDriver }, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: volumesQueryKey });
      toast.success('数据卷已创建');
      setShowVolCreateModal(false);
      setVolName('');
      setVolDriver('local');
    },
    onError: () => toast.error('创建数据卷失败'),
  });

  const deleteVolumeMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/containers/volumes/${id}`, {
        params: { endpointId: endpointId !== 'local' ? endpointId : undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: volumesQueryKey });
      toast.success('数据卷已删除');
    },
    onError: () => toast.error('删除数据卷失败'),
  });

  const createNetworkMutation = useMutation({
    mutationFn: () =>
      api.post('/api/containers/networks', {
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
      api.delete(`/api/containers/networks/${id}`, {
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
      api.post('/api/containers/endpoints', {
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
      api.put(`/api/containers/endpoints/${editingEpId}`, {
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
    mutationFn: (id: string) => api.delete(`/api/containers/endpoints/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
      queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
      toast.success('端点已删除');
    },
    onError: () => toast.error('删除端点失败'),
  });

  const testEndpointMutation = useMutation({
    mutationFn: (ep: { host: string; port: number; protocol: string; tlsCa?: string; tlsCert?: string; tlsKey?: string }) =>
      api.post('/api/containers/endpoints/test', ep),
    onSuccess: (res) => {
      const d = res.data.data;
      toast.success(d?.success ? '连接测试成功' : `连接失败: ${d?.message || '未知错误'}`);
    },
    onError: () => toast.error('测试请求失败'),
  });

  const refreshEndpointMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/containers/endpoints/${id}/refresh`),
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

  function withEndpointParams(params?: Record<string, unknown>): Record<string, unknown> {
    return endpointId !== 'local'
      ? { ...params, endpointId }
      : { ...params };
  }

  // ═══ LOGS / STATS / DETAIL QUERIES ════════════════════

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['container-logs', selectedContainerId],
    queryFn: async () => {
      const res = await api.get(`/api/containers/logs/${selectedContainerId}`, {
        params: withEndpointParams({ tail: 200 }),
      });
      return res.data.data as string;
    },
    enabled: showLogsDrawer && !!selectedContainerId,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['container-stats', selectedContainerId],
    queryFn: async () => {
      const res = await api.get(`/api/containers/stats/${selectedContainerId}`, {
        params: withEndpointParams(),
      });
      return res.data.data as Record<string, unknown>;
    },
    enabled: showStatsDrawer && !!selectedContainerId,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['container-detail', selectedContainerId],
    queryFn: async () => {
      const res = await api.get(`/api/containers/${selectedContainerId}`, {
        params: withEndpointParams(),
      });
      return res.data.data as Record<string, unknown>;
    },
    enabled: showDetailDrawer && !!selectedContainerId,
  });

  // ═══ NETWORK DETAIL QUERY ═════════════════════════════

  const { data: networkDetailData } = useQuery({
    queryKey: ['network-detail', netDetailData?.Id || netDetailData?.id],
    queryFn: async () => {
      const id = netDetailData?.Id || netDetailData?.id;
      const res = await api.get(`/api/containers/networks/${id}`, {
        params: withEndpointParams(),
      });
      return res.data.data as NetworkItem;
    },
    enabled: showNetDetailDrawer && !!(netDetailData?.Id || netDetailData?.id),
  });

  const displayNetDetail = networkDetailData || netDetailData;

  // ═══ RENDER ═══════════════════════════════════════════

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'containers', label: '容器', icon: <Box className="w-4 h-4" /> },
    { key: 'images', label: '镜像', icon: <Image className="w-4 h-4" /> },
    { key: 'volumes', label: '数据卷', icon: <HardDrive className="w-4 h-4" /> },
    { key: 'networks', label: '网络', icon: <Globe className="w-4 h-4" /> },
    { key: 'endpoints', label: '端点', icon: <Server className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* ── Endpoint Selector ── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-text-secondary" />
          <span className="text-sm text-text-secondary">Docker 主机:</span>
        </div>
        <select
          value={endpointId}
          onChange={(e) => {
            setEndpointId(e.target.value);
            setPage(1);
            setSearch('');
            setStatusFilter('');
          }}
          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-blue-500 min-w-[200px]"
        >
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.host}{h.id !== 'local' && h.port ? `:${h.port}` : ''}) — {h.status === 'active' ? '可用' : '不可用'}
            </option>
          ))}
        </select>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* CONTAINERS TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'containers' && (
        <>
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="搜索容器名/镜像..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-blue-500"
            >
              <option value="">全部状态</option>
              <option value="running">运行中</option>
              <option value="exited">已停止</option>
              <option value="paused">已暂停</option>
            </select>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: containersQueryKey })}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              创建容器
            </button>
          </div>

          {/* Error state */}
          {containersError && (
            <div className="flex flex-col items-center justify-center py-20">
              <Box className="w-16 h-16 text-text-tertiary mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">容器服务不可用</h3>
              <p className="text-text-secondary text-sm mb-6 text-center max-w-md">
                Docker 引擎连接失败，请检查 Docker 是否正在运行。
              </p>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: containersQueryKey })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" /> 重试
              </button>
            </div>
          )}

          {/* Loading / Table */}
          {!containersError && (
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">镜像</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">状态</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">端口</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">创建时间</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {containersLoading ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                    ) : containerData && containerData.data.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">暂无容器</td></tr>
                    ) : (
                      (containerData?.data || []).map((c) => {
                        const state = (c.State || c.state || '').toLowerCase();
                        const badge = statusBadge(state);
                        const ports = c.Ports?.filter((p) => p.PublicPort).map((p) => `${p.PublicPort}→${p.PrivatePort}`) || [];
                        return (
                          <tr key={c.id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-text-primary">{containerName(c)}</div>
                              <div className="text-xs text-text-tertiary font-mono">{c.id?.substring(0, 12)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-text-primary truncate max-w-[160px]">{c.Image || c.image || '-'}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                {state || 'unknown'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs text-text-secondary font-mono">
                                {ports.length > 0 ? ports.join(', ') : '-'}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                              <div className="text-xs text-text-secondary">{formatDate(c.Created || c.created)}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  onClick={() => containerActionMutation.mutate({ id: c.id, action: 'start' })}
                                  className="p-1.5 rounded hover:bg-green-500/10 text-text-secondary hover:text-green-400 transition-colors"
                                  title="启动"
                                ><Play className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => containerActionMutation.mutate({ id: c.id, action: 'stop' })}
                                  className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                                  title="停止"
                                ><Square className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => containerActionMutation.mutate({ id: c.id, action: 'restart' })}
                                  className="p-1.5 rounded hover:bg-yellow-500/10 text-text-secondary hover:text-yellow-400 transition-colors"
                                  title="重启"
                                ><RotateCcw className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => {
                                    setSelectedContainerId(c.id);
                                    setSelectedContainerName(containerName(c));
                                    setShowDetailDrawer(true);
                                  }}
                                  className="p-1.5 rounded hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors"
                                  title="详情"
                                ><Eye className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => {
                                    setSelectedContainerId(c.id);
                                    setSelectedContainerName(containerName(c));
                                    setShowLogsDrawer(true);
                                  }}
                                  className="p-1.5 rounded hover:bg-slate-500/10 text-text-secondary hover:text-slate-300 transition-colors"
                                  title="日志"
                                ><FileText className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => {
                                    setSelectedContainerId(c.id);
                                    setSelectedContainerName(containerName(c));
                                    setShowStatsDrawer(true);
                                  }}
                                  className="p-1.5 rounded hover:bg-purple-500/10 text-text-secondary hover:text-purple-400 transition-colors"
                                  title="状态"
                                ><Activity className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => { if (confirm(`确定要删除容器 ${containerName(c)} 吗？`)) deleteContainerMutation.mutate(c.id); }}
                                  className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                                  title="删除"
                                ><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {containerData && containerData.total > pageSize && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-text-tertiary">
                    共 {containerData.total} 个，第 {page} / {Math.ceil(containerData.total / pageSize)} 页
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                    ><ChevronLeft className="w-4 h-4" /></button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= Math.ceil((containerData?.total || 0) / pageSize)}
                      className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                    ><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* IMAGES TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'images' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: imagesQueryKey })}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> 刷新
            </button>
            <button
              onClick={() => setShowPullModal(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
            >
              <Download className="w-4 h-4" /> 拉取镜像
            </button>
          </div>

          {imagesError && (
            <div className="flex flex-col items-center justify-center py-20">
              <Image className="w-16 h-16 text-text-tertiary mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">镜像服务不可用</h3>
              <p className="text-text-secondary text-sm mb-4">Docker 引擎连接失败。</p>
              <button onClick={() => queryClient.invalidateQueries({ queryKey: imagesQueryKey })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> 重试
              </button>
            </div>
          )}

          {!imagesError && (
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">仓库</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">标签</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">镜像ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">大小</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden lg:table-cell">创建时间</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {imagesLoading ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                    ) : images.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">暂无镜像</td></tr>
                    ) : (
                      images.map((img) => (
                        <tr key={img.Id || img.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm text-text-primary truncate max-w-[200px]">{imageRepo(img)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">{imageTagOnly(img)}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs text-text-tertiary font-mono">{(img.Id || img.id || '').substring(0, 12)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                            <div className="text-sm text-text-secondary">{formatBytes(img.Size || 0)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                            <div className="text-xs text-text-secondary">{formatDate(img.Created)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <button
                              onClick={() => { if (confirm('确定要删除此镜像吗？')) deleteImageMutation.mutate(img.Id || img.id || ''); }}
                              className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                              title="删除"
                            ><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* VOLUMES TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'volumes' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: volumesQueryKey })}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> 刷新
            </button>
            <button
              onClick={() => setShowVolCreateModal(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> 创建数据卷
            </button>
          </div>

          {volumesError && (
            <div className="flex flex-col items-center justify-center py-20">
              <HardDrive className="w-16 h-16 text-text-tertiary mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">数据卷服务不可用</h3>
              <p className="text-text-secondary text-sm mb-4">Docker 引擎连接失败。</p>
              <button onClick={() => queryClient.invalidateQueries({ queryKey: volumesQueryKey })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> 重试
              </button>
            </div>
          )}

          {!volumesError && (
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">驱动</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">挂载点</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">创建时间</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {volumesLoading ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                    ) : volumes.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-text-tertiary">暂无数据卷</td></tr>
                    ) : (
                      volumes.map((v) => (
                        <tr key={v.Name || v.name} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-text-primary">{v.Name || v.name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-text-secondary">{v.Driver || v.driver || '-'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-text-tertiary font-mono truncate max-w-[260px]">{v.Mountpoint || v.mountpoint || '-'}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                            <div className="text-xs text-text-secondary">{formatDate(v.CreatedAt || v.createdAt)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <button
                              onClick={() => { if (confirm('确定要删除此数据卷吗？')) deleteVolumeMutation.mutate(v.Name || v.name || ''); }}
                              className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                              title="删除"
                            ><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* NETWORKS TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'networks' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: networksQueryKey })}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> 刷新
            </button>
            <button
              onClick={() => setShowNetCreateModal(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> 创建网络
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary text-sm">总网络数</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">{networks.length}</p>
                </div>
                <Globe className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-surface rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary text-sm">Bridge 网络</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {networks.filter((n) => (n.Driver || n.driver) === 'bridge').length}
                  </p>
                </div>
                <Globe className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-surface rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary text-sm">连接容器</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {networks.reduce((sum, n) => {
                      const containers = n.Containers || n.containers || {};
                      return sum + Object.keys(containers).length;
                    }, 0)}
                  </p>
                </div>
                <Box className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>

          {networksError && (
            <div className="flex flex-col items-center justify-center py-20">
              <Globe className="w-16 h-16 text-text-tertiary mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">网络服务不可用</h3>
              <p className="text-text-secondary text-sm mb-4">Docker 引擎连接失败。</p>
              <button onClick={() => queryClient.invalidateQueries({ queryKey: networksQueryKey })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> 重试
              </button>
            </div>
          )}

          {!networksError && (
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">驱动</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">范围</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">子网</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider hidden md:table-cell">网关</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">容器</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {networksLoading ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                    ) : networks.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-text-tertiary">暂无网络</td></tr>
                    ) : (
                      networks.map((net) => {
                        const containers = net.Containers || net.containers || {};
                        const containerCount = Object.keys(containers).length;
                        const ipam = net.IPAM;
                        const subnet = ipam?.Config?.[0]?.Subnet || '-';
                        const gateway = ipam?.Config?.[0]?.Gateway || '-';
                        return (
                          <tr key={net.Id || net.id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-text-primary">{net.Name || net.name}</div>
                              <div className="text-xs text-text-tertiary font-mono">{(net.Id || net.id || '').substring(0, 12)}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-text-primary">{net.Driver || net.driver}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-text-secondary">{net.Scope || net.scope}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                              <div className="text-xs text-text-secondary font-mono">{subnet}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                              <div className="text-xs text-text-secondary font-mono">{gateway}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-text-primary">{containerCount}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => { setNetDetailData(net); setShowNetDetailDrawer(true); }}
                                  className="p-1.5 rounded hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors"
                                  title="详情"
                                ><Eye className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => { if (confirm('确定要删除此网络吗？')) deleteNetworkMutation.mutate(net.Id || net.id || ''); }}
                                  className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                                  title="删除"
                                ><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ENDPOINTS TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'endpoints' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: endpointsListQueryKey });
                queryClient.invalidateQueries({ queryKey: endpointsQueryKey });
              }}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> 刷新
            </button>
            <button
              onClick={() => setShowEpCreateModal(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> 添加端点
            </button>
          </div>

          {endpointsError && (
            <div className="flex flex-col items-center justify-center py-20">
              <Server className="w-16 h-16 text-text-tertiary mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">端点服务不可用</h3>
              <p className="text-text-secondary text-sm mb-4">无法加载端点列表。</p>
              <button onClick={() => queryClient.invalidateQueries({ queryKey: endpointsListQueryKey })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> 重试
              </button>
            </div>
          )}

          {!endpointsError && (
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">主机</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">端口</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">协议</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">状态</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {endpointsLoading ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">加载中...</td></tr>
                    ) : endpoints.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-tertiary">暂无端点</td></tr>
                    ) : (
                      endpoints.map((ep) => {
                        const badge = statusBadge(ep.status);
                        return (
                          <tr key={ep.id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-text-primary">{ep.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-text-primary">{ep.host}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-text-secondary">{ep.port || '-'}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">{ep.protocol}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                {ep.status === 'active' ? '可用' : ep.status === 'error' ? '异常' : '不可用'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                {ep.id !== 'local' && (
                                  <button
                                    onClick={() => openEpEditModal(ep)}
                                    className="p-1.5 rounded hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors text-xs"
                                    title="编辑"
                                  ><Edit className="w-3.5 h-3.5" /></button>
                                )}
                                {ep.id !== 'local' && (
                                  <button
                                    onClick={() => refreshEndpointMutation.mutate(ep.id)}
                                    className="p-1.5 rounded hover:bg-green-500/10 text-text-secondary hover:text-green-400 transition-colors text-xs"
                                    title="刷新"
                                  ><RefreshCw className="w-3.5 h-3.5" /></button>
                                )}
                                {ep.id !== 'local' && (
                                  <button
                                    onClick={() => testEndpointMutation.mutate({ host: ep.host, port: ep.port, protocol: ep.protocol, tlsCa: ep.tlsCa, tlsCert: ep.tlsCert, tlsKey: ep.tlsKey })}
                                    className="p-1.5 rounded hover:bg-blue-500/10 text-text-secondary hover:text-blue-400 transition-colors text-xs"
                                    title="测试"
                                  ><Activity className="w-3.5 h-3.5" /></button>
                                )}
                                {ep.id !== 'local' && (
                                  <button
                                    onClick={() => { if (confirm('确定要删除此端点吗？')) deleteEndpointMutation.mutate(ep.id); }}
                                    className="p-1.5 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors"
                                    title="删除"
                                  ><Trash2 className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODALS & DRAWERS */}
      {/* ═══════════════════════════════════════════════════ */}

      {/* ── Create Container Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">创建容器</h3>
              <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">镜像 <span className="text-red-400">*</span></label>
                <input type="text" value={createImage} onChange={(e) => setCreateImage(e.target.value)} placeholder="nginx:latest" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">容器名称</label>
                <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="可选" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">端口映射</label>
                <input type="text" value={createPorts} onChange={(e) => setCreatePorts(e.target.value)} placeholder="8080:80,443:443" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                <p className="text-xs text-text-tertiary mt-1">格式: 宿主机端口:容器端口, 逗号分隔</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">环境变量</label>
                <input type="text" value={createEnv} onChange={(e) => setCreateEnv(e.target.value)} placeholder="KEY=VALUE,KEY2=VALUE2" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">数据卷挂载</label>
                <input type="text" value={createVolumes} onChange={(e) => setCreateVolumes(e.target.value)} placeholder="/host/path:/container/path" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">重启策略</label>
                  <select value={createRestart} onChange={(e) => setCreateRestart(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500 text-sm">
                    <option value="no">不重启</option>
                    <option value="always">总是重启</option>
                    <option value="on-failure">失败时重启</option>
                    <option value="unless-stopped">除非停止</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">内存限制 (MB)</label>
                  <input type="number" value={createMemory} onChange={(e) => setCreateMemory(e.target.value)} placeholder="不限制" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">CPU 权重</label>
                <input type="number" value={createCpuShares} onChange={(e) => setCreateCpuShares(e.target.value)} placeholder="默认 1024" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button onClick={() => createContainerMutation.mutate()} disabled={!createImage.trim() || createContainerMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {createContainerMutation.isPending ? '创建中...' : <><Plus className="w-4 h-4" /> 创建</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pull Image Modal ── */}
      {showPullModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowPullModal(false); setPullImageName(''); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">拉取镜像</h3>
              <button onClick={() => { setShowPullModal(false); setPullImageName(''); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">镜像名称 <span className="text-red-400">*</span></label>
                <input type="text" value={pullImageName} onChange={(e) => setPullImageName(e.target.value)} placeholder="nginx:latest" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowPullModal(false); setPullImageName(''); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button onClick={() => pullImageMutation.mutate()} disabled={!pullImageName.trim() || pullImageMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {pullImageMutation.isPending ? '拉取中...' : <><Download className="w-4 h-4" /> 拉取</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Volume Modal ── */}
      {showVolCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowVolCreateModal(false); setVolName(''); setVolDriver('local'); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">创建数据卷</h3>
              <button onClick={() => { setShowVolCreateModal(false); setVolName(''); setVolDriver('local'); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">名称 <span className="text-red-400">*</span></label>
                <input type="text" value={volName} onChange={(e) => setVolName(e.target.value)} placeholder="数据卷名称" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">驱动</label>
                <select value={volDriver} onChange={(e) => setVolDriver(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500 text-sm">
                  <option value="local">local</option>
                  <option value="nfs">nfs</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowVolCreateModal(false); setVolName(''); setVolDriver('local'); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button onClick={() => createVolumeMutation.mutate()} disabled={!volName.trim() || createVolumeMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {createVolumeMutation.isPending ? '创建中...' : <><Plus className="w-4 h-4" /> 创建</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Network Modal ── */}
      {showNetCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowNetCreateModal(false); resetNetForm(); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">创建网络</h3>
              <button onClick={() => { setShowNetCreateModal(false); resetNetForm(); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">名称 <span className="text-red-400">*</span></label>
                <input type="text" value={netName} onChange={(e) => setNetName(e.target.value)} placeholder="网络名称" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">驱动</label>
                <select value={netDriver} onChange={(e) => setNetDriver(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500 text-sm">
                  <option value="bridge">bridge</option>
                  <option value="host">host</option>
                  <option value="overlay">overlay</option>
                  <option value="macvlan">macvlan</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">子网</label>
                  <input type="text" value={netSubnet} onChange={(e) => setNetSubnet(e.target.value)} placeholder="172.20.0.0/16" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">网关</label>
                  <input type="text" value={netGateway} onChange={(e) => setNetGateway(e.target.value)} placeholder="172.20.0.1" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={netInternal} onChange={(e) => setNetInternal(e.target.checked)} className="rounded bg-background border-border" />
                  <span className="text-sm text-text-primary">内部网络</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={netAttachable} onChange={(e) => setNetAttachable(e.target.checked)} className="rounded bg-background border-border" />
                  <span className="text-sm text-text-primary">允许连接</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowNetCreateModal(false); resetNetForm(); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button onClick={() => createNetworkMutation.mutate()} disabled={!netName.trim() || createNetworkMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {createNetworkMutation.isPending ? '创建中...' : <><Plus className="w-4 h-4" /> 创建</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Endpoint Modal ── */}
      {showEpCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowEpCreateModal(false); resetEpForm(); }}>
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">{editingEpId ? '编辑 Docker 端点' : '添加 Docker 端点'}</h3>
              <button onClick={() => { setShowEpCreateModal(false); resetEpForm(); }} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">名称 <span className="text-red-400">*</span></label>
                <input type="text" value={epName} onChange={(e) => setEpName(e.target.value)} placeholder="生产服务器" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">主机 <span className="text-red-400">*</span></label>
                  <input type="text" value={epHost} onChange={(e) => setEpHost(e.target.value)}
                    disabled={!!editingEpId} placeholder="192.168.1.100"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">端口</label>
                  <input type="number" value={epPort} onChange={(e) => setEpPort(e.target.value)} placeholder="2375" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">协议</label>
                <select value={epProtocol} onChange={(e) => setEpProtocol(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500 text-sm">
                  <option value="socket">Socket</option>
                  <option value="tcp">TCP</option>
                  <option value="tcp+tls">TCP + TLS</option>
                </select>
              </div>
              {epProtocol === 'tcp+tls' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">TLS CA 证书</label>
                    <textarea value={epTlsCa} onChange={(e) => setEpTlsCa(e.target.value)} rows={3} placeholder="-----BEGIN CERTIFICATE-----" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">TLS 证书</label>
                    <textarea value={epTlsCert} onChange={(e) => setEpTlsCert(e.target.value)} rows={3} placeholder="-----BEGIN CERTIFICATE-----" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">TLS 密钥</label>
                    <textarea value={epTlsKey} onChange={(e) => setEpTlsKey(e.target.value)} rows={3} placeholder="-----BEGIN PRIVATE KEY-----" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500 text-sm font-mono" />
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setShowEpCreateModal(false); resetEpForm(); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-text-primary rounded-lg transition-colors text-sm">取消</button>
                <button
                  onClick={() => editingEpId ? updateEndpointMutation.mutate() : createEndpointMutation.mutate()}
                  disabled={!epName.trim() || (!editingEpId && !epHost.trim()) || createEndpointMutation.isPending || updateEndpointMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {editingEpId
                    ? (updateEndpointMutation.isPending ? '保存中...' : <><Edit className="w-4 h-4" /> 保存</>)
                    : (createEndpointMutation.isPending ? '添加中...' : <><Plus className="w-4 h-4" /> 添加</>)
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Container Logs Drawer ── */}
      {showLogsDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogsDrawer(false)} />
          <div className="relative ml-auto w-full max-w-2xl bg-surface border-l border-border h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold text-text-primary">容器日志: {selectedContainerName}</h3>
              </div>
              <button onClick={() => setShowLogsDrawer(false)} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {logsLoading ? (
                <div className="text-text-tertiary text-sm">加载中...</div>
              ) : (
                <pre className="text-xs font-mono text-green-400 bg-black/40 rounded-lg p-4 overflow-auto whitespace-pre-wrap max-h-full leading-relaxed">
                  {logsData || '暂无日志'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Container Stats Drawer ── */}
      {showStatsDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowStatsDrawer(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-surface border-l border-border h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold text-text-primary">容器状态: {selectedContainerName}</h3>
              </div>
              <button onClick={() => setShowStatsDrawer(false)} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {statsLoading ? (
                <div className="text-text-tertiary text-sm">加载中...</div>
              ) : statsData ? (
                <>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium text-text-secondary mb-3">CPU</h4>
                    {(() => {
                      const cpu = statsData?.cpu_stats as Record<string, unknown> | undefined;
                      const pre = statsData?.precpu_stats as Record<string, unknown> | undefined;
                      const cpuUsage = (cpu?.cpu_usage as Record<string, unknown> | undefined);
                      const preCpuUsage = (pre?.cpu_usage as Record<string, unknown> | undefined);
                      const sys = (cpu?.system_cpu_usage as number) || 0;
                      const preSys = (pre?.system_cpu_usage as number) || 0;
                      const usage = (cpuUsage?.total_usage as number) || 0;
                      const preUsage = (preCpuUsage?.total_usage as number) || 0;
                      const percpu = (cpuUsage?.percpu_usage as number[]) || [];
                      const online = (cpu?.online_cpus as number) || percpu.length || 1;
                      const delta = usage - preUsage;
                      const sysDelta = sys - preSys || delta;
                      const pct = sysDelta > 0 ? (delta / sysDelta * online * 100).toFixed(1) : '0.0';
                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-text-tertiary">使用率</span>
                            <span className="text-lg font-bold text-text-primary">{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium text-text-secondary mb-3">内存</h4>
                    {(() => {
                      const mem = statsData?.memory_stats as Record<string, unknown> | undefined;
                      const used = (mem?.usage as number) || 0;
                      const limit = (mem?.limit as number) || 1;
                      const pct = (used / limit * 100).toFixed(1);
                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-text-tertiary">使用 / 限制</span>
                            <span className="text-sm font-medium text-text-primary">{formatBytes(used)} / {formatBytes(limit)}</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-purple-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                          </div>
                          <div className="text-xs text-text-tertiary mt-1">{pct}%</div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium text-text-secondary mb-3">网络</h4>
                    {(() => {
                      const nets = statsData?.networks as Record<string, { rx_bytes: number; tx_bytes: number; rx_packets: number; tx_packets: number }> | undefined;
                      if (!nets) return <div className="text-xs text-text-tertiary">无网络数据</div>;
                      return Object.entries(nets).map(([name, data]) => (
                        <div key={name} className="mb-3 last:mb-0">
                          <span className="text-xs font-medium text-text-primary">{name}</span>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div className="text-xs"><span className="text-text-tertiary">RX: </span><span className="text-green-400">{formatBytes(data.rx_bytes)}</span></div>
                            <div className="text-xs"><span className="text-text-tertiary">TX: </span><span className="text-blue-400">{formatBytes(data.tx_bytes)}</span></div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              ) : (
                <div className="text-text-tertiary text-sm">暂无统计数据</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Container Detail Drawer ── */}
      {showDetailDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetailDrawer(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-surface border-l border-border h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold text-text-primary">容器详情: {selectedContainerName}</h3>
              </div>
              <button onClick={() => setShowDetailDrawer(false)} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {detailLoading ? (
                <div className="text-text-tertiary text-sm">加载中...</div>
              ) : detailData ? (
                <div className="space-y-3">
                  {[
                    ['名称', (detailData.Name as string) || selectedContainerName],
                    ['ID', (detailData.Id as string) || '-'],
                    ['状态', (() => { const s = (detailData.State as Record<string, unknown>)?.Status as string || ''; const b = statusBadge(s); return <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${b.bg} ${b.text}`}><span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />{s || 'unknown'}</span>; })() as ReactNode],
                    ['镜像', ((detailData.Config as Record<string, unknown>)?.Image as string) || '-'],
                    ['工作目录', ((detailData.Config as Record<string, unknown>)?.WorkingDir as string) || '-'],
                    ['命令', (((detailData.Config as Record<string, unknown>)?.Cmd as string[])?.join(' ')) || '-'],
                    ['创建时间', ((detailData.Created as string) ? new Date(detailData.Created as string).toLocaleString('zh-CN') : '-')],
                    ['平台', ((detailData.Platform as string) || (detailData.Os as string) ? `${detailData.Os || ''}/${detailData.Architecture || ''}` : '-')],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex">
                      <span className="text-xs text-text-tertiary w-20 flex-shrink-0">{label}</span>
                      <span className="text-sm text-text-primary break-all">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-tertiary text-sm">暂无详情数据</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Network Detail Drawer ── */}
      {showNetDetailDrawer && displayNetDetail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNetDetailDrawer(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-surface border-l border-border h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold text-text-primary">网络详情: {displayNetDetail.Name || displayNetDetail.name}</h3>
              </div>
              <button onClick={() => setShowNetDetailDrawer(false)} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-text-secondary mb-3">基本信息</h4>
                <div className="space-y-2">
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">名称</span><span className="text-sm text-text-primary">{displayNetDetail.Name || displayNetDetail.name || '-'}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">ID</span><span className="text-sm text-text-primary font-mono">{(displayNetDetail.Id || displayNetDetail.id || '').substring(0, 16)}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">驱动</span><span className="text-sm text-text-primary">{displayNetDetail.Driver || displayNetDetail.driver || '-'}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">范围</span><span className="text-sm text-text-primary">{displayNetDetail.Scope || displayNetDetail.scope || '-'}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">子网</span><span className="text-sm text-text-primary font-mono">{displayNetDetail.IPAM?.Config?.[0]?.Subnet || '-'}</span></div>
                  <div className="flex"><span className="text-xs text-text-tertiary w-16">网关</span><span className="text-sm text-text-primary font-mono">{displayNetDetail.IPAM?.Config?.[0]?.Gateway || '-'}</span></div>
                </div>
              </div>
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-text-secondary mb-3">连接容器</h4>
                {(() => {
                  const containers = displayNetDetail.Containers || displayNetDetail.containers || {};
                  const entries = Object.entries(containers);
                  if (entries.length === 0) return <p className="text-xs text-text-tertiary">暂无容器连接</p>;
                  return entries.map(([cid, info]) => (
                    <div key={cid} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-text-primary">{info.Name}</span>
                      <span className="text-xs text-text-tertiary font-mono">{info.IPv4Address || '-'}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}