import type Database from 'better-sqlite3';
import { credentialService } from '../services/credentialService';

interface SettingsRecord {
  value: string;
}

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
 * Get API key from encrypted credential store first, then env vars, then settings table
 */
export function getApiKey(database: Database.Database, keyName: string, envName: string): string | undefined {
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

  // 2. Try environment variable
  const envValue = process.env[envName];
  if (envValue && !isPlaceholder(envValue)) {
    return envValue;
  }

  // 3. Fall back to settings table (plaintext, backwards compatibility)
  try {
    const result = database.prepare('SELECT value FROM settings WHERE key = ?').get(keyName);
    if (result && (result as SettingsRecord).value) {
      const value = (result as SettingsRecord).value;
      if (value && !isPlaceholder(value)) {
        return value;
      }
    }
  } catch {
    // Ignore database errors
  }

  // 4. Try any env var with case-insensitive match (unlikely but safe)
  const altEnvValue = process.env[keyName];
  if (altEnvValue && !isPlaceholder(altEnvValue)) {
    return altEnvValue;
  }

  return undefined;
}

/**
 * Get model ID (prefer database, fall back to env vars)
 */
export function getModelId(database: Database.Database, keyName: string, envName: string, defaultValue: string): string {
  try {
    const result = database.prepare('SELECT value FROM settings WHERE key = ?').get(keyName);
    if (result && (result as SettingsRecord).value) {
      return (result as SettingsRecord).value;
    }
  } catch {
    // Ignore database errors, fall back to environment variable
  }
  return process.env[envName] || defaultValue;
}

/**
 * Get API base URL (prefer database, fall back to env vars)
 */
export function getApiBase(database: Database.Database, keyName: string, envName: string, defaultValue: string): string {
  try {
    const result = database.prepare('SELECT value FROM settings WHERE key = ?').get(keyName);
    if (result && (result as SettingsRecord).value) {
      return (result as SettingsRecord).value;
    }
  } catch {
    // Ignore database errors, fall back to environment variable
  }
  return process.env[envName] || defaultValue;
}

/**
 * Build the full API endpoint URL, avoiding duplicate path segments
 */
export function buildApiEndpoint(apiBase: string, endpoint: string): string {
  const cleanApiBase = apiBase.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  return `${cleanApiBase}/${cleanEndpoint}`;
}
