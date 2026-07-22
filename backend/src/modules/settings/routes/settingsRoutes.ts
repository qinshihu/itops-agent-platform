/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { safeLog, safeError, maskApiKey } from '../../../utils/sensitiveMask';
import { getApiKey, getModelId, getApiBase } from '../../../utils/apiConfig';
import { credentialService } from '../../auth/services/credentialService';
import { requireRole } from '../../../middleware/auth';
import { settingsCrudService } from '../services/settingsCrudService';

const router = Router();

router.get('/', requireRole('admin'), (_req: Request, res: Response) => {
  try {
    const data = settingsCrudService.getAllSettings();
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

router.put('/', (req: Request, res: Response) => {
  try {
    const result = settingsCrudService.upsertMany(req.body as Record<string, unknown>);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

router.get('/api-keys', requireRole('admin'), (_req: Request, res: Response) => {
  try {
    const providers = credentialService.listProviders();

    const doubaoProvider = providers.find((p) => p.provider === 'doubao');
    const openaiProvider = providers.find((p) => p.provider === 'openai');
    const localAiProvider = providers.find((p) => p.provider === 'local_ai');

    const doubaoKey = doubaoProvider?.configured ? credentialService.getCredential('doubao') : undefined;
    const openaiKey = openaiProvider?.configured ? credentialService.getCredential('openai') : undefined;
    const localAiKey = localAiProvider?.configured ? credentialService.getCredential('local_ai') : undefined;

    const doubaoModel = getModelId('DOUBAO_MODEL', 'doubao-4o');
    const openaiModel = getModelId('OPENAI_MODEL', 'gpt-4o');
    const localAiModel = getModelId('LOCAL_AI_MODEL', 'qwen2.5:7b');
    const doubaoApiBase = getApiBase('DOUBAO_API_BASE', 'https://ark.cn-beijing.volces.com/api/v3');
    const openaiApiBase = getApiBase('OPENAI_API_BASE', 'https://api.openai.com/v1');
    const localAiApiBase = getApiBase('LOCAL_AI_API_BASE', 'http://host.docker.internal:11434/v1');

    res.json({
      success: true,
      data: {
        doubao: {
          configured: !!doubaoKey,
          masked: doubaoKey ? credentialService.mask(doubaoKey) : null,
          model: doubaoModel,
          apiBase: doubaoApiBase,
        },
        openai: {
          configured: !!openaiKey,
          masked: openaiKey ? credentialService.mask(openaiKey) : null,
          model: openaiModel,
          apiBase: openaiApiBase,
        },
        localAi: {
          configured: !!localAiApiBase && localAiApiBase !== 'http://host.docker.internal:11434/v1',
          masked: localAiKey ? credentialService.mask(localAiKey) : null,
          model: localAiModel,
          apiBase: localAiApiBase,
        },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch API key status' });
  }
});

// 获取可用模型列表
router.get('/models', (_req: Request, res: Response) => {
  try {
    const doubaoModel = getModelId('DOUBAO_MODEL', 'doubao-4o');
    const openaiModel = getModelId('OPENAI_MODEL', 'gpt-4o');
    const doubaoKey = getApiKey('DOUBAO_API_KEY');
    const openaiKey = getApiKey('OPENAI_API_KEY');

    const models: Array<{
      id: string;
      name: string;
      provider: 'doubao' | 'openai' | 'local';
      enabled: boolean;
    }> = [];

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
      models.push({ id: lm.id, name: lm.name, provider: 'local', enabled: true });
    }
    if (doubaoKey && doubaoModel) {
      models.push({ id: doubaoModel, name: `豆包 (${doubaoModel})`, provider: 'doubao', enabled: true });
    }
    if (openaiKey && openaiModel) {
      models.push({ id: openaiModel, name: `OpenAI (${openaiModel})`, provider: 'openai', enabled: true });
    }
    if (!models.some((m) => m.id === 'doubao-4o')) {
      models.push({ id: 'doubao-4o', name: '豆包 4o', provider: 'doubao', enabled: !doubaoKey });
    }
    if (!models.some((m) => m.id === 'gpt-4o')) {
      models.push({ id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', enabled: !openaiKey });
    }
    if (!models.some((m) => m.id === 'gpt-4-turbo')) {
      models.push({ id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', enabled: !openaiKey });
    }
    res.json({ success: true, data: models });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch models' });
  }
});

// 保存 API 密钥和模型配置
router.put('/api-keys', requireRole('admin'), (req: Request, res: Response) => {
  try {
    settingsCrudService.saveAiProviderConfig(req.body as any);
    res.json({ success: true, message: 'Settings saved' });
  } catch (error: unknown) {
    safeError('❌ Failed to save settings:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to save settings' });
  }
});

// 删除特定提供商的 API 配置
router.delete('/api-keys/:provider', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    safeLog(`🗑️ Deleting API configuration for provider: ${provider}`);
    const result = settingsCrudService.deleteProviderConfig(provider as 'doubao' | 'openai' | 'local');
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    safeLog(`✅ API configuration deleted for provider: ${provider}`);
    res.json({ success: true, message: 'Configuration deleted' });
  } catch (error: unknown) {
    safeError('❌ Failed to delete configuration:', error);
    res.status(500).json({ success: false, error: 'Failed to delete configuration' });
  }
});

export default router;
