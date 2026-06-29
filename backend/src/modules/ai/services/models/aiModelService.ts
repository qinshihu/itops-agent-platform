import { randomUUID } from 'crypto';
import db from '../../../models/database';
import { logger } from '../../../utils/logger';
import { getApiKey, getModelId, getApiBase, buildApiEndpoint } from '../../../utils/apiConfig';
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
  return getApiBase(db, config.setting, config.env, config.default);
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
  const models = db.prepare(`
    SELECT * FROM ai_models 
    ORDER BY sort_order ASC, created_at ASC
  `).all() as RawAIModel[];
  
  return models.map(parseModel);
}

export function getEnabledModels(): AIModel[] {
  const models = db.prepare(`
    SELECT * FROM ai_models 
    WHERE enabled = 1 
    ORDER BY sort_order ASC, created_at ASC
  `).all() as RawAIModel[];
  
  return models.map(parseModel);
}

export function getModelById(id: string): AIModel | undefined {
  const model = db.prepare(`
    SELECT * FROM ai_models WHERE id = ?
  `).get(id) as RawAIModel | undefined;
  
  if (!model) return undefined;
  
  return parseModel(model);
}

export function getDefaultModel(): AIModel | undefined {
  const defaultModel = db.prepare(`
    SELECT * FROM ai_models 
    WHERE enabled = 1 AND is_default = 1 
    ORDER BY sort_order ASC 
    LIMIT 1
  `).get() as RawAIModel | undefined;
  
  if (defaultModel) {
    return parseModel(defaultModel);
  }
  
  const firstEnabled = db.prepare(`
    SELECT * FROM ai_models 
    WHERE enabled = 1 
    ORDER BY sort_order ASC 
    LIMIT 1
  `).get() as RawAIModel | undefined;
  
  if (firstEnabled) {
    return parseModel(firstEnabled);
  }
  
  return undefined;
}

export function createModel(dto: CreateAIModelDTO): AIModel {
  const id = randomUUID();
  
  const maxSortOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM ai_models').get() as { max_order: number | null };
  const sortOrder = (maxSortOrder?.max_order ?? -1) + 1;
  
  const isFirstModel = getAllModels().length === 0;
  
  db.prepare(`
    INSERT INTO ai_models (
      id, name, provider_type, api_key, api_base, model_id, 
      enabled, sort_order, is_default, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    dto.name,
    dto.provider_type,
    dto.api_key || null,
    dto.api_base || null,
    dto.model_id,
    1,
    sortOrder,
    isFirstModel ? 1 : 0,
    dto.tags ? JSON.stringify(dto.tags) : null
  );
  
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
  
  const updates: string[] = [];
  const values: unknown[] = [];
  
  if (dto.name !== undefined) {
    updates.push('name = ?');
    values.push(dto.name);
  }
  
  if (dto.provider_type !== undefined) {
    updates.push('provider_type = ?');
    values.push(dto.provider_type);
  }
  
  if (dto.model_id !== undefined) {
    updates.push('model_id = ?');
    values.push(dto.model_id);
  }
  
  if (dto.api_key !== undefined) {
    updates.push('api_key = ?');
    values.push(dto.api_key || null);
  }
  
  if (dto.api_base !== undefined) {
    updates.push('api_base = ?');
    values.push(dto.api_base || null);
  }
  
  if (dto.enabled !== undefined) {
    updates.push('enabled = ?');
    values.push(dto.enabled);
  }
  
  if (dto.is_default !== undefined) {
    if (dto.is_default === 1) {
      db.prepare('UPDATE ai_models SET is_default = 0').run();
    }
    updates.push('is_default = ?');
    values.push(dto.is_default);
  }
  
  if (dto.tags !== undefined) {
    updates.push('tags = ?');
    values.push(dto.tags ? JSON.stringify(dto.tags) : null);
  }
  
  if (updates.length === 0) {
    return existingModel;
  }
  
  updates.push('updated_at = datetime(\'now\',\'localtime\')');
  values.push(id);
  
  db.prepare(`
    UPDATE ai_models 
    SET ${updates.join(', ')} 
    WHERE id = ?
  `).run(...values);
  
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
  
  const primaryAgentCount = db.prepare(
    'SELECT COUNT(*) as count FROM agents WHERE primary_model_id = ?'
  ).get(id) as { count: number };
  
  if (primaryAgentCount.count > 0) {
    throw new Error(`无法删除模型: 该模型正在被 ${primaryAgentCount.count} 个 Agent 作为主模型使用`);
  }
  
  const fallbackAgentCount = db.prepare(
    'SELECT COUNT(*) as count FROM agents WHERE fallback_model_id = ?'
  ).get(id) as { count: number };
  
  if (fallbackAgentCount.count > 0) {
    throw new Error(`无法删除模型: 该模型正在被 ${fallbackAgentCount.count} 个 Agent 作为备选模型使用`);
  }
  
  db.prepare('DELETE FROM ai_models WHERE id = ?').run(id);
  
  logger.info(`AI model deleted: ${existingModel.name} (${id})`);
}

export function reorderModels(modelIds: string[]): void {
  const stmt = db.prepare('UPDATE ai_models SET sort_order = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?');
  
  modelIds.forEach((id, index) => {
    stmt.run(index, id);
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
    
    const response = await axios.post(
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
    
    db.prepare(`
      UPDATE ai_models 
      SET last_test_status = 'success', last_test_time = datetime('now','localtime'), updated_at = datetime('now','localtime') 
      WHERE id = ?
    `).run(modelId);
    
    return {
      success: true,
      latency_ms: latency,
      message: `模型连接正常，响应时间: ${latency}ms`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const latency = Date.now() - startTime;
    
    db.prepare(`
      UPDATE ai_models 
      SET last_test_status = 'failed', last_test_time = datetime('now','localtime'), updated_at = datetime('now','localtime') 
      WHERE id = ?
    `).run(modelId);
    
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
  
  const doubaoKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_API_KEY') as { value: string } | undefined;
  const doubaoModel = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_MODEL') as { value: string } | undefined;
  const doubaoApiBase = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_API_BASE') as { value: string } | undefined;
  
  if (doubaoKey && doubaoKey.value && doubaoKey.value !== 'your-doubao-api-key-here') {
    createModel({
      name: '火山引擎 (默认)',
      provider_type: 'volcengine',
      model_id: doubaoModel?.value || 'doubao-1-5-lite-32k-250115',
      api_key: doubaoKey.value,
      api_base: doubaoApiBase?.value || undefined,
      tags: ['默认配置']
    });
    logger.info('Migrated VolcEngine configuration');
  }
  
  const openaiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_API_KEY') as { value: string } | undefined;
  const openaiModel = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_MODEL') as { value: string } | undefined;
  const openaiApiBase = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_API_BASE') as { value: string } | undefined;
  
  if (openaiKey && openaiKey.value && openaiKey.value !== 'your-openai-api-key-here') {
    createModel({
      name: 'OpenAI (默认)',
      provider_type: 'openai',
      model_id: openaiModel?.value || 'gpt-4o',
      api_key: openaiKey.value,
      api_base: openaiApiBase?.value || undefined,
      tags: ['默认配置']
    });
    logger.info('Migrated OpenAI configuration');
  }
  
  const localAiApiBase = db.prepare('SELECT value FROM settings WHERE key = ?').get('LOCAL_AI_API_BASE') as { value: string } | undefined;
  const localAiModel = db.prepare('SELECT value FROM settings WHERE key = ?').get('LOCAL_AI_MODEL') as { value: string } | undefined;
  
  if (localAiApiBase && localAiApiBase.value && localAiApiBase.value !== 'http://host.docker.internal:11434/v1') {
    createModel({
      name: '本地 AI (默认)',
      provider_type: 'local',
      model_id: localAiModel?.value || 'qwen2.5:7b',
      api_base: localAiApiBase.value,
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
  
  db.exec(`
    UPDATE agents 
    SET primary_model_id = (
      SELECT id FROM ai_models 
      WHERE (
        (agents.api_provider = 'doubao' AND provider_type = 'volcengine') OR
        (agents.api_provider = provider_type)
      ) AND is_default = 1
      LIMIT 1
    )
    WHERE primary_model_id IS NULL AND api_provider IS NOT NULL;
  `);
  
  logger.info('Old agents migration completed');
}
