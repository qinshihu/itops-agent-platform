/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * agents/agentCore.ts — Agent 核心编排逻辑
 *
 * 包含：executeAgentNode（主入口）、工具调用解析、原生 Function Calling、
 * 系统提示构建、通用类型和工具函数
 */

import { agentRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { executeAgentWithLLM, generateCompletionWithTools } from '../llm/llmService';
import { AGENT_NAMES } from '../../../../constants/agentNames';
import { agentToolRegistry } from './agentToolRegistry';
import { agentMcpAdapter } from './agentMcpAdapter';
import type { Agent } from '../../../../types';
import { executeServerCommandAgent } from './serverCommandAgent';
import { executeAutoInspectionAgent } from './inspectionAgent';
import { executeDatabaseAdminAgent } from './databaseAdminAgent';

/**
 * 工具调用结果
 */
export interface ToolExecutionResult {
  success: boolean;
  toolId: string;
  result: string;
  error?: string;
}

/**
 * 从 LLM 响应中提取工具调用
 * 简单的解析器，实际项目中可能需要更复杂的解析
 */
export function extractToolCallFromResponse(response: string): {
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
export async function executeToolCall(toolId: string, args: Record<string, any>): Promise<ToolExecutionResult> {
  // 1. 先在旧工具注册表中查找
  const tool = agentToolRegistry.getTool(toolId);
  if (tool) {
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

  // 2. 在 MCP 工具注册表中查找
  const mcpResult = await agentMcpAdapter.executeTool(toolId, args);
  return mcpResult;
}

/**
 * 构建支持工具调用的系统提示
 */
export function buildSystemPromptWithTools(originalPrompt: string): string {
  const agentToolDescriptions = agentToolRegistry.generateToolDescriptions();
  const mcpToolDescriptions = agentMcpAdapter.generateToolDescriptions();

  const toolsSection = [
    agentToolDescriptions && `【SSH/系统/容器工具】\n${agentToolDescriptions}`,
    mcpToolDescriptions && `【MCP 运维工具（告警/服务器/网络/K8s/数据库等）】\n${mcpToolDescriptions}`,
  ].filter(Boolean).join('\n\n');

  return `${originalPrompt}

【可用工具】
${toolsSection}

【工具使用方式】
如果需要执行某个操作，可以用下面的格式调用工具：
[TOOL_CALL] tool_id: {"param1": "value1", "param2": "value2"}

示例：
[TOOL_CALL] ssh-exec: {"host": "192.168.1.100", "command": "uptime"}
[TOOL_CALL] alert.list: {"severity": "critical", "limit": 5}
[TOOL_CALL] server.list: {"limit": 10}

【注意】
- 每次最多调用 1 个工具
- 工具调用必须用 JSON 格式
- MCP 工具（以点号分隔，如 alert.list）用于查询运维数据
- SSH/系统工具用于执行底层操作
- 如果不需要调用工具，直接用自然语言回答即可
`;
}

const AGENT_EXECUTION_TIMEOUT = 300000; // 5 分钟

type AgentRow = Pick<Agent, 'id' | 'name'> & { system_prompt: string };

export function getAgent(agentId: string): AgentRow | undefined {
  return agentRepository.getNamePrompt(agentId) as AgentRow | undefined;
}

/** Agent 执行上下文（用户/系统传递的任意动态数据） */
export type AgentExecutionContext = Record<string, unknown>;

export async function executeAgentNode(
  agentId: string,
  input: string,
  context?: AgentExecutionContext
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

  // 其他 Agent - 支持原生 Function Calling
  logger.info(`🤖 Calling LLM for agent ${agentName} with native function calling`);
  
  let currentInput = input;
  const conversationHistory: { role: string; content: string }[] = [];
  const maxToolCalls = 5; // 最多 5 轮工具调用

  for (let i = 0; i < maxToolCalls; i++) {
    const response = await Promise.race([
      executeAgentNodeWithNativeFC(agent, currentInput, conversationHistory),
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
    conversationHistory.push({ role: 'user', content: currentInput });
    conversationHistory.push({ role: 'assistant', content: response });

    logger.info(`🔧 检测到工具调用: ${toolCall.toolId}`, toolCall.args);
    const toolResult = await executeToolCall(toolCall.toolId, toolCall.args || {});

    if (toolResult.success) {
      conversationHistory.push({ role: 'tool', content: toolResult.result });
      currentInput = `工具 [${toolCall.toolId}] 执行成功。请根据以下结果继续回答用户的问题：\n\n${toolResult.result}`;
    } else {
      conversationHistory.push({ role: 'tool', content: `错误: ${toolResult.error}` });
      currentInput = `工具 [${toolCall.toolId}] 执行失败: ${toolResult.error}。请告知用户并建议替代方案。`;
    }

    logger.info(`🔧 工具调用结果 (第 ${i + 1} 轮):`, currentInput.substring(0, 200));
  }

  // 工具调用次数用完
  logger.warn('⚠️ 工具调用次数用完，返回最后一次结果');
  return `多次尝试后未能完成任务，请重试或使用其他方式。`;
}

/**
 * 执行 Agent Node（原生 Function Calling 版本）
 * 
 * 与旧版 [TOOL_CALL] 文本解析的区别：
 * - 直接发送 OpenAI tools 参数给 LLM API
 * - LLM 返回原生 tool_calls（JSON 格式，100% 准确）
 * - 不需要正则解析，不需要 System Prompt 里拼工具描述
 * - 统一通过 agentMcpAdapter 执行所有工具（旧 + MCP 合并后的 44 个）
 */
async function executeAgentNodeWithNativeFC(
  agent: AgentRow | undefined,
  input: string,
  conversationHistory: { role: string; content: string }[]
): Promise<string> {
  if (!agent?.system_prompt) {
    return `Agent 配置缺失，请检查 Agent 配置。`;
  }

  const mcpTools = agentMcpAdapter.toOpenAITools();
  const hasTools = mcpTools.length > 0;
  
  logger.info(`🤖 [${agent.name}] Native FC: ${mcpTools.length} tools available`);

  try {
    const response = await generateCompletionWithTools(
      agent.system_prompt,
      input,
      agent.name || 'Agent',
      0.7,
      agent.id,
      hasTools ? mcpTools : undefined,
      undefined,
      conversationHistory.map(h => ({
        role: h.role as 'user' | 'assistant' | 'tool',
        content: h.content,
      }))
    );

    // 如果有工具调用，返回格式化文本供 executeAgentNode 循环处理
    if (response.toolCalls && response.toolCalls.length > 0) {
      const tc = response.toolCalls[0];
      // 返回 [TOOL_CALL] 格式以兼容现有的循环逻辑
      // 原生 FC 的 JSON 参数已由 LLM 保证合法
      return `[TOOL_CALL] ${tc.function.name}: ${tc.function.arguments}\n\n${response.content}`;
    }

    return response.content || '';
  } catch (error) {
    logger.error(`❌ [${agent.name}] Native FC failed, falling back to text-only:`, error);
    // 降级：无工具调用
    return executeAgentWithLLM(agent.id, input);
  }
}

/**
 * 执行 Agent Node（支持工具调用的版本 - 旧版文本解析，已废弃）
 * @deprecated 请使用 executeAgentNodeWithNativeFC
 */
export async function _executeAgentNodeWithTools(
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