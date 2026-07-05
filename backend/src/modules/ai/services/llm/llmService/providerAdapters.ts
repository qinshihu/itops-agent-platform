/**
 * Provider 适配器模块
 *
 * 包含：
 *   - 共享类型定义（ChatMessage / LLMTool / ToolCall / LLMResponse / LLMProviderConfig）
 *   - 各 Provider 的配置常量（Doubao / OpenAI / LocalAI）
 *   - 通用 API 调用 callLLMAPI（纯文本）
 *   - 公开适配器 callDoubaoAPI / callOpenAIAPI / callLocalAIAPI
 *   - 模型池调度 buildProviderConfig / callModelWithConfig
 *   - Provider 推断 getProviderForModel
 *   - 执行记录 recordAgentExecution / updateAgentStats
 *   - 可用性检查 checkLLMAvailability
 *
 * 依赖方向：circuitBreaker.ts → 本模块
 */

import axios from 'axios';
import { agentExecutionRepository, agentRepository } from '../../../../../repositories';
import { logger } from '../../../../../utils/logger';
import crypto from 'crypto';
import { getApiKey, getModelId, getApiBase, buildApiEndpoint } from '../../../../../utils/apiConfig';
import type { AIModel } from '../../models/aiModelService';
import { getCircuitBreaker, callWithRetry, circuitBreakers } from './circuitBreaker';

// ── 共享类型（同时被 toolCalling.ts 使用） ──

// ── 语义化类型别名 ──

/** OpenAI Function Calling 参数 Schema */
type OpenAIFunctionParameters = Record<string, unknown>;
/** Agent 执行元数据 */
type AgentExecutionMetadata = Record<string, unknown>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/** OpenAI function calling 工具定义 */
export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: OpenAIFunctionParameters;
  };
}

/** LLM 返回的工具调用 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/** LLM 响应（含工具调用） */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

// ── 通用 Provider 配置接口 ──

export interface LLMProviderConfig {
  providerName: string;
  apiKeySetting: string;
  apiKeyEnv: string;
  apiBaseSetting: string;
  apiBaseEnv: string;
  defaultApiBase: string;
  modelSetting: string;
  modelEnv: string;
  defaultModel: string;
  placeholderKey: string;
}

// ── Provider 配置常量 ──

export const DOUBAO_CONFIG: LLMProviderConfig = {
  providerName: 'Doubao',
  apiKeySetting: 'DOUBAO_API_KEY',
  apiKeyEnv: 'DOUBAO_API_KEY',
  apiBaseSetting: 'DOUBAO_API_BASE',
  apiBaseEnv: 'DOUBAO_API_BASE',
  defaultApiBase: 'https://ark.cn-beijing.volces.com/api/v3',
  modelSetting: 'DOUBAO_MODEL',
  modelEnv: 'DOUBAO_MODEL',
  defaultModel: 'doubao-4o',
  placeholderKey: 'your-doubao-api-key-here'
};

export const OPENAI_CONFIG: LLMProviderConfig = {
  providerName: 'OpenAI',
  apiKeySetting: 'OPENAI_API_KEY',
  apiKeyEnv: 'OPENAI_API_KEY',
  apiBaseSetting: 'OPENAI_API_BASE',
  apiBaseEnv: 'OPENAI_API_BASE',
  defaultApiBase: 'https://api.openai.com/v1',
  modelSetting: 'OPENAI_MODEL',
  modelEnv: 'OPENAI_MODEL',
  defaultModel: 'gpt-4o',
  placeholderKey: 'your-openai-api-key-here'
};

export const LOCAL_AI_CONFIG: LLMProviderConfig = {
  providerName: 'LocalAI',
  apiKeySetting: 'LOCAL_AI_API_KEY',
  apiKeyEnv: 'LOCAL_AI_API_KEY',
  apiBaseSetting: 'LOCAL_AI_API_BASE',
  apiBaseEnv: 'LOCAL_AI_API_BASE',
  defaultApiBase: 'http://host.docker.internal:11434/v1', // Ollama 默认地址
  modelSetting: 'LOCAL_AI_MODEL',
  modelEnv: 'LOCAL_AI_MODEL',
  defaultModel: 'qwen2.5:7b', // Ollama 默认模型
  placeholderKey: '' // 本地模型通常不需要 API Key
};

// ── 执行记录 ──

export function recordAgentExecution(
  agentId: string,
  agentName: string,
  inputText: string,
  outputText: string,
  status: 'success' | 'failure',
  errorMessage?: string,
  executionTimeMs?: number,
  metadata?: AgentExecutionMetadata
): void {
  try {
    agentExecutionRepository.create({
      id: crypto.randomUUID(),
      agentId,
      agentName,
      inputText,
      outputText,
      status,
      errorMessage: errorMessage || null,
      executionTimeMs: executionTimeMs ?? null,
      metadata: metadata ?? null,
    });
  } catch (error) {
    logger.error('Failed to record agent execution:', error);
  }
}

export function updateAgentStats(agentId: string): void {
  try {
    agentRepository.incrementUsageStats(agentId);
  } catch (error) {
    logger.error('Failed to update agent stats:', error);
  }
}

// ── 通用 LLM API 调用（纯文本） ──

/**
 * 通用的LLM API调用函数
 * @param signal 可选 AbortSignal，用于在多 Agent 编排中实现整体截止时间控制
 */
export async function callLLMAPI(
  config: LLMProviderConfig,
  systemPrompt: string,
  userInput: string,
  agentName: string,
  temperature: number,
  agentId: string,
  signal?: AbortSignal
): Promise<string> {
  const startTime = Date.now();
  const apiKey = getApiKey(config.apiKeySetting, config.apiKeyEnv);
  const apiBase = getApiBase(config.apiBaseSetting, config.apiBaseEnv, config.defaultApiBase);
  const model = getModelId(config.modelSetting, config.modelEnv, config.defaultModel);

  // 检查 API Key 配置（本地模型通常不需要 API Key）
  if (config.providerName !== 'LocalAI' && (!apiKey || apiKey === config.placeholderKey)) {
    const errorMsg = `${config.providerName}_API_KEY not configured - please configure API key in Settings page`;
    logger.error(`❌ [${agentName}] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // 检查熔断器
  const breaker = getCircuitBreaker(config.providerName);
  if (!breaker.canCall()) {
    const errorMsg = 'Circuit breaker is OPEN, rejecting request - service temporarily unavailable';
    logger.error(`🔌 [${agentName}] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    logger.info(`🤖 [${agentName}] Calling ${config.providerName} API...`);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ];

    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: 2048
    };

    // 检查并清理 API 地址
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
      const content = response.data.choices[0].message.content;
      logger.info(`✅ [${agentName}] ${config.providerName} API call successful, response length: ${content?.length || 0} chars`);

      recordAgentExecution(
        agentId,
        agentName,
        userInput,
        content || '',
        'success',
        undefined,
        Date.now() - startTime,
        { tokens: response.data.usage }
      );

      return content || '';
    } else {
      throw new Error('API returned empty choices');
    }
  } catch (error: unknown) {
    circuitBreakers.get(config.providerName)?.recordFailure();

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [${agentName}] ${config.providerName} API call failed:`, errorMessage);

    const axiosError = error as { response?: { status?: number; data?: unknown } };
    if (axiosError.response?.status === 401) {
      throw new Error('Invalid API key - please check your configuration');
    } else if (axiosError.response?.status === 429) {
      throw new Error('Rate limit exceeded - please try again later');
    } else if (axiosError.response?.status && axiosError.response.status >= 500) {
      throw new Error('Server error - please try again later');
    } else {
      throw new Error(`LLM call failed: ${errorMessage}`);
    }
  }
}

// ── 公开适配器 ──

/**
 * 调用豆包 API 获取响应
 * @param signal 可选 AbortSignal，用于多 Agent 编排整体截止时间控制
 */
export async function callDoubaoAPI(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  signal?: AbortSignal
): Promise<string> {
  return callLLMAPI(DOUBAO_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, signal);
}

/**
 * 调用 OpenAI API 获取响应
 * @param signal 可选 AbortSignal，用于多 Agent 编排整体截止时间控制
 */
export async function callOpenAIAPI(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  signal?: AbortSignal
): Promise<string> {
  return callLLMAPI(OPENAI_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, signal);
}

/**
 * 调用本地 AI 大模型获取响应
 * @param signal 可选 AbortSignal，用于多 Agent 编排整体截止时间控制
 */
export async function callLocalAIAPI(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  signal?: AbortSignal
): Promise<string> {
  return callLLMAPI(LOCAL_AI_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, signal);
}

// ── 模型池调度 ──

/**
 * 根据 AIModel 的 provider_type 构建 LLMProviderConfig
 * 供 callModelWithConfig 与 generateCompletionWithTools 共用
 */
export function buildProviderConfig(model: AIModel): LLMProviderConfig {
  const providerNameMap: Record<string, string> = {
    volcengine: 'Doubao',
    openai: 'OpenAI',
    aliyun: 'Aliyun',
    deepseek: 'DeepSeek',
    zhipu: 'Zhipu',
    local: 'LocalAI',
  };

  const defaultApiBaseMap: Record<string, string> = {
    volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
    openai: 'https://api.openai.com/v1',
    aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    deepseek: 'https://api.deepseek.com/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    local: 'http://host.docker.internal:11434/v1',
  };

  const providerName = providerNameMap[model.provider_type] || model.provider_type;
  const defaultApiBase = defaultApiBaseMap[model.provider_type] || '';

  return {
    providerName,
    apiKeySetting: `${providerName.toUpperCase()}_API_KEY`,
    apiKeyEnv: `${providerName.toUpperCase()}_API_KEY`,
    apiBaseSetting: `${providerName.toUpperCase()}_API_BASE`,
    apiBaseEnv: `${providerName.toUpperCase()}_API_BASE`,
    defaultApiBase: model.api_base || defaultApiBase,
    modelSetting: `${providerName.toUpperCase()}_MODEL`,
    modelEnv: `${providerName.toUpperCase()}_MODEL`,
    defaultModel: model.model_id,
    placeholderKey: model.provider_type === 'local' ? '' : `your-${model.provider_type}-api-key-here`,
  };
}

/**
 * 根据 AI 模型池中的模型配置调用 LLM API
 * 动态构建 LLMProviderConfig，支持任意 provider_type
 */
export async function callModelWithConfig(
  model: AIModel,
  systemPrompt: string,
  userInput: string,
  agentName: string,
  temperature: number,
  agentId: string,
  signal?: AbortSignal
): Promise<string> {
  const config = buildProviderConfig(model);

  // 临时覆盖：如果 AIModel 中配置了 api_base，使用它
  if (model.api_base) {
    logger.info(`🔧 [${agentName}] Using custom api_base from model config: ${model.api_base}`);
  }

  return callLLMAPI(config, systemPrompt, userInput, agentName, temperature, agentId, signal);
}

// ── Provider 推断 ──

/**
 * 判断模型属于哪个API提供商（用于向后兼容）
 * @param modelId 模型ID
 * @returns 提供商名称
 */
export function getProviderForModel(modelId: string): 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local' {
  if (!modelId) return 'local';

  // 火山引擎关键词
  const volcengineKeywords = ['doubao', 'volcengine', 'ark'];
  for (const keyword of volcengineKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'volcengine';
    }
  }

  // DeepSeek 关键词
  const deepseekKeywords = ['deepseek'];
  for (const keyword of deepseekKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'deepseek';
    }
  }

  // 阿里云关键词
  const aliyunKeywords = ['qwen', '通义'];
  for (const keyword of aliyunKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'aliyun';
    }
  }

  // 智谱关键词
  const zhipuKeywords = ['glm-', 'chatglm'];
  for (const keyword of zhipuKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'zhipu';
    }
  }

  // OpenAI 关键词
  const openaiKeywords = ['gpt', 'dall-e', 'text-', 'o1', 'o3'];
  for (const keyword of openaiKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'openai';
    }
  }

  // 其他开源模型关键词
  const localKeywords = [
    'llama', 'mistral', 'yi', 'baichuan',
    'phi', 'gemma', 'falcon', 'vicuna', 'zephyr',
    'wizardlm', 'openhermes', 'neural', 'tinyllama', 'stablelm', 'orca'
  ];
  for (const keyword of localKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'local';
    }
  }

  return 'local'; // 未识别的模型默认尝试本地
}

// ── 可用性检查 ──

/**
 * 检查 LLM 服务是否可用
 */
export async function checkLLMAvailability(): Promise<{ available: boolean; message: string; provider?: 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local' }> {
  // 优先级：火山引擎 > 豆包(兼容旧配置) > 本地 AI > OpenAI
  // 1. 检查火山引擎 API
  const volcengineApiKey = getApiKey( 'VOLCENGINE_API_KEY', 'VOLCENGINE_API_KEY');

  if (volcengineApiKey && volcengineApiKey !== 'your-volcengine-api-key-here') {
    const breaker = getCircuitBreaker('VolcEngine');
    if (breaker.canCall()) {
      return { available: true, message: 'VolcEngine API available', provider: 'volcengine' };
    }
  }

  // 2. 兼容旧配置：检查豆包 API（向后兼容）
  const doubaoApiKey = getApiKey('DOUBAO_API_KEY', 'DOUBAO_API_KEY');

  if (doubaoApiKey && doubaoApiKey !== 'your-doubao-api-key-here') {
    const breaker = getCircuitBreaker('Doubao');
    if (breaker.canCall()) {
      return { available: true, message: 'Doubao API available', provider: 'volcengine' };
    }
  }

  // 2. 检查本地 AI 大模型
  try {
    const _localApiKey = getApiKey('LOCAL_AI_API_KEY', 'LOCAL_AI_API_KEY');
    const localApiBase = getApiBase('LOCAL_AI_API_BASE', 'LOCAL_AI_API_BASE', 'http://host.docker.internal:11434/v1');
    if (localApiBase && !localApiBase.includes('your-local-ai')) {
      const breaker = getCircuitBreaker('LocalAI');
      if (breaker.canCall()) {
        // 本地模型通常不需要 API Key，只要有地址即可
        return { available: true, message: 'Local AI available', provider: 'local' };
      }
    }
  } catch {
    // 忽略本地 AI 检查错误
  }

  // 3. 检查 OpenAI
  const openaiApiKey = getApiKey('OPENAI_API_KEY', 'OPENAI_API_KEY');

  if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
    const breaker = getCircuitBreaker('OpenAI');
    if (breaker.canCall()) {
      return { available: true, message: 'OpenAI API available', provider: 'openai' };
    }
  }

  return { available: false, message: 'No LLM service configured' };
}
