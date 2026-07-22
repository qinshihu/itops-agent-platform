/**
 * Docker 类工具（2026-07-21 拆分）
 * - docker-list-containers / -images / -volumes / -networks
 * - docker-container-logs / -stats / -info
 * - docker-system-info
 *
 * 字段大小写严格对齐 dockerService.ts 的类型定义（name/image/state 等小写驼峰）
 */
import { dockerService } from '../../../../containers/services/dockerService';
import { agentToolRegistry } from '../agentToolRegistry';

export function registerDockerTools(): void {
  // 11. Docker 容器列表工具
  agentToolRegistry.register({
    id: 'docker-list-containers',
    name: 'Docker 容器列表',
    description: '列出 Docker 容器',
    category: 'docker',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {
        all: { type: 'boolean', description: '是否包含已停止容器', default: false },
      },
    },
    execute: async (args) => {
      const all = Boolean(args.all);
      try {
        const containers = await dockerService.listContainers(all);
        return `Docker 容器列表 (共${containers.length}个):\n${
          containers.map(c => `• ${c.name} (${c.state}) ${c.image}`).join('\n')
        }`;
      } catch (error) {
        return `获取 Docker 容器列表失败: ${(error as Error).message}`;
      }
    },
  });

  // 12. Docker 镜像列表工具
  agentToolRegistry.register({
    id: 'docker-list-images',
    name: 'Docker 镜像列表',
    description: '列出 Docker 镜像',
    category: 'docker',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const images = await dockerService.listImages();
        return `Docker 镜像列表 (共${images.length}个):\n${
          images.map(img => `• ${img.tags.join(', ')} (${img.size} bytes)`).join('\n')
        }`;
      } catch (error) {
        return `获取 Docker 镜像列表失败: ${(error as Error).message}`;
      }
    },
  });

  // 13. Docker 容器日志工具
  agentToolRegistry.register({
    id: 'docker-container-logs',
    name: 'Docker 容器日志',
    description: '获取 Docker 容器日志',
    category: 'docker',
    riskLevel: 'low',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: '容器 ID' },
        tail: { type: 'number', description: '显示行数', default: 100 },
      },
      required: ['containerId'],
    },
    execute: async (args) => {
      const containerId = args.containerId as string;
      const tail = (args.tail as number) || 100;
      try {
        const logs = await dockerService.getContainerLogs(containerId, tail);
        return `容器 ${containerId} 的日志 (最近${tail}行):\n${logs}`;
      } catch (error) {
        return `获取容器日志失败: ${(error as Error).message}`;
      }
    },
  });

  // 14. Docker 容器统计工具
  agentToolRegistry.register({
    id: 'docker-container-stats',
    name: 'Docker 容器统计',
    description: '获取 Docker 容器统计信息',
    category: 'docker',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: '容器 ID' },
      },
      required: ['containerId'],
    },
    execute: async (args) => {
      const containerId = args.containerId as string;
      try {
        const stats = await dockerService.getContainerStats(containerId);
        return `容器 ${containerId} 的统计信息:\n${JSON.stringify(stats, null, 2)}`;
      } catch (error) {
        return `获取容器统计信息失败: ${(error as Error).message}`;
      }
    },
  });

  // 15. Docker 容器详情工具
  agentToolRegistry.register({
    id: 'docker-container-info',
    name: 'Docker 容器详情',
    description: '获取 Docker 容器详细信息',
    category: 'docker',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: '容器 ID' },
      },
      required: ['containerId'],
    },
    execute: async (args) => {
      const containerId = args.containerId as string;
      try {
        const containerInfo = await dockerService.getContainer(containerId);
        return `容器 ${containerId} 的详细信息:\n${JSON.stringify(containerInfo, null, 2)}`;
      } catch (error) {
        return `获取容器详细信息失败: ${(error as Error).message}`;
      }
    },
  });

  // 16. Docker 系统信息工具
  agentToolRegistry.register({
    id: 'docker-system-info',
    name: 'Docker 系统信息',
    description: '获取 Docker 系统信息',
    category: 'docker',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const info = await dockerService.getSystemInfo();
        return `Docker 系统信息:\n${JSON.stringify(info, null, 2)}`;
      } catch (error) {
        return `获取 Docker 系统信息失败: ${(error as Error).message}`;
      }
    },
  });

  // 17. Docker 卷列表工具
  agentToolRegistry.register({
    id: 'docker-list-volumes',
    name: 'Docker 卷列表',
    description: '列出 Docker 卷',
    category: 'docker',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const volumes = await dockerService.listVolumes();
        return `Docker 卷列表 (共${volumes.length}个):\n${
          volumes.map(v => `• ${v.name} (${v.driver})`).join('\n')
        }`;
      } catch (error) {
        return `获取 Docker 卷列表失败: ${(error as Error).message}`;
      }
    },
  });

  // 18. Docker 网络列表工具
  agentToolRegistry.register({
    id: 'docker-list-networks',
    name: 'Docker 网络列表',
    description: '列出 Docker 网络',
    category: 'docker',
    riskLevel: 'readonly',
    auditEnabled: false,
    schema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const networks = await dockerService.listNetworks();
        return `Docker 网络列表 (共${networks.length}个):\n${
          networks.map(n => `• ${n.name} (${n.driver})`).join('\n')
        }`;
      } catch (error) {
        return `获取 Docker 网络列表失败: ${(error as Error).message}`;
      }
    },
  });
}