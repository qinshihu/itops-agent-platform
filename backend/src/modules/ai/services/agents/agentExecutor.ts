import db from '../../../models/database';
import { logger } from '../../../utils/logger';
import { executeAgentWithLLM } from './llmService.ts';
import { executeCommand, runComplianceCheck } from '../../servers/services/sshService.ts';
import { AGENT_NAMES } from '../../../constants/agentNames';
import { decrypt } from '../../auth/services/encryptionService.ts';
import {
  executeDbskiter,
  inferDatabaseOperation,
  formatResultToMarkdown,
} from '../../database/services/dbskiterService.ts';
import { agentToolRegistry, AgentTool } from './agentToolRegistry.ts';
import type { Agent, Server } from '../../../types';

/**
 * 工具调用结果
 */
interface ToolExecutionResult {
  success: boolean;
  toolId: string;
  result: string;
  error?: string;
}

/**
 * 从 LLM 响应中提取工具调用
 * 简单的解析器，实际项目中可能需要更复杂的解析
 */
function extractToolCallFromResponse(response: string): {
  hasToolCall: boolean;
  toolId?: string;
  args?: Record<string, any>;
} {
  const toolCallRegex = /\[TOOL_CALL\]\s*(\w+)\s*:\s*(\{[\s\S]*\})/;
  const match = response.match(toolCallRegex);

  if (match) {
    try {
      const toolId = match[1];
      const args = JSON.parse(match[2]);
      return {
        hasToolCall: true,
        toolId,
        args,
      };
    } catch (error) {
      logger.warn('解析工具调用失败:', error);
    }
  }

  return { hasToolCall: false };
}

/**
 * 执行工具调用
 */
async function executeToolCall(toolId: string, args: Record<string, any>): Promise<ToolExecutionResult> {
  const tool = agentToolRegistry.getTool(toolId);
  if (!tool) {
    return {
      success: false,
      toolId,
      result: '',
      error: `未找到工具: ${toolId}`,
    };
  }

  try {
    logger.info(`🔧 执行工具: ${toolId}`, args);
    const result = await tool.execute(args);
    return {
      success: true,
      toolId,
      result,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ 工具执行失败: ${toolId}`, error);
    return {
      success: false,
      toolId,
      result: '',
      error: errorMessage,
    };
  }
}

/**
 * 构建支持工具调用的系统提示
 */
function buildSystemPromptWithTools(originalPrompt: string): string {
  const toolDescriptions = agentToolRegistry.generateToolDescriptions();
  return `${originalPrompt}

【可用工具】
${toolDescriptions}

【工具使用方式】
如果需要执行某个操作，可以用下面的格式调用工具：
[TOOL_CALL] tool_id: {"param1": "value1", "param2": "value2"}

示例：
[TOOL_CALL] ssh-exec: {"host": "192.168.1.100", "command": "uptime"}
[TOOL_CALL] docker-list-containers: {"host": "192.168.1.100", "all": false}

【注意】
- 每次最多调用 1 个工具
- 工具调用必须用 JSON 格式
- 如果不需要调用工具，直接用自然语言回答即可
`;
}

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

  // 数据库运维 Agent：调用 dbskiter 执行数据库诊断/监控/安全/锁分析
  if (agentName.includes(AGENT_NAMES.DATABASE_ADMIN)) {
    return await executeDatabaseAdminAgent(agentId, input, context);
  }

  // 其他 Agent - 支持工具调用
  logger.info(`🤖 Calling LLM for agent ${agentName} with tool support`);
  
  let currentInput = input;
  let conversationHistory: string[] = [];
  const maxToolCalls = 3; // 最多尝试 3 次工具调用

  // 先尝试工具调用
  for (let i = 0; i < maxToolCalls; i++) {
    const response = await Promise.race([
      executeAgentNodeWithTools(agent, currentInput, conversationHistory),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`Agent 执行超时（${AGENT_EXECUTION_TIMEOUT / 1000}s）`)), AGENT_EXECUTION_TIMEOUT)
      )
    ]);

    const toolCall = extractToolCallFromResponse(response);
    if (!toolCall.hasToolCall || !toolCall.toolId) {
      // 没有工具调用，直接返回响应
      return response;
    }

    // 有工具调用，执行工具
    conversationHistory.push(`用户: ${currentInput}`);
    conversationHistory.push(`助手: ${response}`);

    logger.info(`🔧 检测到工具调用: ${toolCall.toolId}`, toolCall.args);
    const toolResult = await executeToolCall(toolCall.toolId, toolCall.args || {});

    if (toolResult.success) {
      conversationHistory.push(`工具结果: ${toolResult.result}`);
      currentInput = `工具执行成功，结果如下，请基于结果继续处理：\n\n${toolResult.result}`;
    } else {
      conversationHistory.push(`工具结果: 执行失败 - ${toolResult.error}`);
      currentInput = `工具执行失败，错误信息如下，请基于错误信息继续处理：\n\n${toolResult.error}`;
    }

    logger.info(`🔧 工具调用结果 (第 ${i + 1} 轮):`, currentInput);
  }

  // 工具调用次数用完，直接返回最后一次的响应或兜底
  logger.warn('⚠️ 工具调用次数用完，直接返回');
  return `多次尝试后未能完成任务，请重试或使用其他方式。`;
}

/**
 * 执行 Agent Node（支持工具调用的版本）
 */
async function executeAgentNodeWithTools(
  agent: AgentRow | undefined,
  input: string,
  conversationHistory: string[]
): Promise<string> {
  if (!agent?.system_prompt) {
    return `Agent 配置缺失，请检查 Agent 配置。`;
  }

  // 构建系统提示，加入工具信息
  const systemPromptWithTools = buildSystemPromptWithTools(agent.system_prompt);

  // 构建完整的提示
  let fullPrompt = systemPromptWithTools;
  if (conversationHistory.length > 0) {
    fullPrompt += '\n\n【历史对话】\n' + conversationHistory.join('\n');
  }
  fullPrompt += `\n\n【当前请求】\n${input}`;

  // 调用 LLM
  // 注意：这里我们暂时绕过标准的 executeAgentWithLLM，直接调用（因为标准函数可能用的是数据库中的原始 system prompt）
  // 实际项目中你可能需要修改 llmService 来支持自定义 system prompt
  logger.info(`🤖 Calling LLM with tool-enabled prompt (${agent.name})`);
  
  // 暂时的简单实现：复用 executeAgentWithLLM，传入增强的输入
  return await executeAgentWithLLM(agent.id, fullPrompt);
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
 * 数据库运维 Agent：调用 dbskiter 执行数据库诊断/监控/安全/锁分析
 *
 * 参数说明：
 * - input: [string] 用户输入
 * - context: [Record<string, unknown>] 上下文，可能包含 databaseId（数据库连接ID）
 */
async function executeDatabaseAdminAgent(
  agentId: string,
  input: string,
  context?: Record<string, unknown>
): Promise<string> {
  logger.info('🗄️ executeDatabaseAdminAgent called with:', { input, context });

  // 从上下文中获取 databaseId
  const databaseId = context?.databaseId as string | undefined;

  // 如果没有 databaseId，返回错误提示
  if (!databaseId) {
    return '## 数据库运维执行失败\n\n**错误**: 未选择数据库连接。请先在数据库连接管理中配置数据库，然后在测试时选择目标数据库。';
  }

  // 查询数据库连接信息
  const dbConn = db.prepare('SELECT * FROM databases WHERE id = ?').get(databaseId) as {
    id: string;
    name: string;
    db_type: string;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    enabled: number;
  } | undefined;

  if (!dbConn) {
    return '## 数据库运维执行失败\n\n**错误**: 找不到指定的数据库连接。请检查数据库连接 ID 是否正确。';
  }

  if (!dbConn.enabled) {
    return `## 数据库运维执行失败\n\n**错误**: 数据库连接 "${dbConn.name}" 已被禁用。`;
  }

  // 解密密码
  let decryptedPassword: string;
  try {
    decryptedPassword = decrypt(dbConn.password);
  } catch (_e) {
    decryptedPassword = dbConn.password; // 兼容未加密存储的历史数据
  }

  // 构建 dbskiter 连接对象
  const connection = {
    dialect: dbConn.db_type,
    host: dbConn.host,
    port: dbConn.port,
    user: dbConn.username,
    password: decryptedPassword,
    database: dbConn.database,
  };

  // 推断运维意图
  let options = inferDatabaseOperation(input, connection);

  // 如果无法推断，兜底：默认健康检查
  if (!options) {
    logger.warn('无法从输入推断数据库运维意图，使用默认健康检查');
    options = { connection, operation: 'monitor', subCommand: 'health' };
  }

  logger.info('🗄️ 推断的数据库运维操作:', { operation: options.operation, subCommand: options.subCommand });

  // 执行 dbskiter
  const result = await executeDbskiter(options);

  // 如果 dbskiter 执行失败，直接返回错误信息
  if (!result.success) {
    const operationLabel = `${options.operation}${options.subCommand ? ' ' + options.subCommand : ''}`;
    return formatResultToMarkdown(result, operationLabel);
  }

  // 构建 LLM 分析提示
  const rawData = typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.stdout;
  const prompt = `【数据库运维原始数据】\n\n用户请求：${input}\n\n数据库：${dbConn.name} (${dbConn.db_type}://${dbConn.host}:${dbConn.port}/${dbConn.database})\n\n执行操作：${options.operation} ${options.subCommand || ''}\n\n原始采集数据：\n\`\`\`json\n${rawData.substring(0, 12000)}\n\`\`\`\n\n请基于以上原始数据，为用户提供一份专业的数据库运维分析报告。要求：\n1. 用自然语言描述数据库当前状态\n2. 指出关键指标和潜在问题\n3. 给出具体的优化建议或处理方案\n4. 报告结构清晰，包含摘要、详细分析、建议三个部分\n`;

  try {
    logger.info('🤖 调用 LLM 分析 dbskiter 原始数据...');
    const analysis = await executeAgentWithLLM(agentId, prompt);
    return analysis;
  } catch (error) {
    logger.error('LLM 分析失败，返回原始数据:', error);
    const operationLabel = `${options.operation}${options.subCommand ? ' ' + options.subCommand : ''}`;
    return formatResultToMarkdown(result, operationLabel);
  }
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
    ],
    '数据库运维': [
      '解析数据库运维意图...',
      '识别目标数据库和运维操作...',
      '调用 dbskiter 执行诊断/监控/安全/锁分析...',
      '格式化执行结果...'
    ]
  };
  
  return steps[agentName] || ['正在分析...', '正在处理...', '完成'];
}
