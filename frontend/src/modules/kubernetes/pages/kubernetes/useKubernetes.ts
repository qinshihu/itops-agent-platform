import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { useToast } from '../../../../contexts/ToastContext';
import type { K8sContext, Namespace, Pod, Deployment, Service, NodeInfo } from './types';

export function useKubernetes() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedContext, setSelectedContext] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pods' | 'deployments' | 'services' | 'nodes'>('pods');

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [kubeconfigContent, setKubeconfigContent] = useState('');
  const [testingConfig, setTestingConfig] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [deletePodTarget, setDeletePodTarget] = useState<Pod | null>(null);
  const [deleteContextTarget, setDeleteContextTarget] = useState<K8sContext | null>(null);

  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleTarget, setScaleTarget] = useState<Deployment | null>(null);
  const [scaleReplicas, setScaleReplicas] = useState(1);

  const [searchText, setSearchText] = useState('');

  // ==================== 获取集群上下文 ====================
  const {
    data: contexts = [],
    isLoading: contextsLoading,
  } = useQuery({
    queryKey: ['kubernetes-contexts'],
    queryFn: async () => {
      const res = await api.get('/kubernetes/contexts');
      return (res.data.data || []) as K8sContext[];
    },
  });

  const hasContexts = contexts.length > 0;
  const effectiveContext = selectedContext || (contexts.length > 0 ? contexts[0].id : '');

  // ==================== 获取命名空间 ====================
  const { data: namespaces = [], isLoading: namespacesLoading } = useQuery({
    queryKey: ['kubernetes-namespaces', effectiveContext],
    queryFn: async () => {
      if (!effectiveContext) return [];
      const res = await api.get('/kubernetes/namespaces', {
        params: { context: effectiveContext },
      });
      return (res.data.data || []) as Namespace[];
    },
    enabled: !!effectiveContext,
  });

  const effectiveNamespace = namespace || (namespaces.length > 0 ? namespaces[0].name : '');

  // ==================== 概览数据 ====================
  const { data: overview } = useQuery({
    queryKey: ['kubernetes-overview', effectiveContext, effectiveNamespace],
    queryFn: async () => {
      if (!effectiveContext) return { nodes: 0, pods: 0, services: 0, deployments: 0 };
      const [nodesRes, podsRes, servicesRes, deploymentsRes] = await Promise.all([
        api.get('/kubernetes/nodes', { params: { context: effectiveContext } }),
        api.get('/kubernetes/pods', { params: { namespace: effectiveNamespace || undefined, context: effectiveContext } }),
        api.get('/kubernetes/services', { params: { namespace: effectiveNamespace || undefined, context: effectiveContext } }),
        api.get('/kubernetes/deployments', { params: { namespace: effectiveNamespace || undefined, context: effectiveContext } }),
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
      const res = await api.get('/kubernetes/pods', {
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
      const res = await api.get('/kubernetes/deployments', {
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
      const res = await api.get('/kubernetes/services', {
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
      const res = await api.get('/kubernetes/nodes', {
        params: { context: effectiveContext },
      });
      return (res.data.data || []) as NodeInfo[];
    },
    enabled: !!effectiveContext,
  });

  // ==================== 导入 kubeconfig ====================
  const importMutation = useMutation({
    mutationFn: async (config: string) => {
      const res = await api.post('/kubernetes/contexts', { config });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kubernetes-contexts'] });
      setImportModalOpen(false);
      setKubeconfigContent('');
      setTestResult(null);
      toast.success('集群已导入');
    },
    onError: () => {
      toast.error('导入集群失败');
    },
  });

  const testConfig = useCallback(async () => {
    if (!kubeconfigContent.trim()) {
      toast.warning('请先输入 kubeconfig 内容');
      return;
    }
    setTestingConfig(true);
    setTestResult(null);
    try {
      const res = await api.post('/kubernetes/contexts/test', { config: kubeconfigContent });
      setTestResult({
        success: res.data.data?.success ?? false,
        message: res.data.data?.message || (res.data.data?.success ? '连接成功' : '连接失败'),
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setTestResult({
        success: false,
        message: e.response?.data?.error || e.response?.data?.message || '测试连接失败',
      });
    } finally {
      setTestingConfig(false);
    }
  }, [kubeconfigContent, toast]);

  // ==================== 删除集群 ====================
  const deleteContextMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/kubernetes/contexts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kubernetes-contexts'] });
      if (selectedContext === deleteContextTarget?.id) {
        setSelectedContext('');
      }
      setDeleteContextTarget(null);
      toast.success('集群已删除');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      toast.error(e.response?.data?.error || e.response?.data?.message || '删除集群失败');
    },
  });

  // ==================== 删除 Pod ====================
  const deletePodMutation = useMutation({
    mutationFn: async (pod: Pod) => {
      await api.delete(`/kubernetes/pods/${pod.namespace}/${pod.name}`, {
        params: { context: effectiveContext },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kubernetes-pods'] });
      queryClient.invalidateQueries({ queryKey: ['kubernetes-overview'] });
      setDeletePodTarget(null);
      toast.success('Pod 已删除');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      toast.error(e.response?.data?.error || e.response?.data?.message || '删除 Pod 失败');
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
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      toast.error(e.response?.data?.error || e.response?.data?.message || '扩缩容失败');
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
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      toast.error(e.response?.data?.error || e.response?.data?.message || '重启失败');
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

  const filteredDeployments = deployments.filter(d =>
    !searchText || d.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleCloseImport = () => {
    setImportModalOpen(false);
    setTestResult(null);
    setKubeconfigContent('');
  };

  const handleKubeconfigChange = (val: string) => {
    setKubeconfigContent(val);
    setTestResult(null);
  };

  const handleContextChange = (ctxId: string) => {
    setSelectedContext(ctxId);
    setNamespace('');
  };

  const handleScaleOpen = (dep: Deployment) => {
    setScaleTarget(dep);
    setScaleReplicas(dep.replicas);
    setScaleOpen(true);
  };

  return {
    // state
    selectedContext, effectiveContext,
    namespace, setNamespace, effectiveNamespace,
    activeTab, setActiveTab,
    importModalOpen, setImportModalOpen,
    kubeconfigContent,
    testingConfig,
    testResult,
    deletePodTarget, setDeletePodTarget,
    deleteContextTarget, setDeleteContextTarget,
    scaleOpen, setScaleOpen,
    scaleTarget,
    scaleReplicas, setScaleReplicas,
    searchText, setSearchText,
    // data
    contexts, contextsLoading, hasContexts,
    namespaces, namespacesLoading,
    overview,
    pods, podsLoading, podsError,
    deployments, deploymentsLoading, deploymentsError,
    services, servicesLoading, servicesError,
    nodes, nodesLoading, nodesError,
    filteredDeployments,
    // refetch
    refetchPods, refetchDeployments, refetchServices, refetchNodes,
    refreshCurrentTab,
    // mutations
    importMutation, deleteContextMutation,
    deletePodMutation, scaleMutation, restartMutation,
    // handlers
    testConfig,
    handleCloseImport,
    handleKubeconfigChange,
    handleContextChange,
    handleScaleOpen,
  };
}