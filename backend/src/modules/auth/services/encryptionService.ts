import crypto from 'crypto';
import { serversRepo } from '../../../repositories/serverRepository';
import { env } from '../../../utils/env';
import { logger } from '../../../utils/logger';

// 加密算法配置
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

// 密钥版本：v1 = 旧密钥（数据库存储），v2 = 新密钥（环境变量派生）
const KEY_VERSION_CURRENT = 2;

// 旧密钥缓存（仅用于解密旧数据，迁移完成后清除）
let _legacyKey: Buffer | null = null;
let _legacyKeyChecked = false;

/**
 * 从环境变量 JWT_SECRET 派生加密密钥（v2，不落盘）
 * 与 credentialService 使用相同的派生模式但不同盐值
 */
function deriveEncryptionKey(): Buffer {
  const secret = env.JWT_SECRET;
  return crypto.pbkdf2Sync(secret, 'encryption-service-v2-salt', 100000, KEY_LENGTH, 'sha512');
}

/**
 * 获取旧的数据库存储密钥（仅用于解密 v1 密文）
 */
function getLegacyKey(): Buffer | null {
  if (_legacyKeyChecked) return _legacyKey;
  _legacyKeyChecked = true;

  try {
    const keyValue = serversRepo.getActiveEncryptionKey('aes-256-gcm');
    if (keyValue) {
      _legacyKey = Buffer.from(keyValue, 'base64');
      logger.info('🔐 Found legacy encryption key in database (will be used for migration only)');
    }
  } catch (_err) {
    // 表不存在或数据库未初始化，忽略
  }
  return _legacyKey;
}

let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    _encryptionKey = deriveEncryptionKey();
  }
  return _encryptionKey;
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // 返回格式: v2:iv:authTag:encryptedData（带版本前缀）
  return `${KEY_VERSION_CURRENT}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decrypt(encryptedString: string): string {
  if (!encryptedString) return '';

  try {
    // 检测是否为 v2 格式（带版本前缀）
    if (encryptedString.startsWith(`${KEY_VERSION_CURRENT}:`)) {
      return decryptV2(encryptedString);
    }

    // 旧格式（v1: iv:authTag:encryptedData，无版本前缀）
    return decryptV1(encryptedString);
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

function decryptV2(encryptedString: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format (v2)');
  }

  const iv = Buffer.from(parts[1], 'base64');
  const authTag = Buffer.from(parts[2], 'base64');
  const encryptedData = Buffer.from(parts[3], 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

function decryptV1(encryptedString: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format (v1)');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encryptedData = Buffer.from(parts[2], 'base64');

  const legacyKey = getLegacyKey();
  if (!legacyKey) {
    throw new Error('Legacy encryption key not found in database. Cannot decrypt v1 data.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * 密钥迁移：将所有 v1 格式的服务器凭据重新加密为 v2 格式
 * 在服务启动时调用（best-effort，失败不阻塞启动）
 */
export function migrateEncryptionKeys(): void {
  const legacyKey = getLegacyKey();
  if (!legacyKey) {
    logger.info('🔐 No legacy encryption key found, skipping migration');
    return;
  }

  try {
    const servers = serversRepo.listCredentialsForMigration();

    let migratedCount = 0;

    serversRepo.transaction(() => {
      for (const server of servers) {
        try {
          let needsUpdate = false;
          let newPassword = server.password;
          let newPrivateKey = server.private_key;

          if (server.password && !server.password.startsWith(`${KEY_VERSION_CURRENT}:`)) {
            const plain = decryptV1(server.password);
            newPassword = encrypt(plain);
            needsUpdate = true;
          }

          if (server.private_key && !server.private_key.startsWith(`${KEY_VERSION_CURRENT}:`)) {
            const plain = decryptV1(server.private_key);
            newPrivateKey = encrypt(plain);
            needsUpdate = true;
          }

          if (needsUpdate) {
            serversRepo.updateCredentials(server.id, newPassword, newPrivateKey);
            migratedCount++;
          }
        } catch (err) {
          logger.error(`Failed to migrate encryption for server ${server.id}:`, err as Error);
        }
      }
    });

    if (migratedCount > 0) {
      logger.info(`🔄 Encryption key migration completed: ${migratedCount} servers re-encrypted with v2 key`);
      // 标记旧密钥为非活跃（保留记录供审计，不删除）
      try {
        serversRepo.deactivateEncryptionKeys('aes-256-gcm');
        logger.info('🔐 Legacy encryption keys deactivated');
      } catch {
        // 忽略，表可能不存在
      }
    } else {
      logger.info('🔐 No servers needed encryption migration');
    }
  } catch (error) {
    logger.error('❌ Encryption key migration failed:', error as Error);
  }
}
