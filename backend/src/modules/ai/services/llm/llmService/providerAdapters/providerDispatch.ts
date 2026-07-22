/**
 * providerAdapters 通用 LLM API dispatch（2026-07-21 拆分）
 *
 * 把原 providerAdapters.ts L236-348 的 callLLMAPI 核心调度函数抽出
 * 这是 Provider 调度的核心：参数解析 → 熔断检查 → API 调用 → 错误处理 → 执行统计
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import axios from 'axios';
import { logger } from '../../../../../../utils/logger';
import { getApiKey, getModelId, getApiBase, buildApiEndpoint } from '../../../../../../utils/apiConfig';
import { getCircuitBreaker, callWithRetry, circuitBreakers } from '../circuitBreaker';
import { recordAgentExecution } from './executionStats';
import type { ChatMessage, LLMProviderConfig } from './types';

/** 调用 LLM API 的核心调度函数（支持 override 配置 + 熔断 + 重试 + 执行统计） */
export async function callLLMAPI(
  config: LLMProviderConfig,
  systemPrompt: string,
  userInput: string,
  agentName: string,
  temperature: number,
  agentId: string,
  signal?: AbortSignal,
): Promise<string> {
  const startTime = Date.now();
  // 优先使用 override 字段（AIModel 自带的配置），fallback 到 settings/env
  const apiKey = config.overrideApiKey ?? getApiKey(config.apiKeySetting);
  const apiBase =
    config.overrideApiBase ?? getApiBase(config.apiBaseSetting, config.defaultApiBase);
  const model = config.overrideModel ?? getModelId(config.modelSetting, config.defaultModel);

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
      { role: 'user', content: userInput },
    ];

    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: 2048,
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
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 60000,
            signal: s,
          },
        ),
      3,
      1000,
      10000,
      breaker,
      signal,
    );

    circuitBreakers.get(config.providerName)?.recordSuccess();

    if (response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message.content;
      logger.info(
        `✅ [${agentName}] ${config.providerName} API call successful, response length: ${content?.length || 0} chars`,
      );

      recordAgentExecution(
        agentId,
        agentName,
        userInput,
        content || '',
        'success',
        undefined,
        Date.now() - startTime,
        { tokens: response.data.usage },
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
