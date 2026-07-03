import { z } from 'zod';
import { type RegisteredTool } from '../types';
import { textResult, jsonResult, READONLY } from './shared';
import { dockerService } from '../../../modules/containers/services/dockerService';

export const containerTools: RegisteredTool[] = [
  {
    name: 'container.list',
    title: '查询容器列表',
    description: '查询 Docker 容器列表，包含运行状态、镜像、端口映射、资源使用。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      hostId: z.string().optional().describe('Docker 主机 ID'),
      status: z.enum(['running', 'stopped', 'paused']).optional().describe('容器状态'),
      limit: z.number().min(1).max(100).default(50).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../models/database');
        let query = 'SELECT * FROM containers WHERE 1=1';
        const params: any[] = [];
        if (args.hostId) { query += ' AND docker_host_id = ?'; params.push(args.hostId); }
        if (args.status) { query += ' AND status = ?'; params.push(args.status); }
        query += ` LIMIT ${args.limit || 50}`;
        const containers = db.prepare(query).all(...params);
        return jsonResult(containers, `找到 ${(containers as any[])?.length || 0} 个容器`);
      } catch (err) {
        return textResult(`查询容器失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'vm.list',
    title: '查询虚拟机列表',
    description: '查询虚拟机列表，包含 CPU、内存、磁盘、状态、所属宿主机。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      status: z.enum(['running', 'stopped', 'paused', 'unknown']).optional().describe('VM 状态'),
      hostId: z.string().optional().describe('宿主机 ID'),
      limit: z.number().min(1).max(100).default(50).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { default: db } = await import('../../../models/database');
        let query = 'SELECT * FROM virtual_machines WHERE 1=1';
        const params: unknown[] = [];
        if (args.status) { query += ' AND status = ?'; params.push(args.status); }
        if (args.hostId) { query += ' AND host_id = ?'; params.push(args.hostId); }
        query += ` LIMIT ${args.limit || 50}`;
        const vms = db.prepare(query).all(...params);
        return jsonResult(vms, `找到 ${vms.length} 台虚拟机`);
      } catch (err) {
        return textResult(`查询虚拟机失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'k8s.cluster.summary',
    title: '查询 K8s 集群摘要',
    description: '查询 Kubernetes 集群摘要信息，包含节点数、Pod 数、命名空间数、资源使用率。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      clusterId: z.string().optional().describe('集群 ID（不传则返回所有集群）'),
    }),
    handler: async (args) => {
      try {
        const { kubernetesService } = await import(
          '../../../modules/kubernetes/services/kubernetesService'
        );
        const summary = await (kubernetesService as any).getClusterSummary?.(args.clusterId);
        return jsonResult(summary || { message: 'K8s 集群数据正在同步中' }, 'K8s 集群摘要');
      } catch (err) {
        return textResult(`查询 K8s 集群失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'k8s.pod.list',
    title: '查询 K8s Pod 列表',
    description: '查询 Kubernetes Pod 列表，包含状态、重启次数、资源使用。支持按命名空间和工作负载过滤。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      clusterId: z.string().optional().describe('集群 ID'),
      namespace: z.string().optional().describe('命名空间'),
      labelSelector: z.string().optional().describe('标签选择器'),
      limit: z.number().min(1).max(200).default(50).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { kubernetesService } = await import(
          '../../../modules/kubernetes/services/kubernetesService'
        );
        const pods = await (kubernetesService as any).listPods?.(
          args.clusterId,
          args.namespace,
          args.labelSelector,
          args.limit
        );
        return jsonResult(pods || [], `Pod 列表`);
      } catch (err) {
        return textResult(`查询 Pod 失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'docker.container.list',
    title: 'Docker 容器列表',
    description: '列出所有 Docker 容器',
    domain: 'containers',
    inputSchema: z.object({
      all: z.boolean().optional().default(false).describe('是否显示所有容器（含已停止）'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const containers = await dockerService.listContainers(Boolean(args.all));
        return jsonResult(
          containers,
          `Docker 容器列表 (共 ${containers.length} 个):\n${containers.map((c: Record<string, unknown>) => `• ${c.name} (${c.state}) ${c.image}`).join('\n')}`
        );
      } catch (err) {
        return textResult(`获取容器列表失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'docker.image.list',
    title: 'Docker 镜像列表',
    description: '列出所有 Docker 镜像',
    domain: 'containers',
    inputSchema: z.object({}),
    annotations: READONLY,
    handler: async (_args, _ctx) => {
      try {
        const images = await dockerService.listImages();
        return jsonResult(
          images,
          `Docker 镜像列表 (共 ${images.length} 个):\n${images.map((img: any) => `• ${img.tags?.join(', ') || 'untagged'} (${img.size} bytes)`).join('\n')}`
        );
      } catch (err) {
        return textResult(`获取镜像列表失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'docker.container.logs',
    title: 'Docker 容器日志',
    description: '获取指定 Docker 容器的日志',
    domain: 'containers',
    inputSchema: z.object({
      containerId: z.string().describe('容器 ID'),
      tail: z.number().optional().default(100).describe('显示行数'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const logs = await dockerService.getContainerLogs(args.containerId as string, Number(args.tail) || 100);
        return textResult(`容器 ${args.containerId} 日志 (最近 ${args.tail || 100} 行):\n${logs}`);
      } catch (err) {
        return textResult(`获取容器日志失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'docker.container.stats',
    title: 'Docker 容器统计',
    description: '获取 Docker 容器资源使用统计',
    domain: 'containers',
    inputSchema: z.object({
      containerId: z.string().describe('容器 ID'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const stats = await dockerService.getContainerStats(args.containerId as string);
        return jsonResult(stats, `容器 ${args.containerId} 资源统计`);
      } catch (err) {
        return textResult(`获取容器统计失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'docker.container.info',
    title: 'Docker 容器详情',
    description: '获取 Docker 容器配置和状态详情',
    domain: 'containers',
    inputSchema: z.object({
      containerId: z.string().describe('容器 ID'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const info = await dockerService.getContainer(args.containerId as string);
        return jsonResult(info, `容器 ${args.containerId} 详细信息`);
      } catch (err) {
        return textResult(`获取容器详情失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'docker.system.info',
    title: 'Docker 系统信息',
    description: '获取 Docker Engine 系统信息',
    domain: 'containers',
    inputSchema: z.object({}),
    annotations: READONLY,
    handler: async (_args, _ctx) => {
      try {
        const info = await dockerService.getSystemInfo();
        return jsonResult(info, 'Docker 系统信息');
      } catch (err) {
        return textResult(`获取 Docker 系统信息失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'docker.volume.list',
    title: 'Docker 卷列表',
    description: '列出所有 Docker 数据卷',
    domain: 'containers',
    inputSchema: z.object({}),
    annotations: READONLY,
    handler: async (_args, _ctx) => {
      try {
        const volumes = await dockerService.listVolumes();
        return jsonResult(
          volumes,
          `Docker 卷列表 (共 ${volumes.length} 个):\n${volumes.map((v: any) => `• ${v.name} (${v.driver})`).join('\n')}`
        );
      } catch (err) {
        return textResult(`获取卷列表失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'docker.network.list',
    title: 'Docker 网络列表',
    description: '列出所有 Docker 网络',
    domain: 'containers',
    inputSchema: z.object({}),
    annotations: READONLY,
    handler: async (_args, _ctx) => {
      try {
        const networks = await dockerService.listNetworks();
        return jsonResult(
          networks,
          `Docker 网络列表 (共 ${networks.length} 个):\n${networks.map((n: Record<string, unknown>) => `• ${n.name} (${n.driver})`).join('\n')}`
        );
      } catch (err) {
        return textResult(`获取网络列表失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },
];
