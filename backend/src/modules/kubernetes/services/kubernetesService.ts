import { logger } from '../../../utils/logger';
import { k8sContextRepository } from '../../../repositories/k8sContextRepository';
import { randomUUID } from 'crypto';
import { getErrorMessage } from '../../../utils/errorHelpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let k8s: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  k8s = require('@kubernetes/client-node');
} catch {
  logger.warn('⚠️ @kubernetes/client-node not installed, K8s management disabled. Install with: npm install @kubernetes/client-node');
}

// ── 本地类型定义 ──

interface K8sContext {
  id: string;
  name: string;
  clusterUrl: string;
  namespace: string;
  authType: string;
  config: string;
  status: string;
  nodeCount: number;
  podCount: number;
  createdAt: string;
  updatedAt: string;
}

interface K8sContextRow {
  id: string;
  name: string;
  cluster_url: string | null;
  namespace: string;
  auth_type: string;
  config: string;
  status: string;
  node_count: number;
  pod_count: number;
  created_at: string;
  updated_at: string;
}

/** K8s API 响应中的通用资源对象（允许深层属性访问） */
type K8sResource = Record<string, unknown>;

interface K8sClientBundle {
  kc: K8sResource;
  coreApi: K8sResource;
  appsApi: K8sResource;
}

interface K8sNamespaceInfo {
  name: string;
  status: string;
  createdAt: string;
}

interface K8sPodInfo {
  name: string;
  namespace: string;
  status: string;
  nodeName: string;
  podIP: string;
  containers: { name: string; image: string }[];
  containerStatuses: { name: string; ready: unknown; restartCount: unknown; state: string }[];
  restartCount: number;
  totalContainers: number;
  readyContainers: number;
  labels: Record<string, string>;
  createdAt: string;
}

interface K8sDeploymentInfo {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  image: string;
  strategy: string;
  containers: K8sResource[];
  createdAt: string;
}

interface K8sServiceInfo {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: { name: string; port: unknown; targetPort: unknown; protocol: string; nodePort: unknown }[];
  createdAt: string;
}

interface K8sNodeInfo {
  name: string;
  status: string;
  roles: string[];
  version: string;
  os: string;
  cpu: string;
  memory: string;
  createdAt: string;
}

interface K8sPodDetail {
  name: string;
  namespace: string;
  status: string;
  podIP: string;
  hostIP: string;
  containers: unknown[];
  containerStatuses: unknown;
  labels: Record<string, string>;
  conditions: unknown;
  createdAt: string;
}

class KubernetesService {
  private clients: Map<string, K8sClientBundle> = new Map();
  private contexts: Map<string, K8sContext> = new Map();
  private available = false;

  constructor() {
    if (!k8s) {
      this.available = false;
      return;
    }
    this.available = true;
    // 表结构由 migration v047 维护；本服务的运行时上下文加载由 initialize() 负责。
  }

  /**
   * 启动时加载已激活的 K8s 集群上下文
   * （原 ensureTables() 的运行时部分，schema 已下沉到 migration v047）
   */
  initialize() {
    this.loadContexts();
  }

  private loadContexts() {
    try {
      const rows = k8sContextRepository.listActive();
      for (const row of rows) {
        try {
          const kc = new k8s.KubeConfig();
          kc.loadFromString(row.config);
          this.clients.set(row.id, {
            kc,
            coreApi: kc.makeApiClient(k8s.CoreV1Api),
            appsApi: kc.makeApiClient(k8s.AppsV1Api),
          });
          this.contexts.set(row.id, {
            id: row.id, name: row.name, clusterUrl: row.cluster_url || '',
            namespace: row.namespace, authType: row.auth_type, config: row.config || '',
            status: row.status, nodeCount: row.node_count, podCount: row.pod_count,
            createdAt: row.created_at, updatedAt: row.updated_at,
          });
        } catch (err: unknown) {
          logger.error(`Failed to load K8s context ${row.name}:`, getErrorMessage(err));
        }
      }
      logger.info(`📋 Loaded ${this.clients.size} K8s cluster(s)`);
    } catch (err: unknown) {
      logger.error('Failed to load K8s contexts:', getErrorMessage(err));
    }
  }

  private rowToContext(row: K8sContextRow): K8sContext {
    return {
      id: row.id, name: row.name, clusterUrl: row.cluster_url || '',
      namespace: row.namespace, authType: row.auth_type, config: row.config || '',
      status: row.status, nodeCount: row.node_count, podCount: row.pod_count,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  getClient(contextId: string): K8sClientBundle {
    const client = this.clients.get(contextId);
    if (!client) throw Object.assign(new Error(`K8s 集群未连接: ${contextId}`), { statusCode: 503 });
    return client;
  }

  isAvailable(): boolean {
    return this.available && this.clients.size > 0;
  }

  // ── 集群管理 ──
  listContexts(): K8sContext[] {
    return Array.from(this.contexts.values());
  }

  async addContext(configContent: string): Promise<K8sContext> {
    if (!k8s) throw new Error('@kubernetes/client-node 未安装');

    // 解析 kubeconfig 获取集群信息
    const kc = new k8s.KubeConfig();
    kc.loadFromString(configContent);

    const contextName = kc.getCurrentContext();
    const cluster = kc.getCurrentCluster();
    const _user = kc.getCurrentUser();

    const id = randomUUID();
    const now = new Date().toISOString();
    const name = contextName || `k8s-${id.substring(0, 8)}`;
    const clusterUrl = cluster?.server || '';

    k8sContextRepository.insert({
      id, name, cluster_url: clusterUrl, namespace: 'default',
      auth_type: 'kubeconfig', config: configContent, created_at: now, updated_at: now,
    });

    // 立即加载客户端
    try {
      this.clients.set(id, {
        kc,
        coreApi: kc.makeApiClient(k8s.CoreV1Api),
        appsApi: kc.makeApiClient(k8s.AppsV1Api),
      });

      // 更新集群信息
      const nodes = await kc.makeApiClient(k8s.CoreV1Api).listNode().catch((err: unknown) => {
        logger.warn('Failed to list K8s nodes:', getErrorMessage(err));
        return { body: { items: [] } };
      });
      const pods = await kc.makeApiClient(k8s.CoreV1Api).listPodForAllNamespaces().catch((err: unknown) => {
        logger.warn('Failed to list K8s pods:', getErrorMessage(err));
        return { body: { items: [] } };
      });
      k8sContextRepository.updateCounts(id, nodes.body.items.length, pods.body.items.length);

      const ctx: K8sContext = {
        id, name, clusterUrl, namespace: 'default', authType: 'kubeconfig',
        config: configContent, status: 'active',
        nodeCount: nodes.body.items.length, podCount: pods.body.items.length,
        createdAt: now, updatedAt: now,
      };
      this.contexts.set(id, ctx);
      logger.info(`✅ K8s cluster connected: ${name} (${clusterUrl})`);
      return ctx;
    } catch (err: unknown) {
      k8sContextRepository.updateStatus(id, 'error');
      throw new Error(`连接集群失败: ${getErrorMessage(err)}`);
    }
  }

  async deleteContext(contextId: string): Promise<void> {
    this.clients.delete(contextId);
    this.contexts.delete(contextId);
    k8sContextRepository.deleteById(contextId);
  }

  async testContext(configContent: string): Promise<{ success: boolean; message: string }> {
    if (!k8s) return { success: false, message: '@kubernetes/client-node 未安装' };
    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromString(configContent);
      const api = kc.makeApiClient(k8s.CoreV1Api);
      const res = await api.listNode();
      const cluster = kc.getCurrentCluster();
      return { success: true, message: `${cluster?.server || 'Unknown'}, ${res.body.items.length} nodes` };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err) };
    }
  }

  // ── 核心 API ──
  async listNamespaces(contextId?: string): Promise<K8sNamespaceInfo[]> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await (coreApi as Record<string, (...args: unknown[]) => unknown>).listNamespace() as { body: { items: K8sResource[] } };
    return (res.body.items || []).map((ns: K8sResource) => ({
      name: (ns.metadata as K8sResource)?.name as string || '',
      status: (ns.status as K8sResource)?.phase as string || '',
      createdAt: (ns.metadata as K8sResource)?.creationTimestamp as string,
    }));
  }

  async listPods(namespace = 'default', contextId?: string): Promise<K8sPodInfo[]> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await (coreApi as Record<string, (...args: unknown[]) => unknown>).listNamespacedPod(namespace) as { body: { items: K8sResource[] } };
    return (res.body.items || []).map((pod: K8sResource) => ({
      name: (pod.metadata as K8sResource)?.name as string || '',
      namespace: (pod.metadata as K8sResource)?.namespace as string || '',
      status: (pod.status as K8sResource)?.phase as string || 'Unknown',
      nodeName: (pod.spec as K8sResource)?.nodeName as string || '',
      podIP: (pod.status as K8sResource)?.podIP as string || '',
      containers: ((pod.spec as K8sResource)?.containers as K8sResource[] || []).map((c: K8sResource) => ({ name: c.name as string, image: (c.image as string) || '' })),
      containerStatuses: ((pod.status as K8sResource)?.containerStatuses as K8sResource[] || []).map((cs: K8sResource) => ({
        name: cs.name as string, ready: cs.ready, restartCount: cs.restartCount,
        state: cs.state ? Object.keys(cs.state as object)[0] : 'unknown',
      })),
      restartCount: ((pod.status as K8sResource)?.containerStatuses as K8sResource[] || []).reduce((sum: number, cs: K8sResource) => sum + (cs.restartCount as number), 0),
      totalContainers: ((pod.spec as K8sResource)?.containers as K8sResource[] || []).length,
      readyContainers: ((pod.status as K8sResource)?.containerStatuses as K8sResource[] || []).filter((cs: K8sResource) => cs.ready).length,
      labels: ((pod.metadata as K8sResource)?.labels as Record<string, string>) || {},
      createdAt: (pod.metadata as K8sResource)?.creationTimestamp as string,
    }));
  }

  async listDeployments(namespace = 'default', contextId?: string): Promise<K8sDeploymentInfo[]> {
    const { appsApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await (appsApi as Record<string, (...args: unknown[]) => unknown>).listNamespacedDeployment(namespace) as { body: { items: K8sResource[] } };
    return (res.body.items || []).map((deploy: K8sResource) => ({
      name: (deploy.metadata as K8sResource)?.name as string || '',
      namespace: (deploy.metadata as K8sResource)?.namespace as string || '',
      replicas: (deploy.spec as K8sResource)?.replicas as number || 0,
      readyReplicas: (deploy.status as K8sResource)?.readyReplicas as number || 0,
      availableReplicas: (deploy.status as K8sResource)?.availableReplicas as number || 0,
      image: (((((deploy.spec as K8sResource)?.template as K8sResource)?.spec as K8sResource)?.containers as K8sResource[] | undefined)?.[0]?.image as string) || '',
      strategy: ((deploy.spec as K8sResource)?.strategy as K8sResource)?.type as string || 'RollingUpdate',
      containers: (((deploy.spec as K8sResource)?.template as K8sResource)?.spec as K8sResource)?.containers as K8sResource[] || [],
      createdAt: (deploy.metadata as K8sResource)?.creationTimestamp as string,
    }));
  }

  async listServices(namespace = 'default', contextId?: string): Promise<K8sServiceInfo[]> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await (coreApi as Record<string, (...args: unknown[]) => unknown>).listNamespacedService(namespace) as { body: { items: K8sResource[] } };
    return (res.body.items || []).map((svc: K8sResource) => ({
      name: (svc.metadata as K8sResource)?.name as string || '',
      namespace: (svc.metadata as K8sResource)?.namespace as string || '',
      type: (svc.spec as K8sResource)?.type as string || 'ClusterIP',
      clusterIP: (svc.spec as K8sResource)?.clusterIP as string || '',
      ports: ((svc.spec as K8sResource)?.ports as K8sResource[] || []).map((p: K8sResource) => ({
        name: (p.name as string) || '', port: p.port, targetPort: p.targetPort,
        protocol: (p.protocol as string) || 'TCP', nodePort: p.nodePort,
      })),
      createdAt: (svc.metadata as K8sResource)?.creationTimestamp as string,
    }));
  }

  async listNodes(contextId?: string): Promise<K8sNodeInfo[]> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await (coreApi as Record<string, (...args: unknown[]) => unknown>).listNode() as { body: { items: K8sResource[] } };
    return (res.body.items || []).map((node: K8sResource) => ({
      name: (node.metadata as K8sResource)?.name as string || '',
      status: ((node.status as K8sResource)?.conditions as K8sResource[])?.find((c: K8sResource) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
      roles: ((node.metadata as K8sResource)?.labels as Record<string, string> | undefined)?.['node-role.kubernetes.io/control-plane'] ? ['control-plane'] : ['worker'],
      version: ((node.status as K8sResource)?.nodeInfo as K8sResource)?.kubeletVersion as string || '',
      os: ((node.status as K8sResource)?.nodeInfo as K8sResource)?.osImage as string || '',
      cpu: ((node.status as K8sResource)?.capacity as K8sResource)?.cpu as string || '0',
      memory: ((node.status as K8sResource)?.capacity as K8sResource)?.memory as string || '0',
      createdAt: (node.metadata as K8sResource)?.creationTimestamp as string,
    }));
  }

  async getPod(namespace: string, name: string, contextId?: string): Promise<K8sPodDetail> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await (coreApi as Record<string, (...args: unknown[]) => unknown>).readNamespacedPod(name, namespace) as { body: K8sResource };
    const pod = res.body as K8sResource;
    return {
      name: (pod.metadata as K8sResource)?.name as string || '',
      namespace: (pod.metadata as K8sResource)?.namespace as string || '',
      status: (pod.status as K8sResource)?.phase as string || 'Unknown',
      podIP: (pod.status as K8sResource)?.podIP as string || '',
      hostIP: (pod.status as K8sResource)?.hostIP as string || '',
      containers: ((pod.spec as K8sResource)?.containers as K8sResource[] || []).map((c: K8sResource) => ({
        name: c.name, image: (c.image as string) || '',
        ports: c.ports || [], resources: c.resources || {},
      })),
      containerStatuses: (pod.status as K8sResource)?.containerStatuses || [],
      labels: ((pod.metadata as K8sResource)?.labels as Record<string, string>) || {},
      conditions: (pod.status as K8sResource)?.conditions || [],
      createdAt: (pod.metadata as K8sResource)?.creationTimestamp as string,
    };
  }

  async getPodLogs(namespace: string, name: string, tail = 100, contextId?: string): Promise<string> {
    const { kc } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const log = new k8s.Log(kc);
    return await log.log(namespace, name, 'all', { tailLines: tail, timestamps: false });
  }

  async deletePod(namespace: string, name: string, contextId?: string): Promise<void> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    await (coreApi as Record<string, (...args: unknown[]) => unknown>).deleteNamespacedPod(name, namespace);
    logger.info(`Deleted pod ${namespace}/${name}`);
  }

  async scaleDeployment(namespace: string, name: string, replicas: number, contextId?: string): Promise<void> {
    const { appsApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const patch = [{ op: 'replace', path: '/spec/replicas', value: replicas }];
    await (appsApi as Record<string, (...args: unknown[]) => unknown>).patchNamespacedDeploymentScale(name, namespace, patch, undefined, undefined, undefined, undefined, {
      headers: { 'Content-Type': 'application/json-patch+json' },
    });
    logger.info(`Scaled deployment ${namespace}/${name} to ${replicas}`);
  }

  /**
   * 获取 deployment 的副本数（spec.replicas）
   */
  async getDeploymentReplicas(namespace: string, name: string, contextId?: string): Promise<number> {
    const { appsApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await (appsApi as Record<string, (...args: unknown[]) => unknown>).readNamespacedDeploymentScale(name, namespace) as { body: K8sResource };
    return Number((res.body.spec as K8sResource)?.replicas || 0);
  }

  /**
   * 获取 deployment 的实时指标（来自 metrics-server）
   *
   * 注意：需要集群已安装 metrics-server
   *   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   *
   * 返回 { cpu, memory } 单位：
   *   - cpu:    millicores (1 core = 1000 millicores)
   *   - memory: MiB
   *
   * 当 metrics-server 不可用时返回 null
   */
  async getDeploymentMetrics(
    namespace: string,
    name: string,
    contextId?: string
  ): Promise<{ cpu: number; memory: number } | null> {
    try {
      const client = this.getClient(contextId || this.contexts.keys().next().value || '');
      // metrics.k8s.io/v1beta1 → CustomObjects API
      // Path: /apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods?labelSelector=...
      // 简化做法：列出该 namespace 下属于该 deployment 的所有 Pod，再汇总它们的指标
      const labelSelector = `app=${name}`; // 常见默认标签
      const customObjectsApi = (client as unknown as { customObjectsApi: Record<string, (...args: unknown[]) => unknown> }).customObjectsApi;

      // 获取 deployment 的 selector 匹配标签（更精确）
      let podSelector = labelSelector;
      try {
        const { appsApi } = client;
        const deployRes = await (appsApi as Record<string, (...args: unknown[]) => unknown>).readNamespacedDeployment(name, namespace) as { body: K8sResource };
        const selector = (deployRes.body.spec as K8sResource)?.selector as K8sResource | undefined;
        const matchLabels = selector?.matchLabels as K8sResource | undefined;
        if (matchLabels) {
          podSelector = Object.entries(matchLabels)
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        }
      } catch {
        // 退回到默认 labelSelector
      }

      const metricsRes = await customObjectsApi.listNamespacedCustomObject(
        'metrics.k8s.io',
        'v1beta1',
        namespace,
        'pods',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { labelSelector: podSelector }
      ) as { body: { items: K8sResource[] } };

      let totalCpuMilli = 0;
      let totalMemoryMi = 0;
      for (const pod of metricsRes.body?.items || []) {
        const containers = ((pod.containers as K8sResource[]) || []);
        for (const c of containers) {
          const usage = (c.usage as K8sResource) || {};
          const cpuStr = (usage.cpu as string) || '0'; // "120m" / "1" / "0.5"
          const memStr = (usage.memory as string) || '0'; // "128Mi" / "1Gi"

          // 解析 cpu（millicores）
          if (cpuStr.endsWith('n')) {
            totalCpuMilli += parseInt(cpuStr) / 1_000_000; // nanocores → millicores
          } else if (cpuStr.endsWith('m')) {
            totalCpuMilli += parseInt(cpuStr);
          } else {
            totalCpuMilli += parseFloat(cpuStr) * 1000;
          }

          // 解析 memory（→ MiB）
          if (memStr.endsWith('Ki')) {
            totalMemoryMi += parseInt(memStr) / 1024;
          } else if (memStr.endsWith('Mi')) {
            totalMemoryMi += parseInt(memStr);
          } else if (memStr.endsWith('Gi')) {
            totalMemoryMi += parseInt(memStr) * 1024;
          } else if (memStr.endsWith('Ti')) {
            totalMemoryMi += parseInt(memStr) * 1024 * 1024;
          } else {
            // 假设是 bytes
            totalMemoryMi += parseInt(memStr) / (1024 * 1024);
          }
        }
      }

      return { cpu: Math.round(totalCpuMilli), memory: Math.round(totalMemoryMi) };
    } catch (err) {
      // metrics-server 未安装/不可用时静默返回 null
      logger.debug(`getDeploymentMetrics(${namespace}/${name}) failed:`, err instanceof Error ? err.message : err);
      return null;
    }
  }
}

export const kubernetesService = new KubernetesService();