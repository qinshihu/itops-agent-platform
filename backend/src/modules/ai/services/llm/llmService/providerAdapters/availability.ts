/**
 * providerAdapters 可用性检查子模块（2026-07-21 拆分）
 *
 * 把原 providerAdapters.ts L536-584 的 checkLLMAvailability 抽出
 * 按优先级检查火山引擎/豆包/本地 AI/OpenAI 的 API 状态（用于启动期 fallback 选择）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { logger } from '../../../../../../utils/logger';
import { getApiKey, getApiBase } from '../../../../../../utils/apiConfig';
import { getCircuitBreaker } from '../circuitBreaker';

export type ProviderName = 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local';

export interface AvailabilityResult {
  available: boolean;
  message: string;
  provider?: ProviderName;
}

/**
 * 检查 LLM 服务是否可用
 * 优先级：火山引擎 > 豆包(兼容旧配置) > 本地 AI > OpenAI
 */
export async function checkLLMAvailability(): Promise<AvailabilityResult> {
  // 1. 检查火山引擎 API
  const volcengineApiKey = getApiKey('VOLCENGINE_API_KEY');

  if (volcengineApiKey && volcengineApiKey !== 'your-volcengine-api-key-here') {
    const breaker = getCircuitBreaker('VolcEngine');
    if (breaker.canCall()) {
      return { available: true, message: 'VolcEngine API available', provider: 'volcengine' };
    }
  }

  // 2. 兼容旧配置：检查豆包 API（向后兼容）
  const doubaoApiKey = getApiKey('DOUBAO_API_KEY');

  if (doubaoApiKey && doubaoApiKey !== 'your-doubao-api-key-here') {
    const breaker = getCircuitBreaker('Doubao');
    if (breaker.canCall()) {
      return { available: true, message: 'Doubao API available', provider: 'volcengine' };
    }
  }

  // 3. 检查本地 AI 大模型
  try {
    void getApiKey('LOCAL_AI_API_KEY');
    const localApiBase = getApiBase('LOCAL_AI_API_BASE', 'http://host.docker.internal:11434/v1');
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

  // 4. 检查 OpenAI
  const openaiApiKey = getApiKey('OPENAI_API_KEY');

  if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
    const breaker = getCircuitBreaker('OpenAI');
    if (breaker.canCall()) {
      return { available: true, message: 'OpenAI API available', provider: 'openai' };
    }
  }

  void logger; // 保持 import 完整性
  return { available: false, message: 'No LLM service configured' };
}
