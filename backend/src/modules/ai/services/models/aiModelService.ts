import { randomUUID } from 'crypto';
import { aiModelRepository, settingsRepository, agentRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { getApiBase, buildApiEndpoint } from '../../../../utils/apiConfig';
import axios from 'axios';

export interface AIModel {
  id: string;
  name: string;
  provider_type: 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local';
  api_key?: string;
  api_base?: string;
  model_id: string;
  enabled: number;
  sort_order: number;
  is_default: number;
  tags?: string[];
  last_test_status?: string;
  last_test_time?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAIModelDTO {
  name: string;
  provider_type: 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local';
  model_id: string;
  api_key?: string;
  api_base?: string;
  tags?: string[];
}

export interface UpdateAIModelDTO {
  name?: string;
  provider_type?: 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local';
  model_id?: string;
  api_key?: string;
  api_base?: string;
  enabled?: number;
  is_default?: number;
  tags?: string[];
}

export function getEffectiveApiKey(model: AIModel): string | null {
  if (model.api_key && model.api_key.trim() !== '') {
    return model.api_key;
  }
  
  return null;
}

export function getEffectiveApiBase(model: AIModel): string {
  if (model.api_base && model.api_base.trim() !== '') {
    return model.api_base;
  }
  
  const providerBaseMap: Record<string, { setting: string; env: string; default: string }> = {
    volcengine: {
      setting: 'VOLCENGINE_API_BASE',
      env: 'VOLCENGINE_API_BASE',
      default: 'https://ark.cn-beijing.volces.com/api/v3'
    },
    deepseek: {
      setting: 'DEEPSEEK_API_BASE',
      env: 'DEEPSEEK_API_BASE',
      default: 'https://api.deepseek.com/v1'
    },
    aliyun: {
      setting: 'ALIYUN_API_BASE',
      env: 'ALIYUN_API_BASE',
      default: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    zhipu: {
      setting: 'ZHIPU_API_BASE',
      env: 'ZHIPU_API_BASE',
      default: 'https://open.bigmodel.cn/api/paas/v4'
    },
    openai: {
      setting: 'OPENAI_API_BASE',
      env: 'OPENAI_API_BASE',
      default: 'https://api.openai.com/v1'
    },
    local: {
      setting: 'LOCAL_AI_API_BASE',
      env: 'LOCAL_AI_API_BASE',
      default: 'http://host.docker.internal:11434/v1'
    }
  };
  
  const config = providerBaseMap[model.provider_type];
  return getApiBase(config.setting, config.env, config.default);
}

interface RawAIModel {
  id: string;
  name: string;
  provider_type: 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local';
  api_key?: string;
  api_base?: string;
  model_id: string;
  enabled: number;
  sort_order: number;
  is_default: number;
  tags?: string;
  last_test_status?: string;
  last_test_time?: string;
  created_at: string;
  updated_at: string;
}

function parseModel(raw: RawAIModel): AIModel {
  return {
    ...raw,
    tags: raw.tags ? JSON.parse(raw.tags) : []
  };
}

export function getAllModels(): AIModel[] {
  const models = aiModelRepository.listAll() as RawAIModel[];
  return models.map(parseModel);
}

export function getEnabledModels(): AIModel[] {
  const models = aiModelRepository.listEnabled() as RawAIModel[];
  return models.map(parseModel);
}

export function getModelById(id: string): AIModel | undefined {
  const model = aiModelRepository.getById(id) as RawAIModel | undefined;
  if (!model) return undefined;
  return parseModel(model);
}

export function getDefaultModel(): AIModel | undefined {
  const defaultModel = aiModelRepository.getDefault() as RawAIModel | undefined;
  if (defaultModel) return parseModel(defaultModel);
  return undefined;
}

export function createModel(dto: CreateAIModelDTO): AIModel {
  const id = randomUUID();
  
  const maxSortOrder = aiModelRepository.getMaxSortOrder();
  const sortOrder = maxSortOrder + 1;
  
  const isFirstModel = aiModelRepository.listAll().length === 0;
  
  aiModelRepository.create({
    id,
    name: dto.name,
    provider_type: dto.provider_type,
    api_key: dto.api_key || null,
    api_base: dto.api_base || null,
    model_id: dto.model_id,
    enabled: 1,
    sort_order: sortOrder,
    is_default: isFirstModel ? 1 : 0,
    tags: dto.tags ? JSON.stringify(dto.tags) : null,
  });
  
  const model = getModelById(id);
  if (!model) {
    throw new Error('Failed to create model');
  }
  
  logger.info(`AI model created: ${model.name} (${model.id})`);
  return model;
}

export function updateModel(id: string, dto: UpdateAIModelDTO): AIModel {
  const existingModel = getModelById(id);
  if (!existingModel) {
    throw new Error('Model not found');
  }
  
  const updates: Record<string, unknown> = {};
  
  if (dto.name !== undefined) { updates.name = dto.name; }
  if (dto.provider_type !== undefined) { updates.provider_type = dto.provider_type; }
  if (dto.model_id !== undefined) { updates.model_id = dto.model_id; }
  if (dto.api_key !== undefined) { updates.api_key = dto.api_key || null; }
  if (dto.api_base !== undefined) { updates.api_base = dto.api_base || null; }
  if (dto.enabled !== undefined) { updates.enabled = dto.enabled; }
  
  if (dto.is_default !== undefined) {
    if (dto.is_default === 1) {
      aiModelRepository.clearAllDefaults();
    }
    updates.is_default = dto.is_default;
  }
  
  if (dto.tags !== undefined) {
    updates.tags = dto.tags ? JSON.stringify(dto.tags) : null;
  }
  
  if (Object.keys(updates).length === 0) {
    return existingModel;
  }
  
  aiModelRepository.update(id, updates);
  
  const updatedModel = getModelById(id);
  if (!updatedModel) {
    throw new Error('Model not found after update');
  }
  
  logger.info(`AI model updated: ${updatedModel.name} (${updatedModel.id})`);
  return updatedModel;
}

export function deleteModel(id: string): void {
  const existingModel = getModelById(id);
  if (!existingModel) {
    throw new Error('Model not found');
  }
  
  const primaryAgentCount = agentRepository.countByPrimaryModelId(id);
  if (primaryAgentCount > 0) {
    throw new Error(`无法删除模型: 该模型正在被 ${primaryAgentCount} 个 Agent 作为主模型使用`);
  }
  
  const fallbackAgentCount = agentRepository.countByFallbackModelId(id);
  if (fallbackAgentCount > 0) {
    throw new Error(`无法删除模型: 该模型正在被 ${fallbackAgentCount} 个 Agent 作为备选模型使用`);
  }
  
  aiModelRepository.delete(id);
  
  logger.info(`AI model deleted: ${existingModel.name} (${id})`);
}

export function reorderModels(modelIds: string[]): void {
  modelIds.forEach((id, index) => {
    aiModelRepository.updateSortOrder(id, index);
  });
  
  logger.info(`AI models reordered: ${modelIds.length} models updated`);
}

export async function testModelConnectivity(modelId: string): Promise<{
  success: boolean;
  latency_ms?: number;
  message: string;
}> {
  const model = getModelById(modelId);
  if (!model) {
    throw new Error('Model not found');
  }
  
  const apiKey = getEffectiveApiKey(model);
  const apiBase = getEffectiveApiBase(model);
  
  if (!apiKey && model.provider_type !== 'local') {
    return {
      success: false,
      message: 'API Key 未配置，请在模型配置或全局设置中配置'
    };
  }
  
  const startTime = Date.now();
  
  try {
    let finalApiBase = apiBase;
    if (finalApiBase.includes('/chat/completions')) {
      finalApiBase = finalApiBase.replace('/chat/completions', '');
    }
    
    const _response = await axios.post(
      buildApiEndpoint(finalApiBase, 'chat/completions'),
      {
        model: model.model_id,
        messages: [
          { role: 'user', content: 'Hi' }
        ],
        max_tokens: 10
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000
      }
    );
    
    const latency = Date.now() - startTime;
    
    aiModelRepository.updateTestStatus(modelId, 'success');
    
    return {
      success: true,
      latency_ms: latency,
      message: `模型连接正常，响应时间: ${latency}ms`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const latency = Date.now() - startTime;
    
    aiModelRepository.updateTestStatus(modelId, 'failed');
    
    return {
      success: false,
      latency_ms: latency,
      message: `测试失败: ${errorMessage}`
    };
  }
}

export function migrateOldConfigToAIModels(): void {
  const existingModels = getAllModels();
  if (existingModels.length > 0) {
    logger.info('AI models already exist, skipping old config migration');
    return;
  }
  
  logger.info('Migrating old configuration to AI models...');
  
  const doubaoKey = settingsRepository.getValue('DOUBAO_API_KEY');
  const doubaoModel = settingsRepository.getValue('DOUBAO_MODEL');
  const doubaoApiBase = settingsRepository.getValue('DOUBAO_API_BASE');
  
  if (doubaoKey && doubaoKey !== 'your-doubao-api-key-here') {
    createModel({
      name: '火山引擎 (默认)',
      provider_type: 'volcengine',
      model_id: doubaoModel || 'doubao-1-5-lite-32k-250115',
      api_key: doubaoKey,
      api_base: doubaoApiBase || undefined,
      tags: ['默认配置']
    });
    logger.info('Migrated VolcEngine configuration');
  }
  
  const openaiKey = settingsRepository.getValue('OPENAI_API_KEY');
  const openaiModel = settingsRepository.getValue('OPENAI_MODEL');
  const openaiApiBase = settingsRepository.getValue('OPENAI_API_BASE');
  
  if (openaiKey && openaiKey !== 'your-openai-api-key-here') {
    createModel({
      name: 'OpenAI (默认)',
      provider_type: 'openai',
      model_id: openaiModel || 'gpt-4o',
      api_key: openaiKey,
      api_base: openaiApiBase || undefined,
      tags: ['默认配置']
    });
    logger.info('Migrated OpenAI configuration');
  }
  
  const localAiApiBase = settingsRepository.getValue('LOCAL_AI_API_BASE');
  const localAiModel = settingsRepository.getValue('LOCAL_AI_MODEL');
  
  if (localAiApiBase && localAiApiBase !== 'http://host.docker.internal:11434/v1') {
    createModel({
      name: '本地 AI (默认)',
      provider_type: 'local',
      model_id: localAiModel || 'qwen2.5:7b',
      api_base: localAiApiBase,
      tags: ['默认配置']
    });
    logger.info('Migrated Local AI configuration');
  }
  
  if (getAllModels().length === 0) {
    logger.info('No old configuration found, creating default VolcEngine model');
    createModel({
      name: '火山引擎 (默认)',
      provider_type: 'volcengine',
      model_id: 'doubao-1-5-lite-32k-250115',
      tags: ['默认配置']
    });
  }
}

export function migrateOldAgents(): void {
  logger.info('Migrating old agents to use primary_model_id...');
  
  agentRepository.migratePrimaryModelIds();
  
  logger.info('Old agents migration completed');
}