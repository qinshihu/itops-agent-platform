import { credentialService } from '../modules/auth/services/credentialService';
import { settingsRepository } from '../repositories';

/**
 * Map a settings key to the corresponding credential provider name
 */
function settingKeyToProvider(keyName: string): string | undefined {
  const mapping: Record<string, string> = {
    'OPENAI_API_KEY': 'openai',
    'DOUBAO_API_KEY': 'doubao',
    'LOCAL_AI_API_KEY': 'local_ai',
    'DEEPSEEK_API_KEY': 'deepseek',
    'VOLCENGINE_API_KEY': 'volcengine',
    'ALIYUN_API_KEY': 'aliyun',
    'ZHIPU_API_KEY': 'zhipu',
  };
  return mapping[keyName];
}

/**
 * Check if a value is a placeholder/default value
 */
function isPlaceholder(value: string): boolean {
  const placeholders = [
    'your-doubao-api-key-here',
    'your-openai-api-key-here',
    'your-volcengine-api-key-here',
    'your-local-ai-api-key-here',
    'your-deepseek-api-key-here',
    'your-aliyun-api-key-here',
    'your-zhipu-api-key-here',
  ];
  return placeholders.includes(value);
}

/**
 * Get API key from encrypted credential store first, then settings table
 */
export function getApiKey(keyName: string): string | undefined {
  // 1. Try credential service first (encrypted storage)
  try {
    const provider = settingKeyToProvider(keyName);
    if (provider) {
      const credentialValue = credentialService.getCredential(provider);
      if (credentialValue && !isPlaceholder(credentialValue)) {
        return credentialValue;
      }
    }
  } catch {
    // Credential service not available, fall through
  }

  // 2. Fall back to settings table (plaintext, backwards compatibility)
  try {
    const value = settingsRepository.getValue(keyName);
    if (value && !isPlaceholder(value)) {
      return value;
    }
  } catch {
    // Ignore database errors
  }

  return undefined;
}

/**
 * Get model ID from settings table
 */
export function getModelId(keyName: string, defaultValue: string): string {
  try {
    const value = settingsRepository.getValue(keyName);
    if (value) {
      return value;
    }
  } catch {
    // Ignore database errors
  }
  return defaultValue;
}

/**
 * Get API base URL from settings table
 */
export function getApiBase(keyName: string, defaultValue: string): string {
  try {
    const value = settingsRepository.getValue(keyName);
    if (value) {
      return value;
    }
  } catch {
    // Ignore database errors
  }
  return defaultValue;
}

/**
 * Build the full API endpoint URL, avoiding duplicate path segments
 */
export function buildApiEndpoint(apiBase: string, endpoint: string): string {
  const cleanApiBase = apiBase.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  return `${cleanApiBase}/${cleanEndpoint}`;
}
