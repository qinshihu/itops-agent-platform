import crypto from 'crypto';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';

// 加密算法配置
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

// 获取或生成加密密钥
function getOrCreateEncryptionKey(): Buffer {
  // 先尝试从数据库获取活跃密钥
  const activeKey = db.prepare('SELECT key_value FROM encryption_keys WHERE key_type = ? AND active = 1 LIMIT 1').get('aes-256-gcm') as { key_value: string } | undefined;
  
  if (!activeKey) {
    logger.info('🔐 No active encryption key found, generating new one');
    const newKey = crypto.randomBytes(KEY_LENGTH);
    const keyId = randomUUID();
    
    db.prepare(`
      INSERT INTO encryption_keys (id, key_type, key_value, active)
      VALUES (?, ?, ?, 1)
    `).run(keyId, 'aes-256-gcm', newKey.toString('base64'));
    
    logger.info('🔐 Generated new encryption key');
    return newKey;
  }
  
  return Buffer.from(activeKey.key_value, 'base64');
}

let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    _encryptionKey = getOrCreateEncryptionKey();
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
  
  // 返回格式: iv:authTag:encryptedData
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decrypt(encryptedString: string): string {
  if (!encryptedString) return '';
  
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encryptedData = Buffer.from(parts[2], 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// 重新加密所有服务器敏感信息（用于密钥轮换）
export function rotateEncryptionKey(): void {
  const newKey = crypto.randomBytes(KEY_LENGTH);
  const newKeyId = randomUUID();
  
  // 获取所有服务器
  const servers = db.prepare('SELECT id, password, private_key FROM servers').all() as Array<{
    id: string;
    password: string | null;
    private_key: string | null;
  }>;
  
  // 使用旧密钥解密并使用新密钥重新加密
  const oldKey = getEncryptionKey();
  const decryptedServers = servers.map(server => ({
    id: server.id,
    password: server.password ? decryptWithKey(server.password, oldKey) : null,
    private_key: server.private_key ? decryptWithKey(server.private_key, oldKey) : null
  }));
  
  // 使用事务包装所有数据库操作，确保原子性
  const rotateTransaction = db.transaction(() => {
    // 标记旧密钥为非活跃
    db.prepare('UPDATE encryption_keys SET active = 0 WHERE key_type = ?').run('aes-256-gcm');
    
    // 插入新密钥
    db.prepare(`
      INSERT INTO encryption_keys (id, key_type, key_value, active)
      VALUES (?, ?, ?, 1)
    `).run(newKeyId, 'aes-256-gcm', newKey.toString('base64'));
    
    // 使用新密钥重新加密并更新数据库
    const updateStmt = db.prepare(`
      UPDATE servers 
      SET password = ?, private_key = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `);
    
    for (const server of decryptedServers) {
      updateStmt.run(
        server.password ? encryptWithKey(server.password, newKey) : null,
        server.private_key ? encryptWithKey(server.private_key, newKey) : null,
        server.id
      );
    }
  });
  
  try {
    rotateTransaction();
    logger.info('🔄 Encryption key rotated successfully');
  } catch (error) {
    logger.error('❌ Encryption key rotation failed, all changes rolled back:', error);
    throw error;
  }
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function decryptWithKey(encryptedString: string, key: Buffer): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encryptedData = Buffer.from(parts[2], 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Decryption with key failed:', error as Error);
    throw new Error('Failed to decrypt data with provided key');
  }
}
