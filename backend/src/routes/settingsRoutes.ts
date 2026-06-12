import { Router, Request, Response } from 'express';
import db from '../models/database';
import { safeLog, safeError, maskApiKey } from '../utils/sensitiveMask';
import { getApiKey, getModelId, getApiBase } from '../utils/apiConfig';
import { credentialService } from '../services/credentialService';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all() as Array<{ key: string; value: string }>;
    const settingsObj: Record<string, string> = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value;
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
      const upsertStmt = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, datetime('now','localtime'))
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now','localtime')
      `);
      
      for (const [key, value] of Object.entries(settings)) {
        if (typeof key !== 'string' || key.length > 100) {
          continue; // 跳过无效的键
        }
        const stringValue = String(value);
        upsertStmt.run(key, stringValue, stringValue);
      }
    }
    
    res.json({ success: true, message: 'Settings updated' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

router.get('/api-keys', (_req: Request, res: Response) => {
  try {
    // Use credential service to get API key status with masked display
    const providers = credentialService.listProviders();
    
    const doubaoProvider = providers.find(p => p.provider === 'doubao');
    const openaiProvider = providers.find(p => p.provider === 'openai');
    const localAiProvider = providers.find(p => p.provider === 'local_ai');
    
    const doubaoKey = doubaoProvider?.configured ? credentialService.getCredential('doubao') : undefined;
    const openaiKey = openaiProvider?.configured ? credentialService.getCredential('openai') : undefined;
    const localAiKey = localAiProvider?.configured ? credentialService.getCredential('local_ai') : undefined;
    
    const doubaoModel = getModelId(db, 'DOUBAO_MODEL', 'DOUBAO_MODEL', 'doubao-4o');
    const openaiModel = getModelId(db, 'OPENAI_MODEL', 'OPENAI_MODEL', 'gpt-4o');
    const localAiModel = getModelId(db, 'LOCAL_AI_MODEL', 'LOCAL_AI_MODEL', 'qwen2.5:7b');
    const doubaoApiBase = getApiBase(db, 'DOUBAO_API_BASE', 'DOUBAO_API_BASE', 'https://ark.cn-beijing.volces.com/api/v3');
    const openaiApiBase = getApiBase(db, 'OPENAI_API_BASE', 'OPENAI_API_BASE', 'https://api.openai.com/v1');
    const localAiApiBase = getApiBase(db, 'LOCAL_AI_API_BASE', 'LOCAL_AI_API_BASE', 'http://host.docker.internal:11434/v1');
    
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
    const doubaoModel = getModelId(db, 'DOUBAO_MODEL', 'DOUBAO_MODEL', 'doubao-4o');
    const openaiModel = getModelId(db, 'OPENAI_MODEL', 'OPENAI_MODEL', 'gpt-4o');
    const doubaoKey = getApiKey(db, 'DOUBAO_API_KEY', 'DOUBAO_API_KEY');
    const openaiKey = getApiKey(db, 'OPENAI_API_KEY', 'OPENAI_API_KEY');
    
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
      { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder 6.7B (Ollama)' },
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

// 保存 API 密钥和模型配置
router.put('/api-keys', (req: Request, res: Response) => {
  try {
    const { doubaoApiKey, openaiApiKey, doubaoModel, openaiModel, doubaoApiBase, openaiApiBase, localAiModel, localAiApiBase } = req.body;
    
    safeLog('🔧 Saving API key settings...');
    
    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now','localtime'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now','localtime')
    `);
    
    // 保存豆包 API 密钥（如果提供）- store encrypted via credential service
    if (doubaoApiKey !== undefined) {
      if (doubaoApiKey === '') {
        safeLog('Deleting DOUBAO_API_KEY');
        db.prepare('DELETE FROM settings WHERE key = ?').run('DOUBAO_API_KEY');
        credentialService.deleteCredential('doubao');
      } else {
        safeLog('Saving DOUBAO_API_KEY (encrypted):', maskApiKey(doubaoApiKey));
        credentialService.setCredential('doubao', doubaoApiKey);
        // Also keep in settings for backwards compatibility
        upsertStmt.run('DOUBAO_API_KEY', doubaoApiKey, doubaoApiKey);
      }
    }
    
    // 保存 OpenAI API 密钥（如果提供）- store encrypted via credential service
    if (openaiApiKey !== undefined) {
      if (openaiApiKey === '') {
        safeLog('Deleting OPENAI_API_KEY');
        db.prepare('DELETE FROM settings WHERE key = ?').run('OPENAI_API_KEY');
        credentialService.deleteCredential('openai');
      } else {
        safeLog('Saving OPENAI_API_KEY (encrypted):', maskApiKey(openaiApiKey));
        credentialService.setCredential('openai', openaiApiKey);
        // Also keep in settings for backwards compatibility
        upsertStmt.run('OPENAI_API_KEY', openaiApiKey, openaiApiKey);
      }
    }
    
    // 保存豆包模型 ID（如果提供）
    if (doubaoModel !== undefined) {
      if (doubaoModel === '') {
        db.prepare('DELETE FROM settings WHERE key = ?').run('DOUBAO_MODEL');
      } else {
        upsertStmt.run('DOUBAO_MODEL', doubaoModel, doubaoModel);
      }
    }
    
    // 保存 OpenAI 模型 ID（如果提供）
    if (openaiModel !== undefined) {
      if (openaiModel === '') {
        db.prepare('DELETE FROM settings WHERE key = ?').run('OPENAI_MODEL');
      } else {
        upsertStmt.run('OPENAI_MODEL', openaiModel, openaiModel);
      }
    }
    
    // 保存豆包 API 地址（如果提供）
    if (doubaoApiBase !== undefined) {
      if (doubaoApiBase === '') {
        db.prepare('DELETE FROM settings WHERE key = ?').run('DOUBAO_API_BASE');
      } else {
        upsertStmt.run('DOUBAO_API_BASE', doubaoApiBase, doubaoApiBase);
      }
    }
    
    // 保存 OpenAI API 地址（如果提供）
    if (openaiApiBase !== undefined) {
      if (openaiApiBase === '') {
        db.prepare('DELETE FROM settings WHERE key = ?').run('OPENAI_API_BASE');
      } else {
        upsertStmt.run('OPENAI_API_BASE', openaiApiBase, openaiApiBase);
      }
    }
    
    // 保存本地 AI 模型（如果提供）
    if (localAiModel !== undefined) {
      if (localAiModel === '') {
        db.prepare('DELETE FROM settings WHERE key = ?').run('LOCAL_AI_MODEL');
      } else {
        upsertStmt.run('LOCAL_AI_MODEL', localAiModel, localAiModel);
      }
    }
    
    // 保存本地 AI API 地址（如果提供）
    if (localAiApiBase !== undefined) {
      if (localAiApiBase === '') {
        db.prepare('DELETE FROM settings WHERE key = ?').run('LOCAL_AI_API_BASE');
      } else {
        upsertStmt.run('LOCAL_AI_API_BASE', localAiApiBase, localAiApiBase);
      }
    }
    
    // Store local AI key if there's a way to provide it
    // (local model settings currently don't include apiKey field, but we check if it was sent)
    if ((req.body as any).localAiApiKey !== undefined) {
      const localAiApiKey = (req.body as any).localAiApiKey;
      if (localAiApiKey === '') {
        credentialService.deleteCredential('local_ai');
      } else if (localAiApiKey) {
        credentialService.setCredential('local_ai', localAiApiKey);
      }
    }
    
    // 自动更新预设Agent的模型字段
    // 先确定用户配置的模型（优先检查本地 AI，然后是豆包，最后是 OpenAI）
    let configuredModel: string | null = null;
    
    // Check credential service first for API keys
    const credDoubaoKey = credentialService.getCredential('doubao');
    const credOpenaiKey = credentialService.getCredential('openai');
    
    // 优先检查本地 AI（如果配置了非默认地址）
    const localAiApiBaseResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('LOCAL_AI_API_BASE');
    if (localAiApiBaseResult && (localAiApiBaseResult as { value: string }).value && 
        (localAiApiBaseResult as { value: string }).value !== 'http://host.docker.internal:11434/v1') {
      const localAiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('LOCAL_AI_MODEL');
      configuredModel = (localAiModelResult && (localAiModelResult as { value: string }).value) ? (localAiModelResult as { value: string }).value : 'qwen2.5:7b';
    } else {
      // 检查豆包是否已配置（via credential or settings）
      if (credDoubaoKey && credDoubaoKey !== 'your-doubao-api-key-here') {
        const doubaoModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_MODEL');
        configuredModel = (doubaoModelResult && (doubaoModelResult as { value: string }).value) ? (doubaoModelResult as { value: string }).value : 'doubao-4o';
      } else {
        // 如果豆包没有配置，回退到 settings 表（backwards compat）
        const doubaoKeyResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_API_KEY');
        const doubaoModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_MODEL');
        if (doubaoKeyResult && (doubaoKeyResult as { value: string }).value && (doubaoKeyResult as { value: string }).value !== 'your-doubao-api-key-here') {
          configuredModel = (doubaoModelResult && (doubaoModelResult as { value: string }).value) ? (doubaoModelResult as { value: string }).value : 'doubao-4o';
        } else {
          // 检查OpenAI（via credential or settings）
          if (credOpenaiKey && credOpenaiKey !== 'your-openai-api-key-here') {
            const openaiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_MODEL');
            configuredModel = (openaiModelResult && (openaiModelResult as { value: string }).value) ? (openaiModelResult as { value: string }).value : 'gpt-4o';
          } else {
            const openaiKeyResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_API_KEY');
            const openaiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_MODEL');
            if (openaiKeyResult && (openaiKeyResult as { value: string }).value && (openaiKeyResult as { value: string }).value !== 'your-openai-api-key-here') {
              configuredModel = (openaiModelResult && (openaiModelResult as { value: string }).value) ? (openaiModelResult as { value: string }).value : 'gpt-4o';
            }
          }
        }
      }
    }
    
    // 如果有配置的模型，更新所有预设Agent
    if (configuredModel) {
      const updateStmt = db.prepare(`
        UPDATE agents 
        SET model = ?, updated_at = datetime('now','localtime') 
        WHERE is_preset = 1
      `);
      const result = updateStmt.run(configuredModel);
      safeLog(`✅ Updated ${(result as { changes: number }).changes} preset agents with model: ${configuredModel}`);
    } else {
      // 如果没有配置模型，清空所有预设Agent的model字段
      const updateStmt = db.prepare(`
        UPDATE agents 
        SET model = NULL, updated_at = datetime('now','localtime') 
        WHERE is_preset = 1
      `);
      const result = updateStmt.run();
      safeLog(`✅ Cleared model from ${(result as { changes: number }).changes} preset agents`);
    }
    
    safeLog('✅ API key settings saved successfully');
    res.json({ success: true, message: 'Settings saved' });
  } catch (error: unknown) {
    safeError('❌ Failed to save settings:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to save settings' });
  }
});

// 删除特定提供商的API配置
router.delete('/api-keys/:provider', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    safeLog(`🗑️ Deleting API configuration for provider: ${provider}`);

    if (provider === 'doubao') {
      db.prepare('DELETE FROM settings WHERE key = ?').run('DOUBAO_API_KEY');
      db.prepare('DELETE FROM settings WHERE key = ?').run('DOUBAO_MODEL');
      db.prepare('DELETE FROM settings WHERE key = ?').run('DOUBAO_API_BASE');
      credentialService.deleteCredential('doubao');
    } else if (provider === 'openai') {
      db.prepare('DELETE FROM settings WHERE key = ?').run('OPENAI_API_KEY');
      db.prepare('DELETE FROM settings WHERE key = ?').run('OPENAI_MODEL');
      db.prepare('DELETE FROM settings WHERE key = ?').run('OPENAI_API_BASE');
      credentialService.deleteCredential('openai');
    } else if (provider === 'local') {
      db.prepare('DELETE FROM settings WHERE key = ?').run('LOCAL_AI_MODEL');
      db.prepare('DELETE FROM settings WHERE key = ?').run('LOCAL_AI_API_BASE');
      credentialService.deleteCredential('local_ai');
    } else {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }
    
    // 删除配置后，检查是否还有其他可用配置
    let hasRemainingConfig = false;
    let configuredModel: string | null = null;
    
    // Check credential service for remaining keys
    const credDoubaoKey = credentialService.getCredential('doubao');
    const credOpenaiKey = credentialService.getCredential('openai');
    
    // 优先检查本地 AI
    const localAiApiBase = db.prepare('SELECT value FROM settings WHERE key = ?').get('LOCAL_AI_API_BASE');
    if (localAiApiBase && (localAiApiBase as { value: string }).value && 
        (localAiApiBase as { value: string }).value !== 'http://host.docker.internal:11434/v1') {
      hasRemainingConfig = true;
      const localAiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('LOCAL_AI_MODEL');
      configuredModel = (localAiModelResult && (localAiModelResult as { value: string }).value) ? (localAiModelResult as { value: string }).value : 'qwen2.5:7b';
    } else if (credDoubaoKey) {
      hasRemainingConfig = true;
      const doubaoModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_MODEL');
      configuredModel = (doubaoModelResult && (doubaoModelResult as { value: string }).value) ? (doubaoModelResult as { value: string }).value : 'doubao-4o';
    } else if (credOpenaiKey) {
      hasRemainingConfig = true;
      const openaiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_MODEL');
      configuredModel = (openaiModelResult && (openaiModelResult as { value: string }).value) ? (openaiModelResult as { value: string }).value : 'gpt-4o';
    } else {
      // 回退到 settings 表检查（backwards compat）
      const doubaoKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_API_KEY');
      if (doubaoKey && (doubaoKey as { value: string }).value && (doubaoKey as { value: string }).value !== 'your-doubao-api-key-here') {
        hasRemainingConfig = true;
        const doubaoModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_MODEL');
        configuredModel = (doubaoModelResult && (doubaoModelResult as { value: string }).value) ? (doubaoModelResult as { value: string }).value : 'doubao-4o';
      } else {
        const openaiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_API_KEY');
        if (openaiKey && (openaiKey as { value: string }).value && (openaiKey as { value: string }).value !== 'your-openai-api-key-here') {
          hasRemainingConfig = true;
          const openaiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_MODEL');
          configuredModel = (openaiModelResult && (openaiModelResult as { value: string }).value) ? (openaiModelResult as { value: string }).value : 'gpt-4o';
        }
      }
    }
    
    if (!hasRemainingConfig) {
      // 如果没有配置了，清空所有预设Agent的model字段
      const updateStmt = db.prepare(`
        UPDATE agents 
        SET model = NULL, updated_at = datetime('now','localtime') 
        WHERE is_preset = 1
      `);
      const result = updateStmt.run();
      safeLog(`✅ Cleared model from ${(result as { changes: number }).changes} preset agents (no API keys configured)`);
    } else if (configuredModel) {
      const updateStmt = db.prepare(`
        UPDATE agents 
        SET model = ?, updated_at = datetime('now','localtime') 
        WHERE is_preset = 1
      `);
      const result = updateStmt.run(configuredModel);
      safeLog(`✅ Updated ${(result as { changes: number }).changes} preset agents with model: ${configuredModel} (after deleting one provider)`);
    }

    safeLog(`✅ API configuration deleted for provider: ${provider}`);
    res.json({ success: true, message: 'Configuration deleted' });
  } catch (error: unknown) {
    safeError('❌ Failed to delete configuration:', error);
    res.status(500).json({ success: false, error: 'Failed to delete configuration' });
  }
});

export default router;
