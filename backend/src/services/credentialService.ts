import crypto from 'crypto';
import db from '../models/database';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { maskApiKey } from '../utils/sensitiveMask';

// AES-256-GCM configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha512';
const SALT = 'credential-service-v1-salt'; // Fixed salt for credential key derivation

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
  private masterKey: Buffer | null = null;
  private cache = new Map<string, CachedEntry>();
  private initialized = false;

  /**
   * Initialize the credential service: derive master key from JWT_SECRET
   */
  init(): void {
    if (this.initialized) return;
    this.deriveMasterKey();
    this.ensureTable();
    this.initialized = true;
    logger.info('🔐 CredentialService initialized');
  }

  /**
   * Derive the AES-256-GCM master key from JWT_SECRET using PBKDF2
   */
  private deriveMasterKey(): void {
    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required for credential encryption');
    }
    this.masterKey = crypto.pbkdf2Sync(
      jwtSecret,
      SALT,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      PBKDF2_DIGEST
    );
    logger.info('🔑 Credential master key derived from JWT_SECRET');
  }

  /**
   * Ensure the credentials table exists (create if missing)
   */
  private ensureTable(): void {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS credentials (
          provider TEXT PRIMARY KEY,
          encrypted_value TEXT NOT NULL,
          key_version INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT (datetime('now','localtime')),
          updated_at DATETIME DEFAULT (datetime('now','localtime'))
        );
      `);
    } catch (error) {
      logger.warn('Could not ensure credentials table (may already exist via migration)', error as Error);
    }
  }

  /**
   * Get the derived master key
   */
  private getMasterKey(): Buffer {
    if (!this.masterKey) {
      this.deriveMasterKey();
    }
    return this.masterKey!;
  }

  /**
   * Encrypt plaintext using AES-256-GCM with the derived master key
   * Returns format: iv:authTag:ciphertext (all base64)
   */
  private encrypt(plaintext: string): string {
    if (!plaintext) return '';
    const key = this.getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt ciphertext using AES-256-GCM with the derived master key
   */
  private decrypt(encryptedString: string): string {
    if (!encryptedString) return '';
    try {
      const parts = encryptedString.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encryptedData = Buffer.from(parts[2], 'base64');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.getMasterKey(), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Credential decryption failed', error as Error);
      throw new Error('Failed to decrypt credential');
    }
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
      const existing = db.prepare('SELECT provider FROM credentials WHERE provider = ?').get(providerLower) as CredentialRecord | undefined;

      if (existing) {
        db.prepare(`
          UPDATE credentials SET encrypted_value = ?, updated_at = datetime('now','localtime') WHERE provider = ?
        `).run(encrypted, providerLower);
      } else {
        db.prepare(`
          INSERT INTO credentials (provider, encrypted_value) VALUES (?, ?)
        `).run(providerLower, encrypted);
      }

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
      const record = db.prepare('SELECT * FROM credentials WHERE provider = ?').get(providerLower) as CredentialRecord | undefined;
      if (!record) return undefined;

      const plaintext = this.decrypt(record.encrypted_value);

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
      db.prepare('DELETE FROM credentials WHERE provider = ?').run(providerLower);
      this.invalidateCache(providerLower);
      logger.info(`🔐 Credential deleted for provider: ${providerLower}`);
    } catch (error) {
      logger.error(`Failed to delete credential for provider: ${providerLower}`, error as Error);
      throw new Error(`Failed to delete credential: ${(error as Error).message}`);
    }
  }

  /**
   * List all configured providers with masked values
   */
  listProviders(): Array<{ provider: string; configured: boolean; masked?: string; createdAt: string }> {
    if (!this.initialized) this.init();

    try {
      const records = db.prepare('SELECT * FROM credentials ORDER BY provider ASC').all() as CredentialRecord[];
      const knownProviders = ['doubao', 'openai', 'local_ai', 'alert_email', 'alert_webhook'];

      const configuredMap = new Set(records.map(r => r.provider));
      const result: Array<{ provider: string; configured: boolean; masked?: string; createdAt: string }> = [];

      for (const provider of knownProviders) {
        if (configuredMap.has(provider)) {
          const record = records.find(r => r.provider === provider)!;
          try {
            const plaintext = this.decrypt(record.encrypted_value);
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
            const plaintext = this.decrypt(record.encrypted_value);
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
        const existingCred = db.prepare('SELECT provider FROM credentials WHERE provider = ?').get(provider) as CredentialRecord | undefined;
        if (existingCred) {
          skipped++;
          continue;
        }

        const settingRecord = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey) as { value: string } | undefined;
        if (!settingRecord || !settingRecord.value) {
          skipped++;
          continue;
        }

        const value = settingRecord.value;
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
      const existingCred = db.prepare('SELECT provider FROM credentials WHERE provider = ?').get('alert_email') as CredentialRecord | undefined;
      if (!existingCred) {
        const notificationEmailConfig = db.prepare('SELECT value FROM settings WHERE key = ?').get('notification_email_config') as { value: string } | undefined;
        if (notificationEmailConfig && notificationEmailConfig.value) {
          try {
            const config = JSON.parse(notificationEmailConfig.value);
            if (config.user || config.password) {
              const alertEmailHost = db.prepare('SELECT value FROM settings WHERE key = ?').get('ALERT_EMAIL_HOST') as { value: string } | undefined;
              const emailConfig = {
                host: alertEmailHost?.value || config.smtp_host || '',
                user: config.user || '',
                pass: config.password || '',
                to: db.prepare('SELECT value FROM settings WHERE key = ?').get('ALERT_EMAIL_TO') as { value: string } | undefined ? (db.prepare('SELECT value FROM settings WHERE key = ?').get('ALERT_EMAIL_TO') as { value: string }).value : ''
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
      const record = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return record?.value || undefined;
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
      const count = (db.prepare('SELECT COUNT(*) as count FROM credentials').get() as { count: number }).count;
      return { status: 'ok', providers: count };
    } catch (error) {
      return { status: 'error', providers: 0 };
    }
  }
}

// Singleton instance
export const credentialService = new CredentialService();
