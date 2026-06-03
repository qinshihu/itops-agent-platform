import db from '../models/database';
import { logger } from '../utils/logger';
import { executeAgentWithLLM } from './llmService';
import { executeCommand, runComplianceCheck } from './sshService';
import { Agent, Server } from '../types';

const AGENT_EXECUTION_TIMEOUT = 300000; // 5 分钟

export async function executeAgentNode(
  agentId: string,
  input: string,
  context?: Record<string, unknown>
): Promise<string> {
  logger.info(`🔍 executeAgentNode called with agentId: ${agentId} input: ${input?.substring(0, 100)}`);
  
  const agent = db.prepare('SELECT id, name, system_prompt FROM agents WHERE id = ?').get(agentId) as Agent | undefined;
  logger.info('🔍 Agent data from DB:', agent);
  
  const agentName = agent?.name || 'Agent';
  logger.info('🔍 Agent name:', agentName);
  
  // 检查是否是服务器相关 Agent
  if (agentName.includes('服务器命令执行')) {
    return await executeServerCommandAgent(input, context);
  }
  
  if (agentName.includes('系统巡检') || agentName.includes('自动巡检')) {
    return await executeAutoInspectionAgent(input, context);
  }
  
  // 其他 Agent - 调用真实 LLM，增加超时保护
  logger.info(`🤖 Calling LLM for agent ${agentName}`);
  return await Promise.race([
    executeAgentWithLLM(agentId, input),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent 执行超时（${AGENT_EXECUTION_TIMEOUT / 1000}s）`)), AGENT_EXECUTION_TIMEOUT)
    )
  ]);
}

/**
 * 服务器命令执行 Agent：真实执行服务器命令（支持多台服务器）
 */
async function executeServerCommandAgent(input: string, context?: Record<string, unknown>): Promise<string> {
  logger.info('💻 executeServerCommandAgent called with:', { input, context });
  
  let serverIds: string[] | undefined = context?.serverIds as string[] | undefined;
  let command: string | undefined = context?.command as string | undefined;
  
  if (!serverIds && context?.serverId) {
    serverIds = [context.serverId as string];
  }
  
  logger.info('💻 Selected server IDs:', serverIds);
  
  const servers = db.prepare('SELECT id, name, hostname FROM servers WHERE enabled = 1').all() as Server[];
  if (servers.length === 0) {
    return '## 无法执行操作\n\n**错误**: 没有找到可用的服务器。请先在服务器管理中添加服务器。';
  }
  
  if (!serverIds || serverIds.length === 0) {
    serverIds = [servers[0].id];
  }
  
  if (!command) {
    command = 'uname -a && uptime && free -h && df -h';
    
    if (input.toLowerCase().includes('cpu')) {
      command = 'top -bn1 | head -20';
    } else if (input.toLowerCase().includes('memory') || input.toLowerCase().includes('内存')) {
      command = 'free -h && cat /proc/meminfo | head -20';
    } else if (input.toLowerCase().includes('disk') || input.toLowerCase().includes('磁盘')) {
      command = 'df -h && du -sh /* 2>/dev/null | sort -rh | head -20';
    } else if (input.toLowerCase().includes('network') || input.toLowerCase().includes('网络')) {
      command = 'ip addr && ss -tulpn';
    } else if (input.toLowerCase().includes('service') || input.toLowerCase().includes('服务')) {
      command = 'systemctl list-units --type=service --state=running || service --status-all 2>&1 | head -50';
    }
  }
  
  let report = `## 服务器命令执行结果\n\n**执行时间**: ${new Date().toLocaleString()}\n**执行命令**: \n\`\`\`bash\n${command}\n\`\`\`\n**目标服务器**: ${serverIds.length} 台\n\n---\n`;
  
  let totalSuccess = 0;
  let totalFail = 0;
  
  for (const serverId of serverIds) {
    const server = servers.find((s: Server) => s.id === serverId);
    if (!server) continue;
    
    report += `\n### 🖥️ ${server.name} (${server.hostname})\n\n`;
    
    try {
      const result = await executeCommand(serverId, command!);
      
      if (result.success) {
        totalSuccess++;
        report += `**状态**: ✅ 成功 (${result.duration}ms)\n\n`;
      } else {
        totalFail++;
        report += `**状态**: ❌ 失败 (${result.duration}ms)\n\n`;
      }
      
      report += `**输出**: \n\`\`\`\n${result.stdout?.substring(0, 500) || '(无输出)'}\n\`\`\`\n`;
      
      if (result.stderr) {
        report += `**错误**: \n\`\`\`\n${result.stderr}\n\`\`\`\n`;
      }
      
    } catch (error: unknown) {
      totalFail++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      report += `**错误**: ${errorMessage}\n\n`;
    }
    
    report += '---\n';
  }
  
  report += `\n**统计**: ${totalSuccess} 台成功, ${totalFail} 台失败\n`;
  
  return report;
}

/**
 * 自动巡检 Agent：真实执行服务器合规检查（支持多台服务器）
 */
async function executeAutoInspectionAgent(input: string, context?: Record<string, unknown>): Promise<string> {
  logger.info('🔍 executeAutoInspectionAgent called with:', { input, context });
  
  let serverIds: string[] | undefined = context?.serverIds as string[] | undefined;
  
  if (!serverIds && context?.serverId) {
    serverIds = [context.serverId as string];
  }
  
  logger.info('🔍 Selected server IDs for inspection:', serverIds);
  
  const servers = db.prepare('SELECT id, name, hostname FROM servers WHERE enabled = 1').all() as Server[];
  if (servers.length === 0) {
    return '## 无法执行巡检\n\n**错误**: 没有找到可用的服务器。请先在服务器管理中添加服务器。';
  }
  
  if (!serverIds || serverIds.length === 0) {
    serverIds = [servers[0].id];
  }
  
  let report = `## 服务器自动巡检报告\n\n**检查时间**: ${new Date().toLocaleString()}\n**目标服务器**: ${serverIds.length} 台\n\n---\n`;
  
  let totalSuccessChecks = 0;
  let totalFailChecks = 0;
  
  for (const serverId of serverIds) {
    const server = servers.find((s: Server) => s.id === serverId);
    if (!server) continue;
    
    let successCount = 0;
    let failCount = 0;
    
    try {
      logger.info(`🔍 对服务器 ${server.name}(${server.hostname}) 执行自动巡检...`);
      const results = await runComplianceCheck(serverId);
      
      report += `\n### 🖥️ ${server.name} (${server.hostname})\n\n`;
      
      for (const [, result] of Object.entries(results)) {
        if (result.success) {
          successCount++;
          totalSuccessChecks++;
        } else {
          failCount++;
          totalFailChecks++;
        }
      }
      
      report += `**检查结果**: ${successCount} ✅, ${failCount} ❌\n\n`;
      
      for (const [checkName, result] of Object.entries(results)) {
        report += `${result.success ? '✅' : '❌'} **${checkName}**: ${result.success ? '通过' : '失败'}\n`;
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      report += `\n### 🖥️ ${server.name} (${server.hostname})\n\n**错误**: ${errorMessage}\n\n`;
      totalFailChecks += failCount;
    }
    
    report += '\n---\n';
  }
  
  report += `\n**总体统计**: ${totalSuccessChecks} 项成功, ${totalFailChecks} 项失败\n`;
  
  return report;
}

export function getThinkingSteps(agentName: string): string[] {
  const steps: Record<string, string[]> = {
    '告警处理': [
      '正在解析告警内容...',
      '识别到告警关键信息：主机名、告警类型、告警值',
      '评估告警严重程度和紧急程度',
      '准备告警摘要供后续处理使用'
    ],
    '故障诊断': [
      '分析告警模式和历史数据...',
      '检查相关系统日志和应用日志',
      '识别可能的故障原因',
      '生成排查步骤清单'
    ],
    '日志分析': [
      '解析日志格式和时间戳...',
      '识别错误模式和异常事件',
      '提取关键日志条目',
      '生成日志分析摘要'
    ],
    '系统巡检': [
      '收集系统资源使用信息...',
      '检查服务进程运行状态',
      '验证系统配置和安全设置',
      '生成健康检查报告'
    ],
    '变更执行': [
      '验证操作命令安全性...',
      '准备执行环境和参数',
      '执行系统变更操作',
      '验证操作结果'
    ],
    '文档生成': [
      '收集任务执行数据...',
      '整理分析结果和输出',
      '按照报告模板格式化',
      '生成最终文档'
    ],
    '合规检查': [
      '对照安全基线检查...',
      '验证配置项合规性',
      '识别不符合项',
      '生成合规报告'
    ],
    '服务器命令执行': [
      '连接目标服务器...',
      '验证身份认证...',
      '准备执行命令...',
      '执行命令并收集输出...'
    ],
    '自动巡检': [
      '连接目标服务器...',
      '开始系统健康检查...',
      '收集各项指标数据...',
      '整理巡检结果...'
    ]
  };
  
  return steps[agentName] || ['正在分析...', '正在处理...', '完成'];
}
