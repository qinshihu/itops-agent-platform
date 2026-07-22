import { z } from 'zod';
import { type RegisteredTool, RiskLevel } from '../types';
import { textResult, jsonResult, READONLY } from './shared';
import { executeCommand } from '../../../../modules/servers/services/sshService';
import { serversRepo } from '../../../../repositories';

export const serverTools: RegisteredTool[] = [
  {
    name: 'server.list',
    title: '查询服务器列表',
    description: '查询所有管理的服务器列表，包含基本信息（主机名、IP、状态、分组）。',
    domain: 'server_operation',
    annotations: READONLY,
    inputSchema: z.object({
      groupId: z.string().optional().describe('服务器分组 ID'),
      status: z.enum(['online', 'offline', 'unknown']).optional().describe('在线状态'),
      search: z.string().optional().describe('搜索关键词（主机名/IP）'),
      limit: z.number().min(1).max(100).default(50).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const servers = serversRepo.listWithFilters({
          groupId: args.groupId,
          status: args.status,
          search: args.search,
          limit: args.limit || 50,
        });
        return jsonResult(servers, `找到 ${(servers as unknown[])?.length || 0} 台服务器`);
      } catch (err) {
        return textResult(`查询服务器失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'server.detail',
    title: '查询服务器详情',
    description: '查询指定服务器的详细信息，包括配置、磁盘、网络接口、运行服务等。',
    domain: 'server_operation',
    annotations: READONLY,
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
    }),
    handler: async (args) => {
      try {
        const server = serversRepo.getById(args.serverId as string);
        if (!server) return textResult(`服务器 ${args.serverId} 不存在`, true);
        return jsonResult(server, `服务器 ${(server as any).name} 详情`);
      } catch (err) {
        return textResult(`查询服务器详情失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'ssh.exec',
    title: 'SSH 命令执行',
    description: '在远程服务器上执行 SSH 命令',
    domain: 'servers',
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
      command: z.string().describe('要执行的命令'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, riskLevel: RiskLevel.MEDIUM, requiresApproval: true },
    handler: async (args, _ctx) => {
      try {
        const result = await executeCommand(args.serverId as string, args.command as string);
        return textResult(
          `执行结果 (${result.success ? '✅ 成功' : '❌ 失败'})\n输出:\n${result.stdout}${result.stderr ? `\n错误:\n${result.stderr}` : ''}\n用时: ${result.duration}ms`
        );
      } catch (err) {
        return textResult(`SSH 执行失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'ssh.viewFile',
    title: '查看远程文件',
    description: '查看远程服务器上的文件内容（tail）',
    domain: 'servers',
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
      filePath: z.string().describe('文件路径'),
      lines: z.number().optional().default(100).describe('显示行数'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const command = `tail -n ${args.lines || 100} ${args.filePath}`;
        const result = await executeCommand(args.serverId as string, command);
        return textResult(`文件: ${args.filePath}\n${result.stdout}${result.stderr ? `\n错误: ${result.stderr}` : ''}`);
      } catch (err) {
        return textResult(`查看文件失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'server.hostLoad',
    title: '主机负载信息',
    description: '获取主机负载详情（uptime/free/df/iostat/vmstat）',
    domain: 'servers',
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const commands = ['uptime', 'free -h', 'df -h', 'iostat -x 1 1', 'vmstat 1 1'].join(' && echo -e "\\n---\\n" && ');
        const result = await executeCommand(args.serverId as string, commands);
        return textResult(result.stdout);
      } catch (err) {
        return textResult(`获取负载信息失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'server.processes',
    title: '主机进程列表',
    description: '获取主机进程列表，可按 CPU 或内存排序',
    domain: 'servers',
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
      sortBy: z.enum(['cpu', 'mem']).optional().default('cpu').describe('排序方式'),
      limit: z.number().optional().default(20).describe('显示数量'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const sortFlag = args.sortBy === 'mem' ? '-%mem' : '-%cpu';
        const command = `ps aux --sort=${sortFlag} | head -${args.limit || 20}`;
        const result = await executeCommand(args.serverId as string, command);
        return textResult(result.stdout);
      } catch (error: unknown) {
        return textResult(`获取进程列表失败: ${(error as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'server.networkStatus',
    title: '网络状态检查',
    description: '检查服务器网络状态（IP/Socket/路由/Ping）',
    domain: 'servers',
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const commands = ['ip addr show', 'ss -tuln', 'ip route show', 'ping -c 4 8.8.8.8'].join(' && echo -e "\\n---\\n" && ');
        const result = await executeCommand(args.serverId as string, commands);
        return textResult(result.stdout);
      } catch (err) {
        return textResult(`网络检查失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'server.findLargeFiles',
    title: '查找大文件',
    description: '查找服务器上的大文件（可指定目录和最小大小）',
    domain: 'servers',
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
      directory: z.string().optional().default('/').describe('查找目录'),
      minSizeMB: z.number().optional().default(100).describe('最小文件大小 (MB)'),
      limit: z.number().optional().default(10).describe('显示数量'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        const command = `find ${args.directory || '/'} -type f -size +${args.minSizeMB || 100}M -exec ls -lh {} \\; 2>/dev/null | head -${args.limit || 10}`;
        const result = await executeCommand(args.serverId as string, command);
        return textResult(`查找目录: ${args.directory || '/'}\n最小文件大小: ${args.minSizeMB || 100} MB\n${result.stdout}`);
      } catch (err) {
        return textResult(`查找大文件失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'server.logs',
    title: '系统日志查询',
    description: '查询服务器系统日志（journalctl）',
    domain: 'servers',
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
      unit: z.string().optional().describe('服务单元名称'),
      since: z.string().optional().default('1 hour ago').describe('起始时间'),
      lines: z.number().optional().default(100).describe('显示行数'),
      level: z.enum(['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug']).optional().describe('日志级别'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        let command = 'journalctl';
        if (args.unit) command += ` -u ${args.unit}`;
        if (args.level) command += ` -p ${args.level}`;
        command += ` --since '${args.since || '1 hour ago'}' -n ${args.lines || 100}`;
        const result = await executeCommand(args.serverId as string, command);
        return textResult(`系统日志 (${args.unit || '所有单元'}, ${args.since || '1 hour ago'}):\n${result.stdout}`);
      } catch (err) {
        return textResult(`查询日志失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'server.services',
    title: '服务状态检查',
    description: '检查服务器上的 systemd 服务状态',
    domain: 'servers',
    inputSchema: z.object({
      serverId: z.string().describe('服务器 ID'),
      unit: z.string().optional().describe('服务单元名称'),
      listAll: z.boolean().optional().default(false).describe('列出所有服务'),
    }),
    annotations: READONLY,
    handler: async (args, _ctx) => {
      try {
        let command = 'systemctl';
        if (args.listAll) {
          command += ' list-units --type=service';
        } else if (args.unit) {
          command += ` status ${args.unit}`;
        } else {
          command += ' --failed --type=service';
        }
        const result = await executeCommand(args.serverId as string, command);
        return textResult(`服务状态:\n${result.stdout}`);
      } catch (err) {
        return textResult(`服务检查失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },
];