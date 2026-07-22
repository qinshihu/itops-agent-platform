/**
 * providerAdapters 模型池调度子模块（2026-07-21 拆分）
 *
 * 把原 providerAdapters.ts L399-464 的 buildProviderConfig + callModelWithConfig 抽出
 * 动态根据 AIModel 构建 LLMProviderConfig 并调用 API
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { logger } from '../../../../../../utils/logger';
import type { AIModel } from '../../../models/aiModelService';
import type { LLMProviderConfig } from './types';
import { callLLMAPI } from './providerDispatch';

/** 根据 AIModel 的 provider_type 构建 LLMProviderConfig */
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
    defaultApiBase: defaultApiBase,
    modelSetting: `${providerName.toUpperCase()}_MODEL`,
    modelEnv: `${providerName.toUpperCase()}_MODEL`,
    defaultModel: model.model_id,
    placeholderKey: model.provider_type === 'local' ? '' : `your-${model.provider_type}-api-key-here`,
    // 把 AIModel 自带的配置塞进 override 字段，确保与 testModelConnectivity 行为一致
    overrideApiKey: model.api_key && model.api_key.trim() !== '' ? model.api_key : undefined,
    overrideApiBase: model.api_base && model.api_base.trim() !== '' ? model.api_base : undefined,
    overrideModel: model.model_id,
  };
}

/** 根据 AIModel 构建 config 并调用 LLM API（支持任意 provider_type） */
export async function callModelWithConfig(
  model: AIModel,
  systemPrompt: string,
  userInput: string,
  agentName: string,
  temperature: number,
  agentId: string,
  signal?: AbortSignal,
): Promise<string> {
  const config = buildProviderConfig(model);

  // 临时覆盖：如果 AIModel 中配置了 api_base，使用它
  if (model.api_base) {
    logger.info(`🔧 [${agentName}] Using custom api_base from model config: ${model.api_base}`);
  }

  return callLLMAPI(config, systemPrompt, userInput, agentName, temperature, agentId, signal);
}
