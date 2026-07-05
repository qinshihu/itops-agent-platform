/**
 * llmService — 统一入口（barrel + 核心编排）
 *
 * 本文件是 llmService 模块的对外门面，保持与拆分前的 llmService.ts 完全相同的导出接口。
 * 外部引用 `import { ... } from './llmService'` 无需改动。
 *
 * 内部结构：
 *   - circuitBreaker.ts：熔断器 + callWithRetry
 *   - providerAdapters.ts：Provider 配置 + 纯文本 API 调用
 *   - toolCalling.ts：工具调用（Function Calling）API
 *   - index.ts：generateCompletion + executeAgentWithLLM + barrel
 *
 * 依赖方向：circuitBreaker ← providerAdapters ← toolCalling ← index
 */

import { agentRepository } from '../../../../../repositories';
import { logger } from '../../../../../utils/logger';
import { qanythingService } from '../../knowledge/qanythingService';
import * as aiModelService from '../../models/aiModelService';
import {
  callModelWithConfig,
  callDoubaoAPI,
  callOpenAIAPI,
  callLocalAIAPI,
  getProviderForModel,
  updateAgentStats,
} from './providerAdapters';

// ── 核心编排 ──

/**
 * 通用的 LLM 完成生成函数
 * @param prompt 用户提示词
 * @param systemPrompt 系统提示词（可选）
 * @param temperature 温度参数
 * @param model 模型ID（可选）
 * @param agentId Agent ID
 * @param agentName Agent 名称（用于日志）
 */
export async function generateCompletion(
  prompt: string,
  systemPrompt = '你是一个专业的助手。',
  temperature = 0.7,
  model?: string,
  agentId = '',
  agentName = 'LLM'
): Promise<string> {
  const timeoutMs = 120000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`LLM generateCompletion 超时 (${timeoutMs / 1000}s)`)), timeoutMs);
  });

  // 优先使用 AI 模型池中的默认模型
  const defaultModel = aiModelService.getDefaultModel();
  if (defaultModel?.enabled) {
    logger.info(`🤖 [generateCompletion] Using default model from AI Model Pool: ${defaultModel.name} (${defaultModel.provider_type})`);
    return Promise.race([
      callModelWithConfig(defaultModel, systemPrompt, prompt, agentName, temperature, agentId),
      timeoutPromise
    ]);
  }

  // 如果没有配置模型池，回退到旧逻辑
  const provider = model ? getProviderForModel(model) : 'local';
  logger.info(`🤖 [generateCompletion] No AI Model Pool configured, falling back to legacy mode, provider: ${provider}`);

  const executeCompletion = async (): Promise<string> => {
    if (provider === 'local') {
      try {
        logger.info('🏠 Trying Local AI first...');
        return await callLocalAIAPI(systemPrompt, prompt, agentName, temperature, agentId);
      } catch (localError) {
        logger.warn(`⚠️ Local AI failed, falling back to Doubao: ${localError instanceof Error ? localError.message : 'Unknown error'}`);
        return await callDoubaoAPI(systemPrompt, prompt, agentName, temperature, agentId);
      }
    }

    if (provider === 'openai') {
      return await callOpenAIAPI(
        systemPrompt,
        prompt,
        agentName,
        temperature,
        agentId
      );
    } else {
      return await callDoubaoAPI(
        systemPrompt,
        prompt,
        agentName,
        temperature,
        agentId
      );
    }
  };

  return Promise.race([executeCompletion(), timeoutPromise]);
}

/**
 * 获取 Agent 的配置并调用 LLM
 * @param agentId Agent ID
 * @param userInput 用户输入
 */
export async function executeAgentWithLLM(
  agentId: string,
  userInput: string
): Promise<string> {
  const agent = agentRepository.getLlmConfig(agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  updateAgentStats(agentId);

  // 优先使用 QAnything 检索知识库
  let knowledgeContext = '';
  try {
    if (qanythingService.isEnabled()) {
      logger.info('🔍 Using QAnything for knowledge retrieval...');
      knowledgeContext = await qanythingService.queryKnowledge(userInput, qanythingService.getTopK());
    }
  } catch (error) {
    logger.warn('️ QAnything query failed, proceeding without knowledge context:', error);
  }

  // 构建增强 System Prompt
  let enhancedSystemPrompt = agent.system_prompt || `你是一个专业的${agent.name || 'IT运维'}助手。`;

  if (knowledgeContext) {
    enhancedSystemPrompt += `\n\n【相关知识库内容】\n${knowledgeContext}\n\n`;
    enhancedSystemPrompt += '请基于以上知识库内容回答用户问题。如果知识库内容不足以回答问题，请结合你的专业知识进行补充。\n\n';
  }

  const temperature = agent.temperature || 0.7;

  // 尝试主模型
  if (agent.primary_model_id) {
    try {
      const primaryModel = aiModelService.getModelById(agent.primary_model_id);
      if (primaryModel?.enabled) {
        return await callModelWithConfig(
          primaryModel,
          enhancedSystemPrompt,
          userInput,
          agent.name,
          temperature,
          agentId
        );
      }
    } catch (error) {
      logger.warn(`⚠️ 主模型执行失败，尝试备选模型: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // fallthrough to fallback
    }
  }

  // 尝试备选模型
  if (agent.fallback_model_id) {
    try {
      const fallbackModel = aiModelService.getModelById(agent.fallback_model_id);
      if (fallbackModel?.enabled) {
        return await callModelWithConfig(
          fallbackModel,
          enhancedSystemPrompt,
          userInput,
          agent.name,
          temperature,
          agentId
        );
      }
    } catch (error) {
      logger.warn(`⚠️ 备选模型执行失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // fallthrough to default
    }
  }

  // 降级到默认模型
  const defaultModel = aiModelService.getDefaultModel();
  if (defaultModel) {
    try {
      return await callModelWithConfig(
        defaultModel,
        enhancedSystemPrompt,
        userInput,
        agent.name,
        temperature,
        agentId
      );
    } catch (error) {
      logger.warn(`⚠️ 默认模型执行失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 向后兼容：使用旧的 api_provider 方式
  // 注意：旧的 'doubao' 现在映射到 'volcengine'
  const provider = agent.api_provider || 'volcengine';
  const normalizedProvider = provider === 'doubao' ? 'volcengine' : provider;

  if (normalizedProvider === 'openai') {
    return await callOpenAIAPI(
      enhancedSystemPrompt,
      userInput,
      agent.name,
      temperature,
      agentId
    );
  } else if (normalizedProvider === 'local') {
    return await callLocalAIAPI(
      enhancedSystemPrompt,
      userInput,
      agent.name,
      temperature,
      agentId
    );
  } else {
    // 火山引擎、阿里云、DeepSeek、智谱都使用 OpenAI 兼容格式
    // 这里使用 DoubaoAPI 作为默认（因为它的地址就是火山引擎的地址）
    return await callDoubaoAPI(
      enhancedSystemPrompt,
      userInput,
      agent.name,
      temperature,
      agentId
    );
  }
}

// ── Barrel: 重导出所有公开 API（保持与原 llmService.ts 接口兼容） ──

// 类型
export type { LLMTool, ToolCall, LLMResponse, ChatMessage } from './providerAdapters';

// 熔断器
export { startCircuitBreakerCleanup, stopCircuitBreakerCleanup, getCircuitBreakerStats } from './circuitBreaker';
export { getCircuitBreaker, circuitBreakers } from './circuitBreaker';

// Provider 适配器（纯文本）
export { callDoubaoAPI, callOpenAIAPI, callLocalAIAPI, checkLLMAvailability } from './providerAdapters';

// 工具调用
export { callDoubaoAPIWithTools, callOpenAIAPIWithTools, generateCompletionWithTools } from './toolCalling';
