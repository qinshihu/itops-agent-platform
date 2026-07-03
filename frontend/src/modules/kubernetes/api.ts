/**
 * Kubernetes 模块 API 服务层
 * 封装集群上下文、命名空间、Pod、Deployment、Service、Node 相关端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

// ── 集群上下文 ──

export interface K8sContext {
  id: string;
  name: string;
  server?: string;
  cluster?: string;
  created_at?: string;
}

export interface ImportContextInput {
  config: string;
}

export interface TestContextResult {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

// ── 资源查询参数 ──

export interface K8sResourceParams {
  context?: string;
  namespace?: string;
}

// ── 命名空间 ──

export interface Namespace {
  name: string;
  status: string;
}

// ── Pod ──

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

export interface PodLogsParams {
  context?: string;
  tail?: number;
}

export interface PodLogsResult {
  logs?: string;
  [key: string]: unknown;
}

// ── Deployment ──

export interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  image: string;
  creationTimestamp: string;
}

export interface ScaleDeploymentInput {
  replicas: number;
}

// ── Service ──

export interface Service {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string;
  ports: string;
}

// ── Node ──

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

// ── 概览 ──

export interface K8sOverview {
  nodes: number;
  pods: number;
  services: number;
  deployments: number;
}

// ============================================================
// kubernetesApi 对象
// ============================================================

export const kubernetesApi = {
  // ── 集群上下文 ──

  /** 获取集群上下文列表 */
  async listContexts(): Promise<K8sContext[]> {
    const { data } = await api.get('/api/kubernetes/contexts');
    return data.data || [];
  },

  /** 导入集群上下文 */
  async importContext(input: ImportContextInput): Promise<K8sContext> {
    const { data } = await api.post('/api/kubernetes/contexts', input);
    return data;
  },

  /** 测试 kubeconfig 连接 */
  async testContext(input: ImportContextInput): Promise<TestContextResult> {
    const { data } = await api.post('/api/kubernetes/contexts/test', input);
    return data.data;
  },

  /** 删除集群上下文 */
  async deleteContext(id: string): Promise<void> {
    await api.delete(`/api/kubernetes/contexts/${id}`);
  },

  // ── 命名空间 ──

  /** 获取命名空间列表 */
  async listNamespaces(params?: K8sResourceParams): Promise<Namespace[]> {
    const { data } = await api.get('/api/kubernetes/namespaces', { params });
    return data.data || [];
  },

  // ── Pod ──

  /** 获取 Pod 列表 */
  async listPods(params?: K8sResourceParams): Promise<Pod[]> {
    const { data } = await api.get('/api/kubernetes/pods', { params });
    return data.data || [];
  },

  /** 获取 Pod 详情 */
  async getPodDetail(namespace: string, name: string, params?: K8sResourceParams): Promise<PodDetail> {
    const { data } = await api.get(`/api/kubernetes/pods/${namespace}/${name}`, { params });
    return data.data;
  },

  /** 获取 Pod 日志 */
  async getPodLogs(namespace: string, name: string, params?: PodLogsParams): Promise<string> {
    const { data } = await api.get(`/api/kubernetes/pods/${namespace}/${name}/logs`, { params });
    return data.data?.logs || data.data || data;
  },

  /** 删除 Pod */
  async deletePod(namespace: string, name: string, params?: K8sResourceParams): Promise<void> {
    await api.delete(`/api/kubernetes/pods/${namespace}/${name}`, { params });
  },

  // ── Deployment ──

  /** 获取 Deployment 列表 */
  async listDeployments(params?: K8sResourceParams): Promise<Deployment[]> {
    const { data } = await api.get('/api/kubernetes/deployments', { params });
    return data.data || [];
  },

  /** 扩缩容 Deployment */
  async scaleDeployment(namespace: string, name: string, input: ScaleDeploymentInput, params?: K8sResourceParams): Promise<void> {
    await api.put(`/api/kubernetes/deployments/${namespace}/${name}/scale`, input, { params });
  },

  // ── Service ──

  /** 获取 Service 列表 */
  async listServices(params?: K8sResourceParams): Promise<Service[]> {
    const { data } = await api.get('/api/kubernetes/services', { params });
    return data.data || [];
  },

  // ── Node ──

  /** 获取 Node 列表 */
  async listNodes(params?: K8sResourceParams): Promise<NodeInfo[]> {
    const { data } = await api.get('/api/kubernetes/nodes', { params });
    return data.data || [];
  },
};

export default kubernetesApi;
