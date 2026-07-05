import fs from 'fs';
import { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { env } from '../../../utils/env';

// AES-256-GCM 加密配置（用于备份文件加密，带认证标签）
const BACKUP_ENC_MAGIC = Buffer.from('ITP_ENC_V2');  // 文件头标记
const BACKUP_ENC_ALGORITHM = 'aes-256-gcm';
const BACKUP_ENC_KEY_LEN = 32;
const BACKUP_ENC_IV_LEN = 16;
const BACKUP_ENC_TAG_LEN = 16;
const BACKUP_ENC_SALT_LEN = 32;

/**
 * 从 JWT_SECRET 派生备份加密密钥
 * 使用 scrypt 密钥派生函数
 */
function deriveBackupKey(): Buffer {
  const secret = env.JWT_SECRET || 'itops-default-backup-key';
  const salt = `itops-backup-key-v1:${env.NODE_ENV || 'production'}`;
  return scryptSync(secret, salt, BACKUP_ENC_KEY_LEN, { N: 16384, r: 8, p: 1 });
}

/**
 * AES-256-GCM 加密备份文件
 * 格式: [magic(8B)][salt(32B)][iv(16B)][ciphertext][tag(16B)]
 */
export async function encryptBackupFile(srcPath: string, destPath: string): Promise<{ checksum: string }> {
  const key = deriveBackupKey();
  const salt = randomBytes(BACKUP_ENC_SALT_LEN);
  const iv = randomBytes(BACKUP_ENC_IV_LEN);
  const cipher = createCipheriv(BACKUP_ENC_ALGORITHM, key, iv);

  const writeStream = fs.createWriteStream(destPath);
  // 写入头部: magic + salt + iv
  writeStream.write(BACKUP_ENC_MAGIC);
  writeStream.write(salt);
  writeStream.write(iv);

  await new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(srcPath);
    readStream.pipe(cipher).pipe(writeStream);
    writeStream.on('finish', () => {
      const tag = cipher.getAuthTag();
      fs.appendFileSync(destPath, tag);
      resolve();
    });
    writeStream.on('error', reject);
    readStream.on('error', reject);
    cipher.on('error', reject);
  });

  const checksum = createHash('sha256').update(fs.readFileSync(destPath)).digest('hex');
  return { checksum };
}

/**
 * AES-256-GCM 解密备份文件
 */
export async function decryptBackupFile(srcPath: string, destPath: string): Promise<void> {
  const fd = fs.openSync(srcPath, 'r');
  const magicBuf = Buffer.alloc(BACKUP_ENC_MAGIC.length);
  fs.readSync(fd, magicBuf, 0, BACKUP_ENC_MAGIC.length, 0);

  // 兼容旧格式：旧 CBC 格式或未加密文件
  if (!magicBuf.equals(BACKUP_ENC_MAGIC)) {
    fs.closeSync(fd);
    fs.copyFileSync(srcPath, destPath);
    return;
  }

  const salt = Buffer.alloc(BACKUP_ENC_SALT_LEN);
  const iv = Buffer.alloc(BACKUP_ENC_IV_LEN);
  const tag = Buffer.alloc(BACKUP_ENC_TAG_LEN);

  const offset1 = BACKUP_ENC_MAGIC.length;
  const offset2 = offset1 + BACKUP_ENC_SALT_LEN;
  const headerSize = offset2 + BACKUP_ENC_IV_LEN;

  fs.readSync(fd, salt, 0, BACKUP_ENC_SALT_LEN, offset1);
  fs.readSync(fd, iv, 0, BACKUP_ENC_IV_LEN, offset2);

  const stat = fs.fstatSync(fd);
  const ciphertextLen = stat.size - headerSize - BACKUP_ENC_TAG_LEN;
  fs.readSync(fd, tag, 0, BACKUP_ENC_TAG_LEN, headerSize + ciphertextLen);

  const key = deriveBackupKey();
  const decipher = createDecipheriv(BACKUP_ENC_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const ciphertext = Buffer.alloc(ciphertextLen);
  fs.readSync(fd, ciphertext, 0, ciphertextLen, headerSize);
  fs.closeSync(fd);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  fs.writeFileSync(destPath, decrypted);
}

/**
 * 检查备份文件是否为加密格式
 */
export function isEncryptedBackup(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const magicBuf = Buffer.alloc(BACKUP_ENC_MAGIC.length);
    fs.readSync(fd, magicBuf, 0, BACKUP_ENC_MAGIC.length, 0);
    fs.closeSync(fd);
    return magicBuf.equals(BACKUP_ENC_MAGIC);
  } catch {
    return false;
  }
}

/**
 * 检查是否应启用备份加密
 */
export function shouldEncryptBackup(): boolean {
  return process.env.BACKUP_ENCRYPTION_ENABLED !== 'false';
}

export async function runGzip(src: string, dest: string): Promise<void> {
  const srcStream = fs.createReadStream(src);
  const gzip = createGzip();
  const destStream = fs.createWriteStream(dest);
  await pipeline(srcStream, gzip, destStream);
}

export async function runGunzip(src: string, dest: string): Promise<void> {
  const srcStream = fs.createReadStream(src);
  const gunzip = createGunzip();
  const destStream = fs.createWriteStream(dest);
  await pipeline(srcStream, gunzip, destStream);
}
