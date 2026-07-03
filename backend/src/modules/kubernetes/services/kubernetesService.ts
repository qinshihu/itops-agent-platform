import { logger } from '../../../utils/logger';
import { k8sContextRepository } from '../../../repositories/k8sContextRepository';
import { randomUUID } from 'crypto';
import { getErrorMessage } from '../../../utils/errorHelpers';

let k8s: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  k8s = require('@kubernetes/client-node');
} catch {
  logger.warn('⚠️ @kubernetes/client-node not installed, K8s management disabled. Install with: npm install @kubernetes/client-node');
}

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

class KubernetesService {
  private clients: Map<string, { kc: any; coreApi: any; appsApi: any }> = new Map();
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
          this.contexts.set(row.id, this.rowToContext(row));
        } catch (err: unknown) {
          logger.error(`Failed to load K8s context ${row.name}:`, getErrorMessage(err));
        }
      }
      logger.info(`📋 Loaded ${this.clients.size} K8s cluster(s)`);
    } catch (err: unknown) {
      logger.error('Failed to load K8s contexts:', getErrorMessage(err));
    }
  }

  private rowToContext(row: any): K8sContext {
    return {
      id: row.id, name: row.name, clusterUrl: row.cluster_url,
      namespace: row.namespace, authType: row.auth_type, config: row.config,
      status: row.status, nodeCount: row.node_count, podCount: row.pod_count,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  getClient(contextId: string) {
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
      const nodes = await kc.makeApiClient(k8s.CoreV1Api).listNode().catch(() => ({ body: { items: [] } }));
      const pods = await kc.makeApiClient(k8s.CoreV1Api).listPodForAllNamespaces().catch(() => ({ body: { items: [] } }));
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
  async listNamespaces(contextId?: string): Promise<any[]> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await coreApi.listNamespace();
    return (res.body.items || []).map((ns: any) => ({
      name: ns.metadata?.name || '',
      status: ns.status?.phase || '',
      createdAt: ns.metadata?.creationTimestamp,
    }));
  }

  async listPods(namespace = 'default', contextId?: string): Promise<any[]> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await coreApi.listNamespacedPod(namespace);
    return (res.body.items || []).map((pod: any) => ({
      name: pod.metadata?.name || '',
      namespace: pod.metadata?.namespace || '',
      status: pod.status?.phase || 'Unknown',
      nodeName: pod.spec?.nodeName || '',
      podIP: pod.status?.podIP || '',
      containers: (pod.spec?.containers || []).map((c: any) => ({ name: c.name, image: c.image || '' })),
      containerStatuses: (pod.status?.containerStatuses || []).map((cs: any) => ({
        name: cs.name, ready: cs.ready, restartCount: cs.restartCount,
        state: cs.state ? Object.keys(cs.state)[0] : 'unknown',
      })),
      restartCount: (pod.status?.containerStatuses || []).reduce((sum: number, cs: any) => sum + cs.restartCount, 0),
      totalContainers: (pod.spec?.containers || []).length,
      readyContainers: (pod.status?.containerStatuses || []).filter((cs: any) => cs.ready).length,
      labels: pod.metadata?.labels || {},
      createdAt: pod.metadata?.creationTimestamp,
    }));
  }

  async listDeployments(namespace = 'default', contextId?: string): Promise<any[]> {
    const { appsApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await appsApi.listNamespacedDeployment(namespace);
    return (res.body.items || []).map((deploy: any) => ({
      name: deploy.metadata?.name || '',
      namespace: deploy.metadata?.namespace || '',
      replicas: deploy.spec?.replicas || 0,
      readyReplicas: deploy.status?.readyReplicas || 0,
      availableReplicas: deploy.status?.availableReplicas || 0,
      image: (deploy.spec?.template?.spec?.containers?.[0]?.image || '').split('/').pop() || '',
      strategy: deploy.spec?.strategy?.type || 'RollingUpdate',
      containers: (deploy.spec?.template?.spec?.containers || []).map((c: any) => ({ name: c.name, image: c.image || '' })),
      createdAt: deploy.metadata?.creationTimestamp,
    }));
  }

  async listServices(namespace = 'default', contextId?: string): Promise<any[]> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await coreApi.listNamespacedService(namespace);
    return (res.body.items || []).map((svc: any) => ({
      name: svc.metadata?.name || '',
      namespace: svc.metadata?.namespace || '',
      type: svc.spec?.type || 'ClusterIP',
      clusterIP: svc.spec?.clusterIP || '',
      ports: (svc.spec?.ports || []).map((p: any) => ({
        name: p.name || '', port: p.port, targetPort: p.targetPort,
        protocol: p.protocol || 'TCP', nodePort: p.nodePort,
      })),
      createdAt: svc.metadata?.creationTimestamp,
    }));
  }

  async listNodes(contextId?: string): Promise<any[]> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await coreApi.listNode();
    return (res.body.items || []).map((node: any) => ({
      name: node.metadata?.name || '',
      status: node.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
      roles: node.metadata?.labels?.['node-role.kubernetes.io/control-plane'] ? ['control-plane'] : ['worker'],
      version: node.status?.nodeInfo?.kubeletVersion || '',
      os: node.status?.nodeInfo?.osImage || '',
      cpu: node.status?.capacity?.cpu || '0',
      memory: node.status?.capacity?.memory || '0',
      createdAt: node.metadata?.creationTimestamp,
    }));
  }

  async getPod(namespace: string, name: string, contextId?: string): Promise<any> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const res = await coreApi.readNamespacedPod(name, namespace);
    const pod = res.body;
    return {
      name: pod.metadata?.name || '',
      namespace: pod.metadata?.namespace || '',
      status: pod.status?.phase || 'Unknown',
      podIP: pod.status?.podIP || '',
      hostIP: pod.status?.hostIP || '',
      containers: (pod.spec?.containers || []).map((c: any) => ({
        name: c.name, image: c.image || '',
        ports: c.ports || [], resources: c.resources || {},
      })),
      containerStatuses: pod.status?.containerStatuses || [],
      labels: pod.metadata?.labels || {},
      conditions: pod.status?.conditions || [],
      createdAt: pod.metadata?.creationTimestamp,
    };
  }

  async getPodLogs(namespace: string, name: string, tail = 100, contextId?: string): Promise<string> {
    const { kc } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const log = new k8s.Log(kc);
    return await log.log(namespace, name, 'all', { tailLines: tail, timestamps: false });
  }

  async deletePod(namespace: string, name: string, contextId?: string): Promise<void> {
    const { coreApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    await coreApi.deleteNamespacedPod(name, namespace);
    logger.info(`Deleted pod ${namespace}/${name}`);
  }

  async scaleDeployment(namespace: string, name: string, replicas: number, contextId?: string): Promise<void> {
    const { appsApi } = this.getClient(contextId || this.contexts.keys().next().value || '');
    const patch = [{ op: 'replace', path: '/spec/replicas', value: replicas }];
    await appsApi.patchNamespacedDeploymentScale(name, namespace, patch, undefined, undefined, undefined, undefined, {
      headers: { 'Content-Type': 'application/json-patch+json' },
    });
    logger.info(`Scaled deployment ${namespace}/${name} to ${replicas}`);
  }
}

export const kubernetesService = new KubernetesService();
