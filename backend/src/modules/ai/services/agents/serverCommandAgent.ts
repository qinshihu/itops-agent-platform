/**
 * agents/serverCommandAgent.ts — 服务器命令执行 Agent
 *
 * 负责真实执行服务器命令，支持多台服务器
 */

import { serversRepo } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { executeCommand } from '../../../servers/services/sshService';
import type { Server } from '../../../../types';
import type { AgentExecutionContext } from './agentCore';

type ServerRow = Pick<Server, 'id' | 'name' | 'hostname'>;

function getEnabledServers(): ServerRow[] {
  return serversRepo.listEnabled() as unknown as ServerRow[];
}

/**
 * 根据输入内容推断要执行的命令
 */
export function inferCommandByInput(input: string): string {
  if (input.toLowerCase().includes('cpu')) {
    return 'top -bn1 | head -20';
  }
  if (input.toLowerCase().includes('memory') || input.toLowerCase().includes('内存')) {
    return 'free -h && cat /proc/meminfo | head -20';
  }
  if (input.toLowerCase().includes('disk') || input.toLowerCase().includes('磁盘')) {
    return 'df -h && du -sh /* 2>/dev/null | sort -rh | head -20';
  }
  if (input.toLowerCase().includes('network') || input.toLowerCase().includes('网络')) {
    return 'ip addr && ss -tulpn';
  }
  if (input.toLowerCase().includes('service') || input.toLowerCase().includes('服务')) {
    return 'systemctl list-units --type=service --state=running || service --status-all 2>&1 | head -50';
  }
  return 'uname -a && uptime && free -h && df -h';
}

/**
 * 服务器命令执行 Agent：真实执行服务器命令（支持多台服务器）
 */
export async function executeServerCommandAgent(input: string, context?: AgentExecutionContext): Promise<string> {
  logger.info('💻 executeServerCommandAgent called with:', { input, context });
  
  let serverIds: string[] | undefined;
  let command: string | undefined;
  
  if (context) {
    if (Array.isArray(context.serverIds)) {
      serverIds = context.serverIds.map(String);
    }
    if (context.serverId) {
      serverIds = [String(context.serverId)];
    }
    command = context.command as string | undefined;
  }
  
  logger.info('💻 Selected server IDs:', serverIds);
  
  const servers = getEnabledServers();
  if (servers.length === 0) {
    return '## 无法执行操作\n\n**错误**: 没有找到可用的服务器。请先在服务器管理中添加服务器。';
  }
  
  if (!serverIds || serverIds.length === 0) {
    serverIds = [servers[0].id];
  }
  
  const finalCommand = command || inferCommandByInput(input);
  
  let report = `## 服务器命令执行结果\n\n**执行时间**: ${new Date().toLocaleString()}\n**执行命令**: \n\`\`\`bash\n${finalCommand}\n\`\`\`\n**目标服务器**: ${serverIds.length} 台\n\n---\n`;
  
  let totalSuccess = 0;
  let totalFail = 0;
  
  for (const serverId of serverIds) {
    const server = servers.find(s => s.id === serverId);
    if (!server) continue;
    
    const serverSection = await executeOnSingleServer(server, finalCommand);
    report += serverSection;
    if (serverSection.includes('✅')) totalSuccess++;
    else totalFail++;
  }
  
  report += `\n**统计**: ${totalSuccess} 台成功, ${totalFail} 台失败\n`;
  
  return report;
}

async function executeOnSingleServer(server: ServerRow, command: string): Promise<string> {
  let section = `\n### 🖥️ ${server.name} (${server.hostname})\n\n`;
  
  try {
    const result = await executeCommand(server.id, command);
    
    if (result.success) {
      section += `**状态**: ✅ 成功 (${result.duration}ms)\n\n`;
    } else {
      section += `**状态**: ❌ 失败 (${result.duration}ms)\n\n`;
    }
    
    section += `**输出**: \n\`\`\`\n${result.stdout?.substring(0, 500) || '(无输出)'}\n\`\`\`\n`;
    
    if (result.stderr) {
      section += `**错误**: \n\`\`\`\n${result.stderr}\n\`\`\`\n`;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    section += `**错误**: ${errorMessage}\n\n`;
  }
  
  section += '---\n';
  return section;
}