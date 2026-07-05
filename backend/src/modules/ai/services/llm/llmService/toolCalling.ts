/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 工具调用（Function Calling）模块
 *
 * 包含：
 *   - 通用 API 调用 callLLMAPIWithTools（带工具）
 *   - 公开适配器 callDoubaoAPIWithTools / callOpenAIAPIWithTools
 *   - 模型池调度 callModelWithConfigWithTools
 *   - 统一入口 generateCompletionWithTools
 *
 * 依赖方向：circuitBreaker.ts → providerAdapters.ts → 本模块
 */

import axios from 'axios';
import { logger } from '../../../../../utils/logger';
import { getApiKey, getModelId, getApiBase, buildApiEndpoint } from '../../../../../utils/apiConfig';
import * as aiModelService from '../../models/aiModelService';
import type { AIModel } from '../../models/aiModelService';
import { getCircuitBreaker, callWithRetry, circuitBreakers } from './circuitBreaker';
import {
  type ChatMessage,
  type LLMTool,
  type ToolCall,
  type LLMResponse,
  type LLMProviderConfig,
  DOUBAO_CONFIG,
  OPENAI_CONFIG,
  recordAgentExecution,
  buildProviderConfig,
} from './providerAdapters';

// Re-export types for convenience（barrel 也会 re-export，这里仅为本模块内部引用方便）
export type { LLMTool, ToolCall, LLMResponse, ChatMessage };

// ── 语义化类型别名 ──

/** LLM API 请求体 */
type LLMAPIRequest = Record<string, unknown>;

// ── 通用 LLM API 调用（带工具） ──

/**
 * 调用 LLM API - 支持原生 Function Calling
 *
 * 与 callLLMAPI 的区别：
 * - 请求中包含 tools 参数（OpenAI function calling 格式）
 * - 返回 LLMResponse（可能包含 tool_calls）
 * - LLM 选择调用工具时返回 toolCalls，否则返回 content
 *
 * @param tools OpenAI 格式的工具列表，传 undefined 则退化为纯文本调用
 */
export async function callLLMAPIWithTools(
  config: LLMProviderConfig,
  systemPrompt: string,
  userInput: string,
  agentName: string,
  temperature: number,
  agentId: string,
  tools?: LLMTool[],
  signal?: AbortSignal,
  previousMessages?: ChatMessage[]
): Promise<LLMResponse> {
  const startTime = Date.now();
  const apiKey = getApiKey(config.apiKeySetting, config.apiKeyEnv);
  const apiBase = getApiBase(config.apiBaseSetting, config.apiBaseEnv, config.defaultApiBase);
  const model = getModelId(config.modelSetting, config.modelEnv, config.defaultModel);

  if (config.providerName !== 'LocalAI' && (!apiKey || apiKey === config.placeholderKey)) {
    const errorMsg = `${config.providerName}_API_KEY not configured`;
    logger.error(`❌ [${agentName}] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const breaker = getCircuitBreaker(config.providerName);
  if (!breaker.canCall()) {
    throw new Error('Circuit breaker is OPEN');
  }

  try {
    logger.info(`🤖 [${agentName}] Calling ${config.providerName} API (tools: ${tools?.length || 0})...`);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(previousMessages || []),
      { role: 'user', content: userInput }
    ];

    const requestBody: LLMAPIRequest = {
      model,
      messages,
      temperature,
      max_tokens: 2048,
    };

    // 如果有工具定义，加入请求
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    let finalApiBase = apiBase;
    if (finalApiBase.includes('/chat/completions')) {
      finalApiBase = finalApiBase.replace('/chat/completions', '');
    }

    const response = await callWithRetry(
      (s?: AbortSignal) =>
        axios.post(
          buildApiEndpoint(finalApiBase, 'chat/completions'),
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 60000,
            signal: s,
          }
        ),
      3,
      1000,
      10000,
      breaker,
      signal
    );

    circuitBreakers.get(config.providerName)?.recordSuccess();

    if (response.data.choices && response.data.choices.length > 0) {
      const choice = response.data.choices[0];
      const message = choice.message;
      const finishReason = choice.finish_reason || 'stop';

      // 检查是否有 tool_calls
      const toolCalls: ToolCall[] | undefined = message.tool_calls?.length > 0
        ? message.tool_calls.map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }))
        : undefined;

      const content = message.content || '';

      logger.info(
        `✅ [${agentName}] API success, finish: ${finishReason}, ` +
        `content: ${content.length} chars, toolCalls: ${toolCalls?.length || 0}`
      );

      recordAgentExecution(
        agentId,
        agentName,
        userInput,
        toolCalls ? `[tool_calls: ${toolCalls.map(t => t.function.name).join(', ')}]` : content,
        'success',
        undefined,
        Date.now() - startTime,
        { tokens: response.data.usage }
      );

      return {
        content,
        toolCalls,
        finishReason: finishReason as LLMResponse['finishReason'],
      };
    } else {
      throw new Error('API returned empty choices');
    }
  } catch (error: unknown) {
    circuitBreakers.get(config.providerName)?.recordFailure();
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [${agentName}] API with tools failed:`, errorMessage);
    throw error;
  }
}

// ── 公开适配器（带工具） ──

/**
 * 调用豆包 API（支持 Function Calling）
 */
export async function callDoubaoAPIWithTools(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  tools?: LLMTool[],
  signal?: AbortSignal,
  previousMessages?: ChatMessage[]
): Promise<LLMResponse> {
  return callLLMAPIWithTools(DOUBAO_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, tools, signal, previousMessages);
}

/**
 * 调用 OpenAI API（支持 Function Calling）
 */
export async function callOpenAIAPIWithTools(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  tools?: LLMTool[],
  signal?: AbortSignal,
  previousMessages?: ChatMessage[]
): Promise<LLMResponse> {
  return callLLMAPIWithTools(OPENAI_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, tools, signal, previousMessages);
}

// ── 模型池调度（带工具） ──

/**
 * 根据 AI 模型池中的模型配置调用 LLM API（带工具调用）
 * 动态构建 LLMProviderConfig，复用 callLLMAPIWithTools
 */
export async function callModelWithConfigWithTools(
  model: AIModel,
  systemPrompt: string,
  userInput: string,
  agentName: string,
  temperature: number,
  agentId: string,
  tools?: LLMTool[],
  signal?: AbortSignal,
  previousMessages?: ChatMessage[]
): Promise<LLMResponse> {
  const config = buildProviderConfig(model);

  if (model.api_base) {
    logger.info(`🔧 [${agentName}] Using custom api_base from model config: ${model.api_base}`);
  }

  return callLLMAPIWithTools(config, systemPrompt, userInput, agentName, temperature, agentId, tools, signal, previousMessages);
}

// ── 统一入口 ──

/**
 * 通用的 LLM 完成生成函数（带工具调用 / Function Calling）
 *
 * 与 generateCompletion 对应：当调用方需要 LLM 返回原生 tool_calls 时使用本函数。
 * 优先使用 AI 模型池中的默认模型；若未配置则回退到 callDoubaoAPIWithTools（豆包）。
 *
 * @param systemPrompt 系统提示词
 * @param userInput 用户输入
 * @param agentName Agent 名称（用于日志标识）
 * @param temperature 温度参数
 * @param agentId Agent ID（用于执行记录）
 * @param tools OpenAI function calling 工具定义数组
 * @param signal 可选 AbortSignal，用于多 Agent 编排整体截止时间控制
 * @param previousMessages 历史对话消息（用于多轮工具调用）
 */
export async function generateCompletionWithTools(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  tools?: LLMTool[],
  signal?: AbortSignal,
  previousMessages?: ChatMessage[]
): Promise<LLMResponse> {
  const timeoutMs = 120000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`LLM generateCompletionWithTools 超时 (${timeoutMs / 1000}s)`)), timeoutMs);
  });

  // 优先使用 AI 模型池中的默认模型
  const defaultModel = aiModelService.getDefaultModel();
  if (defaultModel?.enabled) {
    logger.info(`🤖 [generateCompletionWithTools] Using default model from AI Model Pool: ${defaultModel.name} (${defaultModel.provider_type})`);
    return Promise.race([
      callModelWithConfigWithTools(
        defaultModel,
        systemPrompt,
        userInput,
        agentName,
        temperature,
        agentId,
        tools,
        signal,
        previousMessages
      ),
      timeoutPromise
    ]);
  }

  // 未配置模型池，回退到豆包
  logger.info(`🤖 [generateCompletionWithTools] No AI Model Pool configured, falling back to Doubao (legacy)`);
  return Promise.race([
    callDoubaoAPIWithTools(systemPrompt, userInput, agentName, temperature, agentId, tools, signal, previousMessages),
    timeoutPromise
  ]);
}
