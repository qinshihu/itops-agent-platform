import axios from 'axios';
import db from '../../../models/database';
import { logger } from '../../../utils/logger';
import crypto from 'crypto';
import { getApiKey, getModelId, getApiBase, buildApiEndpoint } from '../../../utils/apiConfig';
import { qanythingService } from './qanythingService.ts';
import * as aiModelService from './aiModelService.ts';
import type { AIModel } from './aiModelService.ts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}



// 熔断状态接口
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  lastUsedTime: number;
  isOpen: boolean;
  halfOpenAttempts: number;
  maxHalfOpenAttempts: number;
}

// 简单的熔断器实现
class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    lastUsedTime: Date.now(),
    isOpen: false,
    halfOpenAttempts: 0,
    maxHalfOpenAttempts: 3
  };
  
  constructor(
    private readonly maxFailures = 5,
    private readonly resetTimeout = 60000
  ) {}
  
  canCall(): boolean {
    this.state.lastUsedTime = Date.now();
    
    if (this.state.isOpen) {
      const now = Date.now();
      if (now - this.state.lastFailureTime > this.resetTimeout) {
        if (this.state.halfOpenAttempts >= this.state.maxHalfOpenAttempts) {
          logger.info('🔌 Circuit breaker half-open limit reached, still blocking');
          return false;
        }
        logger.info('🔄 Circuit breaker half-open, allowing test request');
        this.state.halfOpenAttempts++;
        return true;
      }
      return false;
    }
    return true;
  }
  
  recordSuccess(): void {
    this.state.failures = 0;
    this.state.isOpen = false;
    this.state.halfOpenAttempts = 0;
    this.state.lastUsedTime = Date.now();
  }
  
  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();
    this.state.lastUsedTime = Date.now();
    if (this.state.failures >= this.maxFailures) {
      logger.info('🔌 Circuit breaker opened due to too many failures');
      this.state.isOpen = true;
      this.state.halfOpenAttempts = 0;
    }
  }
  
  getLastUsedTime(): number {
    return this.state.lastUsedTime;
  }
  
  isIdle(idleThresholdMs: number): boolean {
    return Date.now() - this.state.lastUsedTime > idleThresholdMs;
  }
}

// 熔断器配置常量
const CIRCUIT_BREAKER_IDLE_THRESHOLD = 60 * 60 * 1000; // 1 小时未使用则清理
const CIRCUIT_BREAKER_CLEANUP_INTERVAL = 30 * 60 * 1000; // 每 30 分钟清理一次
const MAX_CIRCUIT_BREAKERS = 100; // 最大熔断器实例数量

// 按 Provider 拆分的熔断器实例
const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(providerName: string): CircuitBreaker {
  if (!circuitBreakers.has(providerName)) {
    enforceCircuitBreakerLimit();
    circuitBreakers.set(providerName, new CircuitBreaker());
    logger.info(`🔌 Circuit breaker initialized for provider: ${providerName}, total: ${circuitBreakers.size}`);
  }
  return circuitBreakers.get(providerName)!;
}

function enforceCircuitBreakerLimit(): void {
  if (circuitBreakers.size >= MAX_CIRCUIT_BREAKERS) {
    const entries = Array.from(circuitBreakers.entries());
    entries.sort((a, b) => a[1].getLastUsedTime() - b[1].getLastUsedTime());
    const toRemove = entries.slice(0, Math.ceil(entries.length / 2));
    toRemove.forEach(([provider]) => {
      circuitBreakers.delete(provider);
    });
    logger.info(`🔌 Cleaned up ${toRemove.length} idle circuit breakers due to limit reached`);
  }
}

function cleanupIdleCircuitBreakers(): void {
  const idleProviders: string[] = [];
  for (const [provider, breaker] of circuitBreakers.entries()) {
    if (breaker.isIdle(CIRCUIT_BREAKER_IDLE_THRESHOLD)) {
      idleProviders.push(provider);
    }
  }
  
  if (idleProviders.length > 0) {
    idleProviders.forEach(provider => {
      circuitBreakers.delete(provider);
    });
    logger.info(`🔌 Cleaned up ${idleProviders.length} idle circuit breakers, remaining: ${circuitBreakers.size}`);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCircuitBreakerCleanup(): void {
  if (cleanupInterval) {
    return;
  }
  
  cleanupInterval = setInterval(() => {
    cleanupIdleCircuitBreakers();
  }, CIRCUIT_BREAKER_CLEANUP_INTERVAL);
  
  cleanupInterval.unref();
  logger.info('🔌 Circuit breaker cleanup scheduler started');
}

export function stopCircuitBreakerCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('🔌 Circuit breaker cleanup scheduler stopped');
  }
}

export function getCircuitBreakerStats(): { total: number; cleanupIntervalMin: number; idleThresholdHour: number; maxLimit: number } {
  return {
    total: circuitBreakers.size,
    cleanupIntervalMin: CIRCUIT_BREAKER_CLEANUP_INTERVAL / 60000,
    idleThresholdHour: CIRCUIT_BREAKER_IDLE_THRESHOLD / 3600000,
    maxLimit: MAX_CIRCUIT_BREAKERS
  };
}

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 带重试的 API 调用
async function callWithRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 10000,
  breaker?: CircuitBreaker,
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Request cancelled by deadline signal');
    }
    if (breaker && !breaker.canCall()) {
      logger.error('🔌 Circuit breaker is OPEN, aborting retries');
      throw new Error('Circuit breaker is OPEN, rejecting request - service temporarily unavailable');
    }

    try {
      const result = await fn(signal);
      if (attempt > 1) {
        logger.info(`✅ Request succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error: any) {
      if (error.name === 'CanceledError' || signal?.aborted) {
        throw new Error('Request cancelled by deadline signal');
      }
      lastError = error as Error;
      logger.warn(`⚠️ Request attempt ${attempt} failed: ${lastError.message}`);
      
      if (attempt < maxRetries) {
        const delayMs = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        logger.info(`⏳ Waiting ${delayMs}ms before retry...`);
        await delay(delayMs + Math.random() * baseDelay);
      }
    }
  }
  
  logger.error(`❌ All ${maxRetries} retries failed`);
  throw lastError;
}

// 记录 Agent 执行历史
function recordAgentExecution(
  agentId: string,
  agentName: string,
  inputText: string,
  outputText: string,
  status: 'success' | 'failure',
  errorMessage?: string,
  executionTimeMs?: number,
  metadata?: Record<string, unknown>
): void {
  try {
    db.prepare(`
      INSERT INTO agent_executions (
        id, agent_id, agent_name, input_text, output_text, status, error_message, execution_time_ms, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      agentId,
      agentName,
      inputText,
      outputText,
      status,
      errorMessage || null,
      executionTimeMs || null,
      metadata ? JSON.stringify(metadata) : null
    );
  } catch (error) {
    logger.error('Failed to record agent execution:', error);
  }
}

// 更新 Agent 使用统计
function updateAgentStats(agentId: string): void {
  try {
    db.prepare(`
      UPDATE agents 
      SET usage_count = usage_count + 1, last_used_at = datetime('now','localtime')
      WHERE id = ?
    `).run(agentId);
  } catch (error) {
    logger.error('Failed to update agent stats:', error);
  }
}

// 通用 API 配置接口
interface LLMProviderConfig {
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

// 豆包配置
const DOUBAO_CONFIG: LLMProviderConfig = {
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

// OpenAI配置
const OPENAI_CONFIG: LLMProviderConfig = {
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

// 本地 AI 大模型配置（支持 Ollama、LM Studio、vLLM 等 OpenAI 兼容 API）
const LOCAL_AI_CONFIG: LLMProviderConfig = {
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

/**
 * 通用的LLM API调用函数
 * @param signal 可选 AbortSignal，用于在多 Agent 编排中实现整体截止时间控制
 */
async function callLLMAPI(
  config: LLMProviderConfig,
  systemPrompt: string,
  userInput: string,
  agentName: string,
  temperature: number,
  agentId: string,
  signal?: AbortSignal
): Promise<string> {
  const startTime = Date.now();
  const apiKey = getApiKey(db, config.apiKeySetting, config.apiKeyEnv);
  const apiBase = getApiBase(db, config.apiBaseSetting, config.apiBaseEnv, config.defaultApiBase);
  const model = getModelId(db, config.modelSetting, config.modelEnv, config.defaultModel);

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

async function callModelWithConfig(
  model: AIModel,
  systemPrompt: string,
  userInput: string,
  agentName: string,
  temperature: number,
  agentId: string
): Promise<string> {
  const startTime = Date.now();
  const apiKey = aiModelService.getEffectiveApiKey(model);
  const apiBase = aiModelService.getEffectiveApiBase(model);
  
  const providerNameMap: Record<string, string> = {
    volcengine: 'VolcEngine',
    deepseek: 'DeepSeek',
    aliyun: 'AliYun',
    zhipu: 'ZhiPu',
    openai: 'OpenAI',
    local: 'LocalAI'
  };
  
  const providerName = providerNameMap[model.provider_type] || 'Unknown';
  
  if (model.provider_type !== 'local' && (!apiKey || apiKey === '')) {
    const errorMsg = `${providerName} API Key not configured`;
    logger.error(`❌ [${agentName}] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const breaker = getCircuitBreaker(providerName);
  if (!breaker.canCall()) {
    const errorMsg = 'Circuit breaker is OPEN, rejecting request - service temporarily unavailable';
    logger.error(`🔌 [${agentName}] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    logger.info(`🤖 [${agentName}] Calling ${model.name} (${model.model_id})...`);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ];

    const requestBody = {
      model: model.model_id,
      messages,
      temperature,
      max_tokens: 2048
    };

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

    circuitBreakers.get(providerName)?.recordSuccess();

    if (response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message.content;
      logger.info(`✅ [${agentName}] ${model.name} call successful, response length: ${content?.length || 0} chars`);
      
      recordAgentExecution(
        agentId,
        agentName,
        userInput,
        content || '',
        'success',
        undefined,
        Date.now() - startTime,
        { tokens: response.data.usage, model_id: model.model_id }
      );
      
      return content || '';
    } else {
      throw new Error('API returned empty choices');
    }
  } catch (error: unknown) {
    circuitBreakers.get(providerName)?.recordFailure();
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [${agentName}] ${model.name} call failed:`, errorMessage);
    
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

/**
 * 调用豆包 API 获取响应
 * @param systemPrompt 系统提示词
 * @param userInput 用户输入
 * @param agentName Agent 名称（用于日志）
 * @param temperature 温度参数
 * @param signal 可选 AbortSignal，用于多 Agent 编排整体截止时间控制
 */
export async function callDoubaoAPI(
  systemPrompt: string,
  userInput: string,
  agentName: string = 'Agent',
  temperature: number = 0.7,
  agentId: string = '',
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
  agentName: string = 'Agent',
  temperature: number = 0.7,
  agentId: string = '',
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
  agentName: string = 'Agent',
  temperature: number = 0.7,
  agentId: string = '',
  signal?: AbortSignal
): Promise<string> {
  return callLLMAPI(LOCAL_AI_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, signal);
}

/**
 * 通用的 LLM 完成生成函数
 * @param prompt 用户提示词
 * @param systemPrompt 系统提示词（可选）
 * @param temperature 温度参数
 * @param model 模型ID（可选）
 */
export async function generateCompletion(
  prompt: string,
  systemPrompt: string = '你是一个专业的助手。',
  temperature: number = 0.7,
  model?: string,
  agentId: string = ''
): Promise<string> {
  const timeoutMs = 120000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`LLM generateCompletion 超时 (${timeoutMs / 1000}s)`)), timeoutMs);
  });

  // 优先使用 AI 模型池中的默认模型
  const defaultModel = aiModelService.getDefaultModel();
  if (defaultModel && defaultModel.enabled) {
    logger.info(`🤖 [generateCompletion] Using default model from AI Model Pool: ${defaultModel.name} (${defaultModel.provider_type})`);
    return Promise.race([
      callModelWithConfig(defaultModel, systemPrompt, prompt, 'LLM', temperature, agentId),
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
        return await callLocalAIAPI(systemPrompt, prompt, 'LLM', temperature, agentId);
      } catch (localError) {
        logger.warn(`⚠️ Local AI failed, falling back to Doubao: ${localError instanceof Error ? localError.message : 'Unknown error'}`);
        return await callDoubaoAPI(systemPrompt, prompt, 'LLM', temperature, agentId);
      }
    }
    
    if (provider === 'openai') {
      return await callOpenAIAPI(
        systemPrompt,
        prompt,
        'LLM',
        temperature,
        agentId
      );
    } else {
      return await callDoubaoAPI(
        systemPrompt,
        prompt,
        'LLM',
        temperature,
        agentId
      );
    }
  };

  return Promise.race([executeCompletion(), timeoutPromise]);
}

/**
 * 判断模型属于哪个API提供商（用于向后兼容）
 * @param modelId 模型ID
 * @returns 提供商名称
 */
function getProviderForModel(modelId: string): 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local' {
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

/**
 * 获取 Agent 的配置并调用 LLM
 * @param agentId Agent ID
 * @param userInput 用户输入
 */
export async function executeAgentWithLLM(
  agentId: string,
  userInput: string
): Promise<string> {
  const agent = db.prepare('SELECT id, name, system_prompt, temperature, model, api_provider, primary_model_id, fallback_model_id FROM agents WHERE id = ?').get(agentId) as {
    id: string;
    name: string;
    system_prompt: string;
    temperature: number;
    model: string;
    api_provider: string;
    primary_model_id: string | null;
    fallback_model_id: string | null;
  } | undefined;
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
      if (primaryModel && primaryModel.enabled) {
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
      if (fallbackModel && fallbackModel.enabled) {
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

/**
 * 检查 LLM 服务是否可用
 */
export async function checkLLMAvailability(): Promise<{ available: boolean; message: string; provider?: 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local' }> {
  // 优先级：火山引擎 > 豆包(兼容旧配置) > 本地 AI > OpenAI
  // 1. 检查火山引擎 API
  const volcengineApiKey = getApiKey(db, 'VOLCENGINE_API_KEY', 'VOLCENGINE_API_KEY');
  
  if (volcengineApiKey && volcengineApiKey !== 'your-volcengine-api-key-here') {
    const breaker = getCircuitBreaker('VolcEngine');
    if (breaker.canCall()) {
      return { available: true, message: 'VolcEngine API available', provider: 'volcengine' };
    }
  }

  // 2. 兼容旧配置：检查豆包 API（向后兼容）
  const doubaoApiKey = getApiKey(db, 'DOUBAO_API_KEY', 'DOUBAO_API_KEY');
  
  if (doubaoApiKey && doubaoApiKey !== 'your-doubao-api-key-here') {
    const breaker = getCircuitBreaker('Doubao');
    if (breaker.canCall()) {
      return { available: true, message: 'Doubao API available', provider: 'volcengine' };
    }
  }
  
  // 2. 检查本地 AI 大模型
  try {
    const localApiKey = getApiKey(db, 'LOCAL_AI_API_KEY', 'LOCAL_AI_API_KEY');
    const localApiBase = getApiBase(db, 'LOCAL_AI_API_BASE', 'LOCAL_AI_API_BASE', 'http://host.docker.internal:11434/v1');
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
  const openaiApiKey = getApiKey(db, 'OPENAI_API_KEY', 'OPENAI_API_KEY');
  
  if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
    const breaker = getCircuitBreaker('OpenAI');
    if (breaker.canCall()) {
      return { available: true, message: 'OpenAI API available', provider: 'openai' };
    }
  }
  
  return { available: false, message: 'No LLM service configured' };
}

export { getCircuitBreaker, circuitBreakers };
