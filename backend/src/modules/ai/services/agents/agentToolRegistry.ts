
import { logger } from '../../../utils/logger';
import { executeCommand } from '../../servers/services/sshService.ts';
import { dockerService } from '../../containers/services/dockerService.ts';
import { serverInfoCollector } from '../../servers/services/serverInfoCollector.ts';
import db from '../../../models/database';

/**
 * Agent 工具接口
 */
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: 'ssh' | 'docker' | 'kubernetes' | 'system' | 'network' | 'database';
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * Agent 工具注册表
 */
class AgentToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    this.tools.set(tool.id, tool);
    logger.info(`✅ Registered tool: ${tool.id} (${tool.name})`);
  }

  getTool(id: string): AgentTool | undefined {
    return this.tools.get(id);
  }

  listTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  listToolsByCategory(category: AgentTool['category']): AgentTool[] {
    return this.listTools().filter(t => t.category === category);
  }

  generateToolDescriptions(): string {
    const tools = this.listTools();
    if (tools.length === 0) {
      return '暂无可用工具';
    }

    return tools.map(tool => {
      return `
【${tool.id}】
- 名称: ${tool.name}
- 描述: ${tool.description}
- 分类: ${tool.category}
- 参数: ${JSON.stringify(tool.schema.properties, null, 2)}
`;
    }).join('\n');
  }
}

export const agentToolRegistry = new AgentToolRegistry();

/**
 * 预注册所有工具
 */
(function registerTools() {
  try {
    // ========================================
    // SSH & System 工具 (1-10)
    // ========================================

    // 1. SSH 命令执行工具
    agentToolRegistry.register({
      id: 'ssh-exec',
      name: 'SSH 命令执行',
      description: '在远程服务器上执行命令',
      category: 'ssh',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
          command: { type: 'string', description: '要执行的命令' },
        },
        required: ['serverId', 'command'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const command = args.command as string;
        const result = await executeCommand(serverId, command);
        return `
执行结果 (${result.success ? '✅ 成功' : '❌ 失败'})
输出:
${result.stdout}
${result.stderr ? `错误:
${result.stderr}` : ''}
用时: ${result.duration}ms
`.trim();
      },
    });

    // 2. 查看文件内容工具
    agentToolRegistry.register({
      id: 'view-file',
      name: '查看文件内容',
      description: '查看远程文件内容',
      category: 'ssh',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
          filePath: { type: 'string', description: '文件路径' },
          lines: { type: 'number', description: '显示行数', default: 100 },
        },
        required: ['serverId', 'filePath'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const filePath = args.filePath as string;
        const lines = args.lines as number || 100;
        const command = `tail -n ${lines} ${filePath}`;
        const result = await executeCommand(serverId, command);
        
        return `
文件: ${filePath}
${result.stdout}
${result.stderr ? `错误: ${result.stderr}` : ''}
`.trim();
      },
    });

    // 3. 系统信息查询工具
    agentToolRegistry.register({
      id: 'system-info',
      name: '系统信息查询',
      description: '获取服务器信息（CPU、内存、磁盘、网络）',
      category: 'system',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
        },
        required: ['serverId'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const info = await serverInfoCollector.collectServerInfo(serverId);
        if (!info.success || !info.data) {
          return `获取系统信息失败: ${info.error}`;
        }

        const metrics = await serverInfoCollector.collectServerMetrics(serverId);
        
        return `
服务器系统信息:
- 操作系统: ${info.data.os}
- CPU 核心数: ${info.data.cpu_cores}
- 内存总容量: ${info.data.memory_gb} GB
- 磁盘总容量: ${info.data.disk_gb} GB
- IP 地址: ${info.data.ip_address}
${metrics.data ? `
实时指标:
- CPU 使用率: ${metrics.data.cpu_usage}%
- 内存使用率: ${metrics.data.memory_usage}% (${metrics.data.memory_used_gb}/${metrics.data.memory_total_gb} GB)
- 磁盘使用率: ${metrics.data.disk_usage}% (${metrics.data.disk_used_gb}/${metrics.data.disk_total_gb} GB)
- 网络入: ${metrics.data.network_in_mbps} mbps
- 网络出: ${metrics.data.network_out_mbps} mbps
- 负载: ${metrics.data.load_1min}/${metrics.data.load_5min}/${metrics.data.load_15min}
- 运行时间: ${metrics.data.uptime_seconds} 秒
` : ''}
`.trim();
      },
    });

    // 4. 获取服务器列表工具
    agentToolRegistry.register({
      id: 'list-servers',
      name: '获取服务器列表',
      description: '获取所有已配置的服务器',
      category: 'system',
      schema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const servers = db.prepare('SELECT id, name, hostname, enabled FROM servers').all() as Array<{ id: string; name: string; hostname: string; enabled: number }>;
        return `服务器列表 (共${servers.length}个):\n${
          servers.map(s => `• ${s.name} (${s.hostname}) ${s.enabled ? '✅ 在线' : '❌ 离线'}`).join('\n')
        }`;
      },
    });

    // 5. 主机负载信息工具
    agentToolRegistry.register({
      id: 'host-load',
      name: '主机负载信息',
      description: '获取主机负载信息（CPU、内存、磁盘、系统运行时间）',
      category: 'system',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
        },
        required: ['serverId'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const commands = [
          'uptime', 'free -h', 'df -h', 'iostat -x 1 1', 'vmstat 1 1'
        ].join(' && echo -e "\\n---\\n" && ');

        const result = await executeCommand(serverId, commands);
        return result.stdout;
      },
    });

    // 6. 主机进程信息工具
    agentToolRegistry.register({
      id: 'host-processes',
      name: '主机进程信息',
      description: '获取主机进程列表（可按CPU或内存排序）',
      category: 'system',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
          sortBy: { type: 'string', description: '排序方式', enum: ['cpu', 'mem'], default: 'cpu' },
          limit: { type: 'number', description: '显示数量', default: 20 },
        },
        required: ['serverId'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const sortBy = args.sortBy as string || 'cpu';
        const limit = args.limit as number || 20;
        const sortFlag = sortBy === 'cpu' ? '-%cpu' : '-%mem';
        const command = `ps aux --sort=${sortFlag} | head -${limit}`;
        const result = await executeCommand(serverId, command);
        return result.stdout;
      },
    });

    // 7. 网络状态工具
    agentToolRegistry.register({
      id: 'network-status',
      name: '网络状态检查',
      description: '检查网络状态（端口、连接、路由）',
      category: 'network',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
        },
        required: ['serverId'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const commands = [
          'ip addr show', 'ss -tuln', 'ip route show', 'ping -c 4 8.8.8.8'
        ].join(' && echo -e "\\n---\\n" && ');

        const result = await executeCommand(serverId, commands);
        return result.stdout;
      },
    });

    // 8. 查找大文件工具
    agentToolRegistry.register({
      id: 'find-large-files',
      name: '查找大文件',
      description: '查找指定目录下的大文件',
      category: 'system',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
          directory: { type: 'string', description: '查找目录', default: '/' },
          minSizeMB: { type: 'number', description: '最小文件大小 (MB)', default: 100 },
          limit: { type: 'number', description: '显示数量', default: 10 },
        },
        required: ['serverId'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const directory = args.directory as string || '/';
        const minSizeMB = args.minSizeMB as number || 100;
        const limit = args.limit as number || 10;

        const command = `find ${directory} -type f -size +${minSizeMB}M -exec ls -lh {} \\; 2>/dev/null | head -${limit}`;
        const result = await executeCommand(serverId, command);
        
        return `
查找目录: ${directory}
最小文件大小: ${minSizeMB} MB
显示数量: ${limit}
${result.stdout}
`.trim();
      },
    });

    // 9. 系统日志查询工具
    agentToolRegistry.register({
      id: 'system-logs',
      name: '系统日志查询',
      description: '查询系统日志（journalctl）',
      category: 'system',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
          unit: { type: 'string', description: '服务单元' },
          since: { type: 'string', description: '起始时间', default: '1 hour ago' },
          lines: { type: 'number', description: '显示行数', default: 100 },
          level: { type: 'string', description: '日志级别', enum: ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'] },
        },
        required: ['serverId'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const unit = args.unit as string;
        const since = args.since as string || '1 hour ago';
        const lines = args.lines as number || 100;
        const level = args.level as string;

        let command = 'journalctl';
        if (unit) command += ` -u ${unit}`;
        if (level) command += ` -p ${level}`;
        command += ` --since '${since}' -n ${lines}`;

        const result = await executeCommand(serverId, command);
        
        return `
系统日志查询结果:
- 服务单元: ${unit || '所有'}
- 起始时间: ${since}
- 显示行数: ${lines}
${result.stdout}
`.trim();
      },
    });

    // 10. 服务状态检查工具
    agentToolRegistry.register({
      id: 'service-status',
      name: '服务状态检查',
      description: '检查系统服务状态',
      category: 'system',
      schema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
          unit: { type: 'string', description: '服务单元名称' },
          listAll: { type: 'boolean', description: '列出所有服务', default: false },
        },
        required: ['serverId'],
      },
      execute: async (args) => {
        const serverId = args.serverId as string;
        const unit = args.unit as string;
        const listAll = Boolean(args.listAll);

        let command = 'systemctl';
        if (listAll) {
          command += ' list-units --type=service';
        } else if (unit) {
          command += ` status ${unit}`;
        } else {
          command += ' --failed --type=service';
        }

        const result = await executeCommand(serverId, command);
        
        return `
服务状态检查结果:
${result.stdout}
`.trim();
      },
    });

    // ========================================
    // Docker 工具 (11-18)
    // ========================================

    // 11. Docker 容器列表工具
    agentToolRegistry.register({
      id: 'docker-list-containers',
      name: 'Docker 容器列表',
      description: '列出 Docker 容器',
      category: 'docker',
      schema: {
        type: 'object',
        properties: {
          all: { type: 'boolean', description: '是否显示所有容器', default: false },
        },
        required: [],
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
        const tail = args.tail as number || 100;
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

    // ========================================
    // Kubernetes & Database 工具 (19-20)
    // ========================================

    // 19. 告警列表工具
    agentToolRegistry.register({
      id: 'list-alerts',
      name: '告警列表',
      description: '获取告警列表',
      category: 'database',
      schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '显示数量', default: 20 },
          level: { type: 'string', description: '告警级别', enum: ['critical', 'warning', 'info'] },
          status: { type: 'string', description: '状态', enum: ['active', 'acknowledged', 'resolved'] },
        },
      },
      execute: async (args) => {
        const limit = args.limit as number || 20;
        const level = args.level as string;
        const status = args.status as string;

        let query = 'SELECT * FROM alerts';
        const whereClauses: string[] = [];
        
        if (level) whereClauses.push(`level = '${level}'`);
        if (status) whereClauses.push(`status = '${status}'`);
        
        if (whereClauses.length > 0) {
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        query += ` ORDER BY created_at DESC LIMIT ${limit}`;

        const alerts = db.prepare(query).all() as any[];
        
        return `告警列表 (共${alerts.length}条):\n${
          alerts.map(a => `• ${a.title} (${a.level}) [${a.status}]`).join('\n')
        }`;
      },
    });

    // 20. 数据库信息工具
    agentToolRegistry.register({
      id: 'database-info',
      name: '数据库信息',
      description: '获取数据库相关信息',
      category: 'database',
      schema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const serverCount = (db.prepare('SELECT COUNT(*) as count FROM servers').get() as any).count;
        const alertCount = (db.prepare('SELECT COUNT(*) as count FROM alerts').get() as any).count;
        const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
        
        return `数据库信息统计:
- 服务器数量: ${serverCount}
- 告警数量: ${alertCount}
- 用户数量: ${userCount}
`.trim();
      },
    });

    logger.info(`✅ 已预注册 ${agentToolRegistry.listTools().length} 个工具！`);
  } catch (error) {
    logger.error('❌ 预注册工具失败:', error);
  }
})();
