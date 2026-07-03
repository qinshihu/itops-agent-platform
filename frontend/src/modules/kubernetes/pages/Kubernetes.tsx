/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server, Box, Globe, HardDrive, Container, Cpu,
  FileText, Eye, Trash2, Plus, Minus, RefreshCw,
  Search, AlertCircle, X, Wifi, Upload,
  ChevronDown, Activity
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import PodList from './k8s/PodList';
import ServiceList from './k8s/ServiceList';
import NodeList from './k8s/NodeList';

// ==================== 类型定义 ====================
export interface K8sContext {
  id: string;
  name: string;
  server?: string;
  cluster?: string;
  created_at?: string;
}

export interface Namespace {
  name: string;
  status: string;
}

export interface Pod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  ip: string;
  node: string;
  creationTimestamp: string;
}

export interface PodDetail {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  conditions: Array<{ type: string; status: string; reason?: string; message?: string }>;
  containers: Array<{ name: string; image: string; ports: string[]; resources: Record<string, string> }>;
}

interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  image: string;
  creationTimestamp: string;
}

export interface Service {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string;
  ports: string;
}

export interface NodeInfo {
  name: string;
  status: string;
  cpuAllocated: number;
  cpuTotal: number;
  memoryAllocated: number;
  memoryTotal: number;
  podsCount: number;
  podsMax: number;
  kubeletVersion: string;
}

// ==================== 状态着色 ====================
export const podStatusColors: Record<string, string> = {
  Running: 'text-green-400 bg-green-500/15', Pending: 'text-yellow-400 bg-yellow-500/15',
  Failed: 'text-red-400 bg-red-500/15', Succeeded: 'text-blue-400 bg-blue-500/15',
  Unknown: 'text-text-tertiary bg-surface', Terminating: 'text-purple-400 bg-purple-500/15',
  CrashLoopBackOff: 'text-red-400 bg-red-500/15', ContainerCreating: 'text-cyan-400 bg-cyan-500/15',
};

export const serviceTypeColors: Record<string, string> = {
  ClusterIP: 'text-blue-400 bg-blue-500/15', NodePort: 'text-green-400 bg-green-500/15',
  LoadBalancer: 'text-purple-400 bg-purple-500/15', ExternalName: 'text-cyan-400 bg-cyan-500/15',
};

export const nodeStatusColors: Record<string, string> = {
  Ready: 'text-green-400 bg-green-500/15', NotReady: 'text-red-400 bg-red-500/15',
  Unknown: 'text-yellow-400 bg-yellow-500/15',
};

export function formatAge(ts: string): string {
  if (!ts) return '-';
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ==================== 主组件 ====================
export default function Kubernetes() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // 选中的上下文和命名空间
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pods' | 'deployments' | 'services' | 'nodes'>('pods');

  // 导入/测试 Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [kubeconfigContent, setKubeconfigContent] = useState('');
  const [testingConfig, setTestingConfig] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 删除确认
  const [deletePodTarget, setDeletePodTarget] = useState<Pod | null>(null);
  const [deleteContextTarget, setDeleteContextTarget] = useState<K8sContext | null>(null);

  // 扩缩容
  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleTarget, setScaleTarget] = useState<Deployment | null>(null);
  const [scaleReplicas, setScaleReplicas] = useState(1);

  // 搜索
  const [searchText, setSearchText] = useState('');

  // ==================== 获取集群上下文 ====================
  const {
    data: contexts = [],
    isLoading: contextsLoading,
  } = useQuery({
    queryKey: ['kubernetes-contexts'],
    queryFn: async () => {
      const res = await api.get('/api/kubernetes/contexts');
      return (res.data.data || []) as K8sContext[];
    },
  });

  const hasContexts = contexts.length > 0;

  // 自动选择第一个上下文
  const effectiveContext = selectedContext || (contexts.length > 0 ? contexts[0].id : '');

  // ==================== 获取命名空间 ====================
  const { data: namespaces = [], isLoading: namespacesLoading } = useQuery({
    queryKey: ['kubernetes-namespaces', effectiveContext],
    queryFn: async () => {
      if (!effectiveContext) return [];
      const res = await api.get('/api/kubernetes/namespaces', {
        params: { context: effectiveContext },
      });
      return (res.data.data || []) as Namespace[];
    },
    enabled: !!effectiveContext,
  });

  // 自动选择第一个命名空间
  const effectiveNamespace = namespace || (namespaces.length > 0 ? namespaces[0].name : '');

  // ==================== 概览数据 ====================
  const { data: overview } = useQuery({
    queryKey: ['kubernetes-overview', effectiveContext, effectiveNamespace],
    queryFn: async () => {
      if (!effectiveContext) return { nodes: 0, pods: 0, services: 0, deployments: 0 };
      const [nodesRes, podsRes, servicesRes, deploymentsRes] = await Promise.all([
        api.get('/api/kubernetes/nodes', { params: { context: effectiveContext } }),
        api.get('/api/kubernetes/pods', { params: { namespace: effectiveNamespace || undefined, context: effectiveContext } }),
        api.get('/api/kubernetes/services', { params: { namespace: effectiveNamespace || undefined, context: effectiveContext } }),
        api.get('/api/kubernetes/deployments', { params: { namespace: effectiveNamespace || undefined, context: effectiveContext } }),
      ]);
      return {
        nodes: (nodesRes.data.data || []).length,
        pods: (podsRes.data.data || []).length,
        services: (servicesRes.data.data || []).length,
        deployments: (deploymentsRes.data.data || []).length,
      };
    },
    enabled: !!effectiveContext,
    placeholderData: { nodes: 0, pods: 0, services: 0, deployments: 0 },
  });

  // ==================== Pods ====================
  const {
    data: pods = [],
    isLoading: podsLoading,
    isError: podsError,
    refetch: refetchPods,
  } = useQuery({
    queryKey: ['kubernetes-pods', effectiveContext, effectiveNamespace],
    queryFn: async () => {
      if (!effectiveContext) return [];
      const res = await api.get('/api/kubernetes/pods', {
        params: { namespace: effectiveNamespace || undefined, context: effectiveContext },
      });
      return (res.data.data || []) as Pod[];
    },
    enabled: !!effectiveContext,
  });

  // ==================== Deployments ====================
  const {
    data: deployments = [],
    isLoading: deploymentsLoading,
    isError: deploymentsError,
    refetch: refetchDeployments,
  } = useQuery({
    queryKey: ['kubernetes-deployments', effectiveContext, effectiveNamespace],
    queryFn: async () => {
      if (!effectiveContext) return [];
      const res = await api.get('/api/kubernetes/deployments', {
        params: { namespace: effectiveNamespace || undefined, context: effectiveContext },
      });
      return (res.data.data || []) as Deployment[];
    },
    enabled: !!effectiveContext,
  });

  // ==================== Services ====================
  const {
    data: services = [],
    isLoading: servicesLoading,
    isError: servicesError,
    refetch: refetchServices,
  } = useQuery({
    queryKey: ['kubernetes-services', effectiveContext, effectiveNamespace],
    queryFn: async () => {
      if (!effectiveContext) return [];
      const res = await api.get('/api/kubernetes/services', {
        params: { namespace: effectiveNamespace || undefined, context: effectiveContext },
      });
      return (res.data.data || []) as Service[];
    },
    enabled: !!effectiveContext,
  });

  // ==================== Nodes ====================
  const {
    data: nodes = [],
    isLoading: nodesLoading,
    isError: nodesError,
    refetch: refetchNodes,
  } = useQuery({
    queryKey: ['kubernetes-nodes', effectiveContext],
    queryFn: async () => {
      if (!effectiveContext) return [];
      const res = await api.get('/api/kubernetes/nodes', {
        params: { context: effectiveContext },
      });
      return (res.data.data || []) as NodeInfo[];
    },
    enabled: !!effectiveContext,
  });

  // ==================== 导入 kubeconfig ====================
  const importMutation = useMutation({
    mutationFn: async (config: string) => {
      const res = await api.post('/api/kubernetes/contexts', { config });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kubernetes-contexts'] });
      setImportModalOpen(false);
      setKubeconfigContent('');
      setTestResult(null);
      toast.success('集群已导入');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || '导入集群失败');
    },
  });

  // 测试 kubeconfig 连接
  const testConfig = useCallback(async () => {
    if (!kubeconfigContent.trim()) {
      toast.warning('请先输入 kubeconfig 内容');
      return;
    }
    setTestingConfig(true);
    setTestResult(null);
    try {
      const res = await api.post('/api/kubernetes/contexts/test', { config: kubeconfigContent });
      setTestResult({
        success: res.data.data?.success ?? false,
        message: res.data.data?.message || (res.data.data?.success ? '连接成功' : '连接失败'),
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || '测试连接失败',
      });
    } finally {
      setTestingConfig(false);
    }
  }, [kubeconfigContent, toast]);

  // ==================== 删除集群 ====================
  const deleteContextMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/kubernetes/contexts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kubernetes-contexts'] });
      if (selectedContext === deleteContextTarget?.id) {
        setSelectedContext('');
      }
      setDeleteContextTarget(null);
      toast.success('集群已删除');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || '删除集群失败');
    },
  });

  // ==================== 删除 Pod ====================
  const deletePodMutation = useMutation({
    mutationFn: async (pod: Pod) => {
      await api.delete(`/api/kubernetes/pods/${pod.namespace}/${pod.name}`, {
        params: { context: effectiveContext },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kubernetes-pods'] });
      queryClient.invalidateQueries({ queryKey: ['kubernetes-overview'] });
      setDeletePodTarget(null);
      toast.success('Pod 已删除');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || '删除 Pod 失败');
    },
  });

  // ==================== 扩缩容 ====================
  const scaleMutation = useMutation({
    mutationFn: async ({ dep, replicas }: { dep: Deployment; replicas: number }) => {
      await api.put(
        `/api/kubernetes/deployments/${dep.namespace}/${dep.name}/scale`,
        { replicas },
        { params: { context: effectiveContext } },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kubernetes-deployments'] });
      setScaleOpen(false);
      setScaleTarget(null);
      toast.success('扩缩容成功');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || '扩缩容失败');
    },
  });

  // ==================== 重启 Deployment ====================
  const restartMutation = useMutation({
    mutationFn: async (dep: Deployment) => {
      await api.put(
        `/api/kubernetes/deployments/${dep.namespace}/${dep.name}/scale`,
        { replicas: 0 },
        { params: { context: effectiveContext } },
      );
      setTimeout(async () => {
        await api.put(
          `/api/kubernetes/deployments/${dep.namespace}/${dep.name}/scale`,
          { replicas: dep.replicas },
          { params: { context: effectiveContext } },
        );
        queryClient.invalidateQueries({ queryKey: ['kubernetes-deployments'] });
      }, 2000);
    },
    onSuccess: () => {
      toast.success('重启指令已下发');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || '重启失败');
    },
  });

  // ==================== 刷新当前 Tab ====================
  const refreshCurrentTab = useCallback(() => {
    switch (activeTab) {
      case 'pods': refetchPods(); break;
      case 'deployments': refetchDeployments(); break;
      case 'services': refetchServices(); break;
      case 'nodes': refetchNodes(); break;
    }
  }, [activeTab, refetchPods, refetchDeployments, refetchServices, refetchNodes]);

  // ==================== 通用组件 ====================
  const filteredDeployments = deployments.filter(d =>
    !searchText || d.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const Spinner = () => (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  );

  const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertCircle size={36} className="text-red-400" />
      <p className="text-text-secondary text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        <RefreshCw size={14} /> 重试
      </button>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <Box size={36} className="text-text-tertiary" />
      <p className="text-text-tertiary text-sm">{message}</p>
    </div>
  );

  const TabButton = ({ tab, label }: { tab: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={clsx(
        'px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
        activeTab === tab
          ? 'bg-primary text-white shadow-lg shadow-primary/20'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface',
      )}
    >
      {label}
    </button>
  );

  // ==================== K8s 不可用状态 ====================
  if (!contextsLoading && !hasContexts) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-2xl bg-status-warning/10 flex items-center justify-center">
          <Wifi size={36} className="text-yellow-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-2">K8s 集群不可用</h2>
          <p className="text-text-secondary">请导入 kubeconfig 配置以连接 K8s 集群</p>
        </div>
        <button
          onClick={() => setImportModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-primary/25"
        >
          <Upload size={16} /> 导入集群
        </button>
        {/* 导入集群 Modal */}
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setImportModalOpen(false); setTestResult(null); setKubeconfigContent(''); }} />
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-fade-in">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h3 className="text-lg font-semibold text-text-primary">导入集群</h3>
                <button
                  onClick={() => { setImportModalOpen(false); setTestResult(null); setKubeconfigContent(''); }}
                  className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Kubeconfig 内容</label>
                  <textarea
                    value={kubeconfigContent}
                    onChange={(e) => { setKubeconfigContent(e.target.value); setTestResult(null); }}
                    placeholder="粘贴 kubeconfig YAML 内容到此处..."
                    rows={12}
                    className="w-full bg-[#0d1117] border border-border text-green-300 font-mono text-sm rounded-xl p-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none scrollbar-thin"
                  />
                </div>

                {testResult && (
                  <div className={clsx(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
                    testResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20',
                  )}>
                    {testResult.success ? (
                      <Activity size={16} className="text-green-400" />
                    ) : (
                      <AlertCircle size={16} className="text-red-400" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-5 border-t border-border">
                <button
                  onClick={testConfig}
                  disabled={testingConfig || !kubeconfigContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors disabled:opacity-50"
                >
                  {testingConfig ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border border-text-tertiary border-t-transparent" />
                  ) : (
                    <Wifi size={14} />
                  )}
                  测试连接
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setImportModalOpen(false); setTestResult(null); setKubeconfigContent(''); }}
                    className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => importMutation.mutate(kubeconfigContent)}
                    disabled={importMutation.isPending || !kubeconfigContent.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {importMutation.isPending ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    ) : (
                      <Upload size={14} />
                    )}
                    确认导入
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== 集群加载中 ====================
  if (contextsLoading) {
    return (
      <div className="p-6">
        <Spinner />
      </div>
    );
  }

  // ==================== 主渲染 ====================
  return (
    <div className="p-6 space-y-5">
      {/* 页面标题行 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Container size={26} className="text-primary" />
          <h1 className="text-xl font-bold text-text-primary">K8s 资源管理</h1>
        </div>
        <button
          onClick={refreshCurrentTab}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-surface hover:bg-border/50 rounded-lg transition-colors border border-border"
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {/* 集群上下文管理 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-text-secondary text-sm shrink-0">集群：</span>

          {/* 上下文下拉 */}
          <div className="relative">
            <select
              value={effectiveContext}
              onChange={(e) => {
                setSelectedContext(e.target.value);
                setNamespace('');
              }}
              className="appearance-none bg-surface border border-border text-text-primary text-sm rounded-lg px-3 py-2 pr-8 min-w-[200px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              {contexts.map(ctx => (
                <option key={ctx.id} value={ctx.id}>{ctx.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>

          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            <Upload size={14} /> 导入集群
          </button>

          <button
            onClick={() => { queryClient.invalidateQueries({ queryKey: ['kubernetes-contexts'] }); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-surface hover:bg-border/50 rounded-lg transition-colors border border-border"
          >
            <RefreshCw size={14} /> 刷新集群
          </button>

          {contexts.length > 0 && (
            <button
              onClick={() => {
                const ctx = contexts.find(c => c.id === effectiveContext);
                if (ctx) setDeleteContextTarget(ctx);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors ml-auto"
            >
              <Trash2 size={14} /> 删除当前集群
            </button>
          )}
        </div>
      </div>

      {/* 命名空间选择器 + 概览卡片 */}
      <div className="space-y-4">
        {/* 命名空间 */}
        <div className="flex items-center gap-3">
          <span className="text-text-secondary text-sm shrink-0">命名空间：</span>
          <div className="relative">
            <select
              value={effectiveNamespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="appearance-none bg-surface border border-border text-text-primary text-sm rounded-lg px-3 py-2 pr-8 min-w-[220px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              {namespacesLoading ? (
                <option>加载中...</option>
              ) : namespaces.length === 0 ? (
                <option value="">无命名空间</option>
              ) : (
                <>
                  <option value="">全部命名空间</option>
                  {namespaces.map(ns => (
                    <option key={ns.name} value={ns.name}>{ns.name}</option>
                  ))}
                </>
              )}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>
        </div>

        {/* 概览卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Server size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-text-tertiary text-xs">节点数</p>
              <p className="text-xl font-bold text-text-primary">{overview?.nodes ?? 0}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
              <Box size={20} className="text-green-400" />
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Pods 总数</p>
              <p className="text-xl font-bold text-text-primary">{overview?.pods ?? 0}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
              <Globe size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Services</p>
              <p className="text-xl font-bold text-text-primary">{overview?.services ?? 0}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
              <HardDrive size={20} className="text-orange-400" />
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Deployments</p>
              <p className="text-xl font-bold text-text-primary">{overview?.deployments ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 标签栏 + 搜索 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 pt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1">
            <TabButton tab="pods" label="Pods" />
            <TabButton tab="deployments" label="Deployments" />
            <TabButton tab="services" label="Services" />
            <TabButton tab="nodes" label="节点" />
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="bg-surface border border-border text-text-primary text-sm rounded-lg pl-9 pr-3 py-2 w-56 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Pods Tab */}
        {activeTab === 'pods' && (
          <PodList
            pods={pods}
            loading={podsLoading}
            error={podsError}
            onRetry={() => refetchPods()}
            context={effectiveContext}
            searchText={searchText}
            onDeletePod={setDeletePodTarget}
          />
        )}

        {/* Deployments Tab */}
        {activeTab === 'deployments' && (
          <div className="p-4">
            {deploymentsLoading ? (
              <Spinner />
            ) : deploymentsError ? (
              <ErrorState message="获取 Deployments 失败" onRetry={() => refetchDeployments()} />
            ) : filteredDeployments.length === 0 ? (
              <EmptyState message={searchText ? '无匹配的 Deployment' : '暂无 Deployment 数据'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-tertiary">
                      <th className="text-left py-3 px-3 font-medium">名称</th>
                      <th className="text-left py-3 px-3 font-medium">命名空间</th>
                      <th className="text-left py-3 px-3 font-medium">副本数</th>
                      <th className="text-left py-3 px-3 font-medium">镜像</th>
                      <th className="text-left py-3 px-3 font-medium">Age</th>
                      <th className="text-right py-3 px-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeployments.map(dep => (
                      <tr key={`${dep.namespace}/${dep.name}`} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                        <td className="py-2.5 px-3 text-text-primary font-medium max-w-[200px] truncate">{dep.name}</td>
                        <td className="py-2.5 px-3 text-text-secondary">{dep.namespace}</td>
                        <td className="py-2.5 px-3">
                          <span className={clsx(
                            'font-medium',
                            dep.availableReplicas < dep.replicas ? 'text-yellow-400' : 'text-green-400',
                          )}>
                            {dep.availableReplicas} / {dep.replicas}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary font-mono text-xs max-w-[280px] truncate">{dep.image}</td>
                        <td className="py-2.5 px-3 text-text-secondary">{formatAge(dep.creationTimestamp)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setScaleTarget(dep); setScaleReplicas(dep.replicas); setScaleOpen(true); }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-status-warning bg-surface hover:bg-status-warning/10 rounded transition-colors border border-border"
                            >
                              <Plus size={12} /> 扩缩容
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`确定要重启 Deployment "${dep.name}" 吗？`)) {
                                  restartMutation.mutate(dep);
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary bg-surface hover:bg-primary/10 rounded transition-colors border border-border"
                            >
                              <RefreshCw size={12} /> 重启
                            </button>
                            <button
                              onClick={() => { /* detail drawer would go here */ toast.info('Deployment 详情功能开发中'); }}
                              className="p-1.5 text-text-tertiary hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                              title="详情"
                            >
                              <Eye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <ServiceList
            services={services}
            loading={servicesLoading}
            error={servicesError}
            onRetry={() => refetchServices()}
            searchText={searchText}
          />
        )}

        {/* Nodes Tab */}
        {activeTab === 'nodes' && (
          <NodeList
            nodes={nodes}
            loading={nodesLoading}
            error={nodesError}
            onRetry={() => refetchNodes()}
            searchText={searchText}
          />
        )}
      </div>

      {/* ==================== 导入集群 Modal ==================== */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setImportModalOpen(false); setTestResult(null); setKubeconfigContent(''); }} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">导入集群</h3>
              <button
                onClick={() => { setImportModalOpen(false); setTestResult(null); setKubeconfigContent(''); }}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Kubeconfig 内容</label>
                <textarea
                  value={kubeconfigContent}
                  onChange={(e) => { setKubeconfigContent(e.target.value); setTestResult(null); }}
                  placeholder="粘贴 kubeconfig YAML 内容到此处..."
                  rows={12}
                  className="w-full bg-[#0d1117] border border-border text-green-300 font-mono text-sm rounded-xl p-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none scrollbar-thin"
                />
              </div>

              {testResult && (
                <div className={clsx(
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
                  testResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20',
                )}>
                  {testResult.success ? (
                    <Activity size={16} className="text-green-400" />
                  ) : (
                    <AlertCircle size={16} className="text-red-400" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-5 border-t border-border">
              <button
                onClick={testConfig}
                disabled={testingConfig || !kubeconfigContent.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors disabled:opacity-50"
              >
                {testingConfig ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border border-text-tertiary border-t-transparent" />
                ) : (
                  <Wifi size={14} />
                )}
                测试连接
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setImportModalOpen(false); setTestResult(null); setKubeconfigContent(''); }}
                  className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => importMutation.mutate(kubeconfigContent)}
                  disabled={importMutation.isPending || !kubeconfigContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {importMutation.isPending ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <Upload size={14} />
                  )}
                  确认导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 扩缩容 Modal ==================== */}
      {scaleOpen && scaleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setScaleOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">扩缩容</h3>
              <button
                onClick={() => setScaleOpen(false)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Deployment</span>
                <span className="text-text-primary font-medium">{scaleTarget.namespace}/{scaleTarget.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">当前副本数</span>
                <span className="text-text-primary font-medium">{scaleTarget.replicas}</span>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">目标副本数</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScaleReplicas(Math.max(1, scaleReplicas - 1))}
                    className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={scaleReplicas}
                    onChange={(e) => setScaleReplicas(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center bg-surface border border-border text-text-primary text-sm rounded-lg py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => setScaleReplicas(Math.min(100, scaleReplicas + 1))}
                    className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
              <button
                onClick={() => setScaleOpen(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => scaleMutation.mutate({ dep: scaleTarget, replicas: scaleReplicas })}
                disabled={scaleMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                {scaleMutation.isPending ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                ) : null}
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 删除 Pod 确认 ==================== */}
      {deletePodTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletePodTarget(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">确认删除 Pod</h3>
                  <p className="text-text-secondary text-sm mt-0.5">此操作不可恢复</p>
                </div>
              </div>
              <p className="text-text-secondary text-sm">
                确定要删除 Pod <span className="text-text-primary font-medium">"{deletePodTarget.name}"</span> 吗？
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
              <button
                onClick={() => setDeletePodTarget(null)}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => deletePodMutation.mutate(deletePodTarget)}
                disabled={deletePodMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletePodMutation.isPending ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                ) : (
                  <Trash2 size={14} />
                )}
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 删除集群确认 ==================== */}
      {deleteContextTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteContextTarget(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">确认删除集群</h3>
                  <p className="text-text-secondary text-sm mt-0.5">此操作不可恢复</p>
                </div>
              </div>
              <p className="text-text-secondary text-sm">
                确定要删除集群 <span className="text-text-primary font-medium">"{deleteContextTarget.name}"</span> 吗？
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
              <button
                onClick={() => setDeleteContextTarget(null)}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => deleteContextMutation.mutate(deleteContextTarget.id)}
                disabled={deleteContextMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleteContextMutation.isPending ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                ) : (
                  <Trash2 size={14} />
                )}
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


