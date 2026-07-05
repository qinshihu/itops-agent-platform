import type { Request, Response } from 'express';
import { Router } from 'express';
import { safeLog, safeError, maskApiKey } from '../../../utils/sensitiveMask';
import { getApiKey, getModelId, getApiBase } from '../../../utils/apiConfig';
import { credentialService } from '../../auth/services/credentialService';
import { requireRole } from '../../../middleware/auth';
import { settingsRepository, agentRepository } from '../../../repositories';

const router = Router();

router.get('/', requireRole('admin'), (_req: Request, res: Response) => {
  try {
    const settings = settingsRepository.getAll();
    const settingsObj: Record<string, string> = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value ?? '';
    });
    res.json({ success: true, data: settingsObj });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

router.put('/', (req: Request, res: Response) => {
  try {
    const settings = req.body;

    // 输入验证
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid settings data' });
    }

    // 处理其他设置
    if (Object.keys(settings).length > 0) {
      const entries: Record<string, string> = {};
      for (const [key, value] of Object.entries(settings)) {
        if (typeof key !== 'string' || key.length > 100) {
          continue; // 跳过无效的键
        }
        entries[key] = String(value);
      }
      settingsRepository.upsertMany(entries);
    }

    res.json({ success: true, message: 'Settings updated' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

router.get('/api-keys', requireRole('admin'), (_req: Request, res: Response) => {
  try {
    // Use credential service to get API key status with masked display
    const providers = credentialService.listProviders();

    const doubaoProvider = providers.find(p => p.provider === 'doubao');
    const openaiProvider = providers.find(p => p.provider === 'openai');
    const localAiProvider = providers.find(p => p.provider === 'local_ai');

    const doubaoKey = doubaoProvider?.configured ? credentialService.getCredential('doubao') : undefined;
    const openaiKey = openaiProvider?.configured ? credentialService.getCredential('openai') : undefined;
    const localAiKey = localAiProvider?.configured ? credentialService.getCredential('local_ai') : undefined;

    const doubaoModel = getModelId('DOUBAO_MODEL', 'DOUBAO_MODEL', 'doubao-4o');
    const openaiModel = getModelId('OPENAI_MODEL', 'OPENAI_MODEL', 'gpt-4o');
    const localAiModel = getModelId('LOCAL_AI_MODEL', 'LOCAL_AI_MODEL', 'qwen2.5:7b');
    const doubaoApiBase = getApiBase('DOUBAO_API_BASE', 'DOUBAO_API_BASE', 'https://ark.cn-beijing.volces.com/api/v3');
    const openaiApiBase = getApiBase('OPENAI_API_BASE', 'OPENAI_API_BASE', 'https://api.openai.com/v1');
    const localAiApiBase = getApiBase('LOCAL_AI_API_BASE', 'LOCAL_AI_API_BASE', 'http://host.docker.internal:11434/v1');

    res.json({
      success: true,
      data: {
        doubao: {
          configured: !!doubaoKey,
          masked: doubaoKey ? credentialService.mask(doubaoKey) : null,
          model: doubaoModel,
          apiBase: doubaoApiBase
        },
        openai: {
          configured: !!openaiKey,
          masked: openaiKey ? credentialService.mask(openaiKey) : null,
          model: openaiModel,
          apiBase: openaiApiBase
        },
        localAi: {
          configured: !!localAiApiBase && localAiApiBase !== 'http://host.docker.internal:11434/v1',
          masked: localAiKey ? credentialService.mask(localAiKey) : null,
          model: localAiModel,
          apiBase: localAiApiBase
        }
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch API key status' });
  }
});

// 获取可用模型列表
router.get('/models', (_req: Request, res: Response) => {
  try {
    const doubaoModel = getModelId('DOUBAO_MODEL', 'DOUBAO_MODEL', 'doubao-4o');
    const openaiModel = getModelId('OPENAI_MODEL', 'OPENAI_MODEL', 'gpt-4o');
    const doubaoKey = getApiKey('DOUBAO_API_KEY', 'DOUBAO_API_KEY');
    const openaiKey = getApiKey('OPENAI_API_KEY', 'OPENAI_API_KEY');

    const models: Array<{
      id: string;
      name: string;
      provider: 'doubao' | 'openai' | 'local';
      enabled: boolean;
    }> = [];

    // 添加本地 AI 模型（默认启用，不需要 API Key）
    const localModels = [
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B (Ollama)' },
      { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B (Ollama)' },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B (Ollama)' },
      { id: 'llama3.1:70b', name: 'Llama 3.1 70B (Ollama)' },
      { id: 'mistral:7b', name: 'Mistral 7B (Ollama)' },
      { id: 'deepseek-coder:6.7b', name: 'Deepseek Coder 6.7B (Ollama)' },
      { id: 'gemma2:9b', name: 'Gemma 2 9B (Ollama)' },
      { id: 'phi3:3.8b', name: 'Phi 3 3.8B (Ollama)' },
    ];

    for (const lm of localModels) {
      models.push({
        id: lm.id,
        name: lm.name,
        provider: 'local',
        enabled: true // 本地模型始终启用
      });
    }

    // 添加用户配置的豆包模型（如果已配置）
    if (doubaoKey && doubaoModel) {
      models.push({
        id: doubaoModel,
        name: `豆包 (${doubaoModel})`,
        provider: 'doubao',
        enabled: true
      });
    }

    // 添加用户配置的 OpenAI 模型（如果已配置）
    if (openaiKey && openaiModel) {
      models.push({
        id: openaiModel,
        name: `OpenAI (${openaiModel})`,
        provider: 'openai',
        enabled: true
      });
    }

    // 总是添加一些默认模型作为备选（即使没有配置 API 密钥）
    if (!models.some(m => m.id === 'doubao-4o')) {
      models.push({
        id: 'doubao-4o',
        name: '豆包 4o',
        provider: 'doubao',
        enabled: !doubaoKey
      });
    }

    if (!models.some(m => m.id === 'gpt-4o')) {
      models.push({
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        enabled: !openaiKey
      });
    }

    if (!models.some(m => m.id === 'gpt-4-turbo')) {
      models.push({
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        enabled: !openaiKey
      });
    }

    res.json({
      success: true,
      data: models
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch models' });
  }
});

/**
 * 确定当前配置的 AI 模型（优先级：本地AI > 豆包 > OpenAI）
 * 返回 null 表示没有任何可用配置
 */
function determineConfiguredModel(): string | null {
  const credDoubaoKey = credentialService.getCredential('doubao');
  const credOpenaiKey = credentialService.getCredential('openai');

  // 优先检查本地 AI（如果配置了非默认地址）
  const localAiApiBase = settingsRepository.getValue('LOCAL_AI_API_BASE');
  if (localAiApiBase && localAiApiBase !== 'http://host.docker.internal:11434/v1') {
    return settingsRepository.getValue('LOCAL_AI_MODEL') || 'qwen2.5:7b';
  }

  // 检查豆包是否已配置（via credential or settings）
  if (credDoubaoKey && credDoubaoKey !== 'your-doubao-api-key-here') {
    return settingsRepository.getValue('DOUBAO_MODEL') || 'doubao-4o';
  }

  // 回退到 settings 表检查豆包 API key（backwards compat）
  const doubaoKeySetting = settingsRepository.getValue('DOUBAO_API_KEY');
  if (doubaoKeySetting && doubaoKeySetting !== 'your-doubao-api-key-here') {
    return settingsRepository.getValue('DOUBAO_MODEL') || 'doubao-4o';
  }

  // 检查 OpenAI（via credential or settings）
  if (credOpenaiKey && credOpenaiKey !== 'your-openai-api-key-here') {
    return settingsRepository.getValue('OPENAI_MODEL') || 'gpt-4o';
  }

  // 回退到 settings 表检查 OpenAI API key（backwards compat）
  const openaiKeySetting = settingsRepository.getValue('OPENAI_API_KEY');
  if (openaiKeySetting && openaiKeySetting !== 'your-openai-api-key-here') {
    return settingsRepository.getValue('OPENAI_MODEL') || 'gpt-4o';
  }

  return null;
}

/**
 * 根据当前配置更新预设 Agent 的模型字段
 */
function syncPresetAgentModel(action: 'save' | 'delete'): void {
  const configuredModel = determineConfiguredModel();

  if (configuredModel) {
    const changes = agentRepository.updatePresetModel(configuredModel);
    safeLog(`✅ Updated ${changes} preset agents with model: ${configuredModel}${action === 'delete' ? ' (after deleting one provider)' : ''}`);
  } else {
    const changes = agentRepository.clearPresetModel();
    safeLog(`✅ Cleared model from ${changes} preset agents${action === 'delete' ? ' (no API keys configured)' : ''}`);
  }
}

// 保存 API 密钥和模型配置
router.put('/api-keys', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { doubaoApiKey, openaiApiKey, doubaoModel, openaiModel, doubaoApiBase, openaiApiBase, localAiModel, localAiApiBase } = req.body;

    safeLog('🔧 Saving API key settings...');

    // 保存豆包 API 密钥（如果提供）- store encrypted via credential service
    if (doubaoApiKey !== undefined) {
      if (doubaoApiKey === '') {
        safeLog('Deleting DOUBAO_API_KEY');
        settingsRepository.delete('DOUBAO_API_KEY');
        credentialService.deleteCredential('doubao');
      } else {
        safeLog('Saving DOUBAO_API_KEY (encrypted):', maskApiKey(doubaoApiKey));
        credentialService.setCredential('doubao', doubaoApiKey);
        // Also keep in settings for backwards compatibility
        settingsRepository.upsert('DOUBAO_API_KEY', doubaoApiKey);
      }
    }

    // 保存 OpenAI API 密钥（如果提供）- store encrypted via credential service
    if (openaiApiKey !== undefined) {
      if (openaiApiKey === '') {
        safeLog('Deleting OPENAI_API_KEY');
        settingsRepository.delete('OPENAI_API_KEY');
        credentialService.deleteCredential('openai');
      } else {
        safeLog('Saving OPENAI_API_KEY (encrypted):', maskApiKey(openaiApiKey));
        credentialService.setCredential('openai', openaiApiKey);
        // Also keep in settings for backwards compatibility
        settingsRepository.upsert('OPENAI_API_KEY', openaiApiKey);
      }
    }

    // 保存豆包模型 ID（如果提供）
    if (doubaoModel !== undefined) {
      if (doubaoModel === '') {
        settingsRepository.delete('DOUBAO_MODEL');
      } else {
        settingsRepository.upsert('DOUBAO_MODEL', doubaoModel);
      }
    }

    // 保存 OpenAI 模型 ID（如果提供）
    if (openaiModel !== undefined) {
      if (openaiModel === '') {
        settingsRepository.delete('OPENAI_MODEL');
      } else {
        settingsRepository.upsert('OPENAI_MODEL', openaiModel);
      }
    }

    // 保存豆包 API 地址（如果提供）
    if (doubaoApiBase !== undefined) {
      if (doubaoApiBase === '') {
        settingsRepository.delete('DOUBAO_API_BASE');
      } else {
        settingsRepository.upsert('DOUBAO_API_BASE', doubaoApiBase);
      }
    }

    // 保存 OpenAI API 地址（如果提供）
    if (openaiApiBase !== undefined) {
      if (openaiApiBase === '') {
        settingsRepository.delete('OPENAI_API_BASE');
      } else {
        settingsRepository.upsert('OPENAI_API_BASE', openaiApiBase);
      }
    }

    // 保存本地 AI 模型（如果提供）
    if (localAiModel !== undefined) {
      if (localAiModel === '') {
        settingsRepository.delete('LOCAL_AI_MODEL');
      } else {
        settingsRepository.upsert('LOCAL_AI_MODEL', localAiModel);
      }
    }

    // 保存本地 AI API 地址（如果提供）
    if (localAiApiBase !== undefined) {
      if (localAiApiBase === '') {
        settingsRepository.delete('LOCAL_AI_API_BASE');
      } else {
        settingsRepository.upsert('LOCAL_AI_API_BASE', localAiApiBase);
      }
    }

    // Store local AI key if there's a way to provide it
    if ((req.body as { localAiApiKey?: string }).localAiApiKey !== undefined) {
      const localAiApiKey = (req.body as { localAiApiKey?: string }).localAiApiKey as string;
      if (localAiApiKey === '') {
        credentialService.deleteCredential('local_ai');
      } else if (localAiApiKey) {
        credentialService.setCredential('local_ai', localAiApiKey);
      }
    }

    // 自动更新预设Agent的模型字段
    syncPresetAgentModel('save');

    safeLog('✅ API key settings saved successfully');
    res.json({ success: true, message: 'Settings saved' });
  } catch (error: unknown) {
    safeError('❌ Failed to save settings:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to save settings' });
  }
});

// 删除特定提供商的API配置
router.delete('/api-keys/:provider', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    safeLog(`🗑️ Deleting API configuration for provider: ${provider}`);

    if (provider === 'doubao') {
      settingsRepository.delete('DOUBAO_API_KEY');
      settingsRepository.delete('DOUBAO_MODEL');
      settingsRepository.delete('DOUBAO_API_BASE');
      credentialService.deleteCredential('doubao');
    } else if (provider === 'openai') {
      settingsRepository.delete('OPENAI_API_KEY');
      settingsRepository.delete('OPENAI_MODEL');
      settingsRepository.delete('OPENAI_API_BASE');
      credentialService.deleteCredential('openai');
    } else if (provider === 'local') {
      settingsRepository.delete('LOCAL_AI_MODEL');
      settingsRepository.delete('LOCAL_AI_API_BASE');
      credentialService.deleteCredential('local_ai');
    } else {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }

    // 删除配置后，同步预设 Agent 模型
    syncPresetAgentModel('delete');

    safeLog(`✅ API configuration deleted for provider: ${provider}`);
    res.json({ success: true, message: 'Configuration deleted' });
  } catch (error: unknown) {
    safeError('❌ Failed to delete configuration:', error);
    res.status(500).json({ success: false, error: 'Failed to delete configuration' });
  }
});

export default router;
