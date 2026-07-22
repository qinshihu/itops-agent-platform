/**
 * Settings 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中：
 *   1. 通用 settings 读写（getAll / upsertMany）
 *   2. AI provider 配置（豆包/OpenAI/Local AI）的 settings 持久化
 *   3. 预设 Agent 模型同步（syncPresetAgentModel）
 *
 * 阶段：P1-6 infra 拆分，从 modules/infra/services/settingsCrudService.ts 迁出
 */
import { settingsRepository, agentRepository } from '../../../repositories';
import { credentialService } from '../../auth/services/credentialService';
import { safeLog } from '../../../utils/sensitiveMask';

const VALID_KEY = /^[a-zA-Z0-9_-]{1,100}$/;

/**
 * 根据当前配置确定首选 AI 模型（优先级：local > doubao > openai）
 */
function determineConfiguredModel(): string | null {
  // 优先检查本地 AI
  const localAiApiBase = settingsRepository.getValue('LOCAL_AI_API_BASE');
  if (localAiApiBase && localAiApiBase !== 'http://host.docker.internal:11434/v1') {
    return settingsRepository.getValue('LOCAL_AI_MODEL') || 'qwen2.5:7b';
  }

  // 豆包（via credential）
  const credDoubaoKey = credentialService.getCredential('doubao');
  if (credDoubaoKey && credDoubaoKey !== 'your-doubao-api-key-here') {
    return settingsRepository.getValue('DOUBAO_MODEL') || 'doubao-4o';
  }
  // 豆包（via settings，backwards compat）
  const doubaoKeySetting = settingsRepository.getValue('DOUBAO_API_KEY');
  if (doubaoKeySetting && doubaoKeySetting !== 'your-doubao-api-key-here') {
    return settingsRepository.getValue('DOUBAO_MODEL') || 'doubao-4o';
  }

  // OpenAI
  const credOpenaiKey = credentialService.getCredential('openai');
  if (credOpenaiKey && credOpenaiKey !== 'your-openai-api-key-here') {
    return settingsRepository.getValue('OPENAI_MODEL') || 'gpt-4o';
  }
  const openaiKeySetting = settingsRepository.getValue('OPENAI_API_KEY');
  if (openaiKeySetting && openaiKeySetting !== 'your-openai-api-key-here') {
    return settingsRepository.getValue('OPENAI_MODEL') || 'gpt-4o';
  }

  return null;
}

export const settingsCrudService = {
  // ── 通用 settings ──

  getAllSettings(): Record<string, string> {
    const settings = settingsRepository.getAll();
    const obj: Record<string, string> = {};
    settings.forEach((s) => {
      obj[s.key] = s.value ?? '';
    });
    return obj;
  },

  /**
   * 批量更新 settings（自动过滤非法 key）
   */
  upsertMany(input: Record<string, unknown>) {
    if (!input || typeof input !== 'object') {
      return { success: false as const, error: 'Invalid settings data' };
    }
    const entries: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof key !== 'string' || !VALID_KEY.test(key)) continue;
      entries[key] = String(value);
    }
    if (Object.keys(entries).length > 0) {
      settingsRepository.upsertMany(entries);
    }
    return { success: true as const };
  },

  // ── AI Provider 持久化 ──

  /**
   * 保存 AI provider 配置（豆包/OpenAI/Local AI）
   * 调用 credential service 加密 + settings 持久化
   */
  saveAiProviderConfig(input: {
    doubaoApiKey?: string;
    openaiApiKey?: string;
    doubaoModel?: string;
    openaiModel?: string;
    doubaoApiBase?: string;
    openaiApiBase?: string;
    localAiModel?: string;
    localAiApiBase?: string;
    localAiApiKey?: string;
  }) {
    safeLog('🔧 Saving API key settings...');

    // 豆包 API key
    if (input.doubaoApiKey !== undefined) {
      if (input.doubaoApiKey === '') {
        safeLog('Deleting DOUBAO_API_KEY');
        settingsRepository.delete('DOUBAO_API_KEY');
        credentialService.deleteCredential('doubao');
      } else {
        credentialService.setCredential('doubao', input.doubaoApiKey);
        settingsRepository.upsert('DOUBAO_API_KEY', input.doubaoApiKey);
      }
    }
    // OpenAI API key
    if (input.openaiApiKey !== undefined) {
      if (input.openaiApiKey === '') {
        safeLog('Deleting OPENAI_API_KEY');
        settingsRepository.delete('OPENAI_API_KEY');
        credentialService.deleteCredential('openai');
      } else {
        credentialService.setCredential('openai', input.openaiApiKey);
        settingsRepository.upsert('OPENAI_API_KEY', input.openaiApiKey);
      }
    }
    // 豆包 model
    this.upsertOrDelete('DOUBAO_MODEL', input.doubaoModel);
    // OpenAI model
    this.upsertOrDelete('OPENAI_MODEL', input.openaiModel);
    // 豆包 api base
    this.upsertOrDelete('DOUBAO_API_BASE', input.doubaoApiBase);
    // OpenAI api base
    this.upsertOrDelete('OPENAI_API_BASE', input.openaiApiBase);
    // Local AI model
    this.upsertOrDelete('LOCAL_AI_MODEL', input.localAiModel);
    // Local AI api base
    this.upsertOrDelete('LOCAL_AI_API_BASE', input.localAiApiBase);
    // Local AI key
    if (input.localAiApiKey !== undefined) {
      if (input.localAiApiKey === '') {
        credentialService.deleteCredential('local_ai');
      } else if (input.localAiApiKey) {
        credentialService.setCredential('local_ai', input.localAiApiKey);
      }
    }

    this.syncPresetAgentModel('save');
  },

  /**
   * 内部辅助：upsert 或 delete 单个 key（undefined 跳过，empty string 删除）
   */
  upsertOrDelete(key: string, value: string | undefined) {
    if (value === undefined) return;
    if (value === '') {
      settingsRepository.delete(key);
    } else {
      settingsRepository.upsert(key, value);
    }
  },

  /**
   * 删除 provider 的所有配置
   */
  deleteProviderConfig(provider: 'doubao' | 'openai' | 'local'): { success: true } | { success: false; error: string } {
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
      return { success: false, error: 'Invalid provider' };
    }
    this.syncPresetAgentModel('delete');
    return { success: true };
  },

  /**
   * 同步预设 Agent 模型（从当前 AI provider 配置推断）
   */
  syncPresetAgentModel(action: 'save' | 'delete') {
    const configuredModel = determineConfiguredModel();
    if (configuredModel) {
      const changes = agentRepository.updatePresetModel(configuredModel);
      safeLog(`✅ Updated ${changes} preset agents with model: ${configuredModel}${action === 'delete' ? ' (after deleting one provider)' : ''}`);
    } else {
      const changes = agentRepository.clearPresetModel();
      safeLog(`✅ Cleared model from ${changes} preset agents${action === 'delete' ? ' (no API keys configured)' : ''}`);
    }
  },
};
