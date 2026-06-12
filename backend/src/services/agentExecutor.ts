import db from '../models/database';
import { logger } from '../utils/logger';
import { executeAgentWithLLM } from './llmService';
import { executeCommand, runComplianceCheck, complianceChecks } from './sshService';
import { AGENT_NAMES } from '../constants/agentNames';
import type { Agent, Server } from '../types';

const AGENT_EXECUTION_TIMEOUT = 300000; // 5 分钟

type AgentRow = Pick<Agent, 'id' | 'name'> & { system_prompt: string };
type ServerRow = Pick<Server, 'id' | 'name' | 'hostname'>;

function getAgent(agentId: string): AgentRow | undefined {
  return db.prepare(
    'SELECT id, name, system_prompt FROM agents WHERE id = ?'
  ).get(agentId) as AgentRow | undefined;
}

function getEnabledServers(): ServerRow[] {
  return db.prepare(
    'SELECT id, name, hostname FROM servers WHERE enabled = 1'
  ).all() as ServerRow[];
}

export async function executeAgentNode(
  agentId: string,
  input: string,
  context?: Record<string, unknown>
): Promise<string> {
  logger.info(`🔍 executeAgentNode called with agentId: ${agentId} input: ${input?.substring(0, 100)}`);
  
  const agent = getAgent(agentId);
  logger.info('🔍 Agent data from DB:', agent);
  
  const agentName = agent?.name || 'Agent';
  logger.info('🔍 Agent name:', agentName);
  
  // 检查是否是服务器相关 Agent
  if (agentName.includes(AGENT_NAMES.SERVER_COMMAND)) {
    return await executeServerCommandAgent(input, context);
  }
  
  if (agentName.includes(AGENT_NAMES.SYSTEM_INSPECTION) || agentName.includes(AGENT_NAMES.AUTO_INSPECTION)) {
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
 * 根据输入内容推断要执行的命令
 */
function inferCommandByInput(input: string): string {
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
async function executeServerCommandAgent(input: string, context?: Record<string, unknown>): Promise<string> {
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

/**
 * 自动巡检 Agent：真实执行服务器合规检查（支持多台服务器）
 */
async function executeAutoInspectionAgent(input: string, context?: Record<string, unknown>): Promise<string> {
  logger.info('🔍 executeAutoInspectionAgent called with:', { input, context });
  
  let serverIds: string[] | undefined;
  if (context) {
    if (Array.isArray(context.serverIds)) {
      serverIds = context.serverIds.map(String);
    }
    if (context.serverId) {
      serverIds = [String(context.serverId)];
    }
  }
  
  logger.info('🔍 Selected server IDs for inspection:', serverIds);
  
  const servers = getEnabledServers();
  if (servers.length === 0) {
    return '## 无法执行巡检\n\n**错误**: 没有找到可用的服务器。请先在服务器管理中添加服务器。';
  }
  
  if (!serverIds || serverIds.length === 0) {
    serverIds = [servers[0].id];
  }
  
  let totalSuccessChecks = 0;
  let totalFailChecks = 0;
  let report = `## 服务器自动巡检报告\n\n**检查时间**: ${new Date().toLocaleString()}\n**目标服务器**: ${serverIds.length} 台\n\n---\n`;
  
  for (const serverId of serverIds) {
    const server = servers.find(s => s.id === serverId);
    if (!server) continue;
    
    const { successCount, failCount, detail } = await inspectSingleServer(server);
    totalSuccessChecks += successCount;
    totalFailChecks += failCount;
    report += detail;
  }
  
  report += `\n**总体统计**: ${totalSuccessChecks} 项成功, ${totalFailChecks} 项失败\n`;
  return report;
}

/**
 * 检查单台服务器并返回结果详情
 */
async function inspectSingleServer(server: ServerRow): Promise<{
  successCount: number;
  failCount: number;
  detail: string;
}> {
  let successCount = 0;
  let failCount = 0;
  let detail = `\n### 🖥️ ${server.name} (${server.hostname})\n\n`;
  
  try {
    logger.info(`🔍 对服务器 ${server.name}(${server.hostname}) 执行自动巡检...`);
    const results = await runComplianceCheck(server.id);
    
    for (const [, result] of Object.entries(results)) {
      if (result.success) successCount++;
      else failCount++;
    }
    
    detail += `**检查结果**: ${successCount} ✅, ${failCount} ❌\n\n`;
    
    for (const [checkName, result] of Object.entries(results)) {
      detail += `${result.success ? '✅' : '❌'} **${checkName}**: ${result.success ? '通过' : '失败'}\n`;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    detail += `**错误**: ${errorMessage}\n\n`;
  }
  
  detail += '\n---\n';
  return { successCount, failCount, detail };
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
