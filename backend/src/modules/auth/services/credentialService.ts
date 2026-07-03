import crypto from 'crypto';
import { credentialRepository } from '../../../repositories/credentialRepository';
import { settingsRepository } from '../../../repositories/settingsRepository';
import { env } from '../../../utils/env';
import { logger } from '../../../utils/logger';
import { maskApiKey } from '../../../utils/sensitiveMask';

// AES-256-GCM configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha512';

// Key version constants
// v1: fixed salt (legacy, kept for decrypting existing credentials only)
// v2: deployment-specific salt derived from JWT_SECRET (eliminates cross-deployment key reuse)
const KEY_VERSION_LEGACY = 1;
const KEY_VERSION_CURRENT = 2;
const LEGACY_SALT = 'credential-service-v1-salt';

function deriveV2Salt(jwtSecret: string): string {
  return crypto.createHash('sha256').update(jwtSecret).digest('hex').substring(0, 32);
}

// In-memory cache TTL (60 seconds)
const CACHE_TTL_MS = 60_000;

interface CredentialRecord {
  provider: string;
  encrypted_value: string;
  key_version: number;
  created_at: string;
  updated_at: string;
}

interface CachedEntry {
  value: string;
  fetchedAt: number;
}

export class CredentialService {
  private keys: Map<number, Buffer> = new Map();
  private cache = new Map<string, CachedEntry>();
  private initialized = false;

  /**
   * Initialize the credential service: derive master keys from JWT_SECRET
   */
  init(): void {
    if (this.initialized) return;
    this.deriveMasterKeys();
    this.initialized = true;
    this.rotateLegacyCredentials();
    logger.info('🔐 CredentialService initialized');
  }

  /**
   * Derive AES-256-GCM master keys from JWT_SECRET using PBKDF2
   * - v1 key: legacy fixed salt (for decrypting existing v1 credentials)
   * - v2 key: deployment-specific salt (for new credentials)
   */
  private deriveMasterKeys(): void {
    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required for credential encryption');
    }
    this.keys.set(KEY_VERSION_LEGACY, crypto.pbkdf2Sync(
      jwtSecret, LEGACY_SALT, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST
    ));
    this.keys.set(KEY_VERSION_CURRENT, crypto.pbkdf2Sync(
      jwtSecret, deriveV2Salt(jwtSecret), PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST
    ));
    logger.info('🔑 Credential master keys derived from JWT_SECRET (v1 legacy + v2 current)');
  }

  private getKey(version: number): Buffer {
    const key = this.keys.get(version);
    if (!key) {
      throw new Error(`Unknown key version: ${version}`);
    }
    return key;
  }

  private getMasterKey(): Buffer {
    return this.getKey(KEY_VERSION_CURRENT);
  }

  /**
   * Best-effort migration: re-encrypt v1 credentials with v2 key.
   * Failures are logged but do not block startup (v1 key still available for reads).
   */
  private rotateLegacyCredentials(): void {
    try {
      const legacy = credentialRepository.listByKeyVersion(KEY_VERSION_LEGACY);
      if (legacy.length === 0) return;

      logger.info(`🔄 Rotating ${legacy.length} legacy credential(s) to v2 key...`);
      let rotated = 0;
      for (const record of legacy) {
        try {
          const plaintext = this.decryptWithVersion(record.encrypted_value, KEY_VERSION_LEGACY);
          const reencrypted = this.encryptWithVersion(plaintext, KEY_VERSION_CURRENT);
          credentialRepository.updateRotation(record.provider, reencrypted, KEY_VERSION_CURRENT);
          rotated++;
        } catch (err) {
          logger.warn(`Failed to rotate credential for ${record.provider}: ${(err as Error).message}`);
        }
      }
      logger.info(`✅ Rotated ${rotated}/${legacy.length} credential(s) to v2 key`);
    } catch (err) {
      logger.warn(`Legacy credential rotation skipped: ${(err as Error).message}`);
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM with the specified key version
   * Returns format: iv:authTag:ciphertext (all base64)
   */
  private encryptWithVersion(plaintext: string, version: number): string {
    if (!plaintext) return '';
    const key = this.getKey(version);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  private encrypt(plaintext: string): string {
    return this.encryptWithVersion(plaintext, KEY_VERSION_CURRENT);
  }

  /**
   * Decrypt ciphertext using AES-256-GCM with the specified key version
   */
  private decryptWithVersion(encryptedString: string, version: number): string {
    if (!encryptedString) return '';
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encryptedData = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(version), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  private decrypt(encryptedString: string): string {
    try {
      return this.decryptWithVersion(encryptedString, KEY_VERSION_CURRENT);
    } catch (error) {
      logger.error('Credential decryption failed', error as Error);
      throw new Error('Failed to decrypt credential');
    }
  }

  private decryptRecord(record: CredentialRecord): string {
    const version = record.key_version ?? KEY_VERSION_LEGACY;
    return this.decryptWithVersion(record.encrypted_value, version);
  }

  /**
   * Check if the cache entry is still valid
   */
  private isCacheValid(entry: CachedEntry | undefined): boolean {
    if (!entry) return false;
    return (Date.now() - entry.fetchedAt) < CACHE_TTL_MS;
  }

  /**
   * Invalidate cache for a specific provider
   */
  private invalidateCache(provider: string): void {
    this.cache.delete(provider);
  }

  /**
   * Store an encrypted credential for the given provider
   */
  setCredential(provider: string, value: string): void {
    if (!this.initialized) this.init();
    const providerLower = provider.toLowerCase();
    const encrypted = this.encrypt(value);

    try {
      credentialRepository.upsert(providerLower, encrypted, KEY_VERSION_CURRENT);
      this.invalidateCache(providerLower);
      logger.info(`🔐 Credential saved for provider: ${providerLower}`);
    } catch (error) {
      logger.error(`Failed to save credential for provider: ${providerLower}`, error as Error);
      throw new Error(`Failed to save credential: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve and decrypt a credential for the given provider
   */
  getCredential(provider: string): string | undefined {
    if (!this.initialized) this.init();
    const providerLower = provider.toLowerCase();

    // Check cache first
    const cached = this.cache.get(providerLower);
    if (this.isCacheValid(cached) && cached) {
      return cached.value;
    }

    try {
      const record = credentialRepository.getByProvider(providerLower);
      if (!record) return undefined;

      const version = record.key_version ?? KEY_VERSION_LEGACY;
      const plaintext = this.decryptWithVersion(record.encrypted_value, version);

      // Update cache
      this.cache.set(providerLower, { value: plaintext, fetchedAt: Date.now() });

      return plaintext;
    } catch (error) {
      logger.error(`Failed to get credential for provider: ${providerLower}`, error as Error);
      return undefined;
    }
  }

  /**
   * Delete a credential for the given provider
   */
  deleteCredential(provider: string): void {
    if (!this.initialized) this.init();
    const providerLower = provider.toLowerCase();

    try {
      credentialRepository.deleteByProvider(providerLower);
      this.invalidateCache(providerLower);
      logger.info(`🔐 Credential deleted for provider: ${providerLower}`);
    } catch (error) {
      logger.error(`Failed to delete credential for provider: ${providerLower}`, error as Error);
      throw new Error(`Failed to delete credential: ${(error as Error).message}`);
    }
  }

  /**
   * 加密凭证（供 vmManagement 等模块调用）
   * 返回加密后的密文和 IV（组合格式）
   */
  encryptCredential(plaintext: string): { encrypted: string; iv: string } {
    if (!this.initialized) this.init();
    const combined = this.encrypt(plaintext);
    // 格式: iv:authTag:ciphertext，提取 iv 和完整密文
    const parts = combined.split(':');
    return {
      encrypted: combined,
      iv: parts[0] || '',
    };
  }

  /**
   * 解密凭证（供 vmManagement 等模块调用）
   * @param encrypted 加密后的完整密文（iv:authTag:ciphertext 格式）
   * @param iv 未使用，保留参数兼容性
   *
   * 向后兼容：先尝试 v2 密钥，失败后回退 v1（用于解密迁移前已存储的密文）
   */
  decryptCredential(encrypted: string, _iv?: string): string {
    if (!this.initialized) this.init();
    try {
      return this.decryptWithVersion(encrypted, KEY_VERSION_CURRENT);
    } catch {
      return this.decryptWithVersion(encrypted, KEY_VERSION_LEGACY);
    }
  }

  /**
   * List all configured providers with masked values
   */
  listProviders(): Array<{ provider: string; configured: boolean; masked?: string; createdAt: string }> {
    if (!this.initialized) this.init();

    try {
      const records = credentialRepository.listAll();
      const knownProviders = ['doubao', 'openai', 'local_ai', 'alert_email', 'alert_webhook'];

      const configuredMap = new Set(records.map(r => r.provider));
      const result: Array<{ provider: string; configured: boolean; masked?: string; createdAt: string }> = [];

      for (const provider of knownProviders) {
        if (configuredMap.has(provider)) {
          const record = records.find(r => r.provider === provider)!;
          try {
            const plaintext = this.decryptRecord(record);
            result.push({
              provider,
              configured: true,
              masked: this.mask(plaintext),
              createdAt: record.created_at
            });
          } catch {
            result.push({
              provider,
              configured: true,
              masked: '***DECRYPT-ERROR***',
              createdAt: record.created_at
            });
          }
        } else {
          // Provider not configured - still show it for UI convenience
          result.push({
            provider,
            configured: false,
            createdAt: ''
          });
        }
      }

      // Include any unknown providers too
      for (const record of records) {
        if (!knownProviders.includes(record.provider)) {
          try {
            const plaintext = this.decryptRecord(record);
            result.push({
              provider: record.provider,
              configured: true,
              masked: this.mask(plaintext),
              createdAt: record.created_at
            });
          } catch {
            result.push({
              provider: record.provider,
              configured: true,
              masked: '***DECRYPT-ERROR***',
              createdAt: record.created_at
            });
          }
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to list credential providers', error as Error);
      return [];
    }
  }

  /**
   * Mask a value: show first 4 chars + "****" + last 4 chars
   */
  mask(value: string): string {
    return maskApiKey(value);
  }

  /**
   * Migrate existing API keys from settings table to credentials table
   */
  migrateFromSettings(): { migrated: number; skipped: number } {
    if (!this.initialized) this.init();

    const settingsToProviders: Array<{ settingKey: string; provider: string; isSensitive: boolean }> = [
      { settingKey: 'DOUBAO_API_KEY', provider: 'doubao', isSensitive: true },
      { settingKey: 'OPENAI_API_KEY', provider: 'openai', isSensitive: true },
      { settingKey: 'LOCAL_AI_API_KEY', provider: 'local_ai', isSensitive: false },
      { settingKey: 'ALERT_EMAIL_HOST', provider: 'alert_email_host', isSensitive: false },
      { settingKey: 'ALERT_EMAIL_USER', provider: 'alert_email_user', isSensitive: true },
      { settingKey: 'ALERT_EMAIL_PASS', provider: 'alert_email_pass', isSensitive: true },
      { settingKey: 'ALERT_EMAIL_TO', provider: 'alert_email_to', isSensitive: false },
      { settingKey: 'ALERT_WEBHOOK_URL', provider: 'alert_webhook', isSensitive: false },
    ];

    let migrated = 0;
    let skipped = 0;

    for (const { settingKey, provider, isSensitive } of settingsToProviders) {
      try {
        const existingCred = credentialRepository.getByProvider(provider);
        if (existingCred) {
          skipped++;
          continue;
        }

        const settingValue = settingsRepository.getValue(settingKey);
        if (!settingValue) {
          skipped++;
          continue;
        }

        const value = settingValue;
        // Skip placeholder values
        if (value.startsWith('your-') && value.endsWith('-here')) {
          skipped++;
          continue;
        }

        // For alert_email, collect all related fields and store as JSON
        if (settingKey === 'ALERT_EMAIL_HOST') {
          const user = this.getSettingValue('ALERT_EMAIL_USER') || '';
          const pass = this.getSettingValue('ALERT_EMAIL_PASS') || '';
          const to = this.getSettingValue('ALERT_EMAIL_TO') || '';
          const emailConfig = JSON.stringify({ host: value, user, pass, to });
          this.setCredential('alert_email', emailConfig);
          migrated++;
          continue;
        }

        if (isSensitive) {
          this.setCredential(provider, value);
          migrated++;
          logger.info(`✅ Migrated ${settingKey} to credential service (provider: ${provider})`);
        } else {
          this.setCredential(provider, value);
          migrated++;
          logger.info(`✅ Migrated ${settingKey} to credential service (provider: ${provider})`);
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to migrate ${settingKey}`, error as Error);
        skipped++;
      }
    }

    // Also check notification_settings for email config (JSON blob)
    try {
      const existingCred = credentialRepository.getByProvider('alert_email');
      if (!existingCred) {
        const notificationEmailConfig = settingsRepository.getValue('notification_email_config');
        if (notificationEmailConfig) {
          try {
            const config = JSON.parse(notificationEmailConfig);
            if (config.user || config.password) {
              const alertEmailHost = settingsRepository.getValue('ALERT_EMAIL_HOST');
              const alertEmailTo = settingsRepository.getValue('ALERT_EMAIL_TO');
              const emailConfig = {
                host: alertEmailHost || config.smtp_host || '',
                user: config.user || '',
                pass: config.password || '',
                to: alertEmailTo || ''
              };
              this.setCredential('alert_email', JSON.stringify(emailConfig));
              migrated++;
              logger.info('✅ Migrated notification_email_config to credential service');
            }
          } catch {
            // not a valid JSON, skip
          }
        }
      } else {
        skipped++;
      }
    } catch {
      // table might not exist yet
    }

    logger.info(`🔐 Credential migration complete: ${migrated} migrated, ${skipped} skipped`);
    return { migrated, skipped };
  }

  private getSettingValue(key: string): string | undefined {
    try {
      return settingsRepository.getValue(key);
    } catch {
      return undefined;
    }
  }

  /**
   * Check health of the credential service
   */
  health(): { status: string; providers: number } {
    try {
      if (!this.initialized) this.init();
      const count = credentialRepository.countAll();
      return { status: 'ok', providers: count };
    } catch (_error) {
      return { status: 'error', providers: 0 };
    }
  }
}

// Singleton instance
export const credentialService = new CredentialService();
