/**
 * Kubernetes 类工具（2026-07-21 拆分）
 * - k8s-list-pods
 * - k8s-list-nodes
 * - k8s-list-services
 * - k8s-list-namespaces
 *
 * 字段大小写严格对齐 kubernetesService.ts 的类型定义（小写驼峰）
 */
import { kubernetesService } from '../../../../kubernetes/services/kubernetesService';
import { agentToolRegistry } from '../agentToolRegistry';

export function registerK8sTools(): void {
  // 21. K8s Pod 列表
  agentToolRegistry.register({
    id: 'k8s-list-pods',
    name: 'K8s Pod 列表',
    description: '列出 Kubernetes Pod',
    category: 'kubernetes',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', description: '命名空间（默认 default）', default: 'default' },
        contextId: { type: 'string', description: 'K8s Context ID（可选）' },
      },
    },
    execute: async (args) => {
      const namespace = (args.namespace as string) || 'default';
      const contextId = args.contextId as string | undefined;
      try {
        const pods = await kubernetesService.listPods(namespace, contextId);
        return `K8s Pod 列表 (命名空间 ${namespace}, 共${pods.length}个):\n${
          pods.map((p) => `• ${p.name} status=${p.status} node=${p.nodeName ?? '-'}`).join('\n')
        }`;
      } catch (error) {
        return `获取 K8s Pod 列表失败: ${(error as Error).message}`;
      }
    },
  });

  // 22. K8s Node 列表
  agentToolRegistry.register({
    id: 'k8s-list-nodes',
    name: 'K8s Node 列表',
    description: '列出 Kubernetes Node 节点',
    category: 'kubernetes',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {
        contextId: { type: 'string', description: 'K8s Context ID（可选）' },
      },
    },
    execute: async (args) => {
      const contextId = args.contextId as string | undefined;
      try {
        const nodes = await kubernetesService.listNodes(contextId);
        return `K8s Node 列表 (共${nodes.length}个):\n${
          nodes.map((n) => `• ${n.name} status=${n.status}`).join('\n')
        }`;
      } catch (error) {
        return `获取 K8s Node 列表失败: ${(error as Error).message}`;
      }
    },
  });

  // 23. K8s Service 列表
  agentToolRegistry.register({
    id: 'k8s-list-services',
    name: 'K8s Service 列表',
    description: '列出 Kubernetes Service',
    category: 'kubernetes',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {
        contextId: { type: 'string', description: 'K8s Context ID（可选）' },
        namespace: { type: 'string', description: '命名空间', default: 'default' },
      },
    },
    execute: async (args) => {
      const contextId = args.contextId as string | undefined;
      const namespace = (args.namespace as string) || 'default';
      try {
        const services = await kubernetesService.listServices(namespace, contextId);
        return `K8s Service 列表 (命名空间 ${namespace}, 共${services.length}个):\n${
          services.map((s) => `• ${s.name} type=${s.type} clusterIP=${s.clusterIP}`).join('\n')
        }`;
      } catch (error) {
        return `获取 K8s Service 列表失败: ${(error as Error).message}`;
      }
    },
  });

  // 24. K8s Namespace 列表
  agentToolRegistry.register({
    id: 'k8s-list-namespaces',
    name: 'K8s Namespace 列表',
    description: '列出 Kubernetes Namespace',
    category: 'kubernetes',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {
        contextId: { type: 'string', description: 'K8s Context ID（可选）' },
      },
    },
    execute: async (args) => {
      const contextId = args.contextId as string | undefined;
      try {
        const namespaces = await kubernetesService.listNamespaces(contextId);
        return `K8s Namespace 列表 (共${namespaces.length}个):\n${
          namespaces.map((ns) => `• ${ns.name} status=${ns.status}`).join('\n')
        }`;
      } catch (error) {
        return `获取 K8s Namespace 列表失败: ${(error as Error).message}`;
      }
    },
  });
}