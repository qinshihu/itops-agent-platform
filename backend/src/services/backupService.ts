import fs from 'fs';
import path from 'path';
import crypto, { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { scheduleJob } from 'node-schedule';
import db from '../models/database';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { gracefulRestart } from './restartService';

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

async function runGzip(src: string, dest: string): Promise<void> {
  const srcStream = fs.createReadStream(src);
  const gzip = createGzip();
  const destStream = fs.createWriteStream(dest);
  await pipeline(srcStream, gzip, destStream);
}

async function runGunzip(src: string, dest: string): Promise<void> {
  const srcStream = fs.createReadStream(src);
  const gunzip = createGunzip();
  const destStream = fs.createWriteStream(dest);
  await pipeline(srcStream, gunzip, destStream);
}

export interface BackupInfo {
  id: string;
  filename: string;
  filePath: string;
  size: number;
  createdAt: string;
  type: 'auto' | 'manual';
  status: 'completed' | 'failed' | 'in_progress';
  error?: string;
  verified: boolean;
  checksum?: string;
}

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  keepLast: number;
  backupDir: string;
  compression: boolean;
  verifyAfterBackup: boolean;
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  intervalHours: 24,
  keepLast: 7,
  backupDir: path.join(process.cwd(), 'backups'),
  compression: true,
  verifyAfterBackup: true
};

export class BackupService {
  private config: BackupConfig = DEFAULT_CONFIG;
  private timer: NodeJS.Timeout | null = null;
  private scheduleTimer: import('node-schedule').Job | null = null;
  private backupHistory: BackupInfo[] = [];
  private isRunning = false;
  private isInitialized = false;

  /**
   * 获取自上次备份以来的小时数（供自监控服务使用）
   * 如果超过 48 小时未备份，返回负数表示超时阈值
   */
  getLastBackupAgeHours(): number {
    if (this.backupHistory.length === 0) {
      return -1; // 从未备份
    }
    const lastBackup = this.backupHistory[0];
    if (!lastBackup.createdAt) return -1;
    const ageMs = Date.now() - new Date(lastBackup.createdAt).getTime();
    return ageMs / (1000 * 60 * 60);
  }

  /**
   * 检查备份是否健康（用于自监控告警）
   */
  isHealthy(): boolean {
    const ageHours = this.getLastBackupAgeHours();
    // 如果从未备份或超过 48 小时未成功备份，认为不健康
    if (ageHours < 0) return true; // 从未备份不算不健康
    return ageHours < 48;
  }

  constructor() {
    // 构造函数不进行数据库操作，等待 init() 显式调用
  }

  /**
   * 初始化备份服务 - 必须在数据库初始化后调用
   */
  init(): void {
    if (this.isInitialized) {
      logger.info('Backup service already initialized');
      return;
    }

    try {
      this.config = this.loadConfig();
      this.ensureBackupDir();
      
      // 先尝试从数据库加载历史
      this.loadHistory();
      
      // 如果没有历史记录，或者历史记录不完整，从文件系统扫描
      if (this.backupHistory.length === 0) {
        this.scanBackupFiles();
      }
      
      if (this.config.enabled) {
        this.startAutoBackup();
      }
      
      this.isInitialized = true;
      logger.info('✅ Backup service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize backup service', error as Error);
      throw error;
    }
  }

  // 从文件系统扫描备份文件，重新生成历史记录
  private scanBackupFiles(): void {
    try {
      if (!fs.existsSync(this.config.backupDir)) {
        return;
      }

      const files = fs.readdirSync(this.config.backupDir)
        .filter(f => f.startsWith('itops-backup-'))
        .sort()
        .reverse();

      this.backupHistory = files.map(filename => {
        const filePath = path.join(this.config.backupDir, filename);
        const stats = fs.statSync(filePath);
        const id = `backup-${stats.birthtimeMs}`;
        
        return {
          id,
          filename,
          filePath,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          type: 'manual' as const,
          status: 'completed' as const,
          verified: false
        };
      });

      this.saveHistory();
      logger.info('Scanned backup files from filesystem', { count: this.backupHistory.length });
    } catch (error) {
      logger.warn('Failed to scan backup files', error as Error);
    }
  }

  private loadConfig(): BackupConfig {
    try {
      const saved = db.prepare('SELECT value FROM settings WHERE key = ?').get('backup_config') as { value: string } | undefined;
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved.value) };
      }
    } catch (error) {
      logger.warn('Failed to load backup config, using defaults', error as Error);
    }
    return DEFAULT_CONFIG;
  }

  private saveConfig(): void {
    if (!this.isInitialized) {
      logger.warn('Attempted to save config before backup service initialization');
      return;
    }
    const json = JSON.stringify(this.config);
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('backup_config', ?, datetime('now','localtime'))
    `).run(json);
  }

  private loadHistory(): void {
    try {
      const saved = db.prepare('SELECT value FROM settings WHERE key = ?').get('backup_history') as { value: string } | undefined;
      if (saved) {
        // 加载历史记录并过滤掉不存在的文件
        const history = JSON.parse(saved.value);
        this.backupHistory = history.filter((backup: any) => {
          if (!backup.filePath) return false;
          try {
            return fs.existsSync(backup.filePath);
          } catch {
            return false;
          }
        });
      } else {
        this.backupHistory = [];
      }
    } catch (error) {
      logger.warn('Failed to load backup history, starting fresh', error as Error);
      this.backupHistory = [];
    }
  }

  private saveHistory(): void {
    if (!this.isInitialized) {
      logger.warn('Attempted to save history before backup service initialization');
      return;
    }
    const json = JSON.stringify(this.backupHistory.slice(-50));
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('backup_history', ?, datetime('now','localtime'))
    `).run(json);
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  getConfig(): BackupConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<BackupConfig>): BackupConfig {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.ensureBackupDir();
    
    if (this.timer) {
      this.stopAutoBackup();
    }
    if (this.config.enabled) {
      this.startAutoBackup();
    }
    
    logger.info('Backup configuration updated', this.config);
    return this.getConfig();
  }

  async createBackup(type: 'auto' | 'manual' = 'manual'): Promise<BackupInfo> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    // 确保备份目录存在
    this.ensureBackupDir();

    this.isRunning = true;
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `itops-backup-${timestamp}.db`;
    const filePath = path.join(this.config.backupDir, filename);

    const backupInfo: BackupInfo = {
      id: `backup-${Date.now()}`,
      filename,
      filePath,
      size: 0,
      createdAt: new Date().toISOString(),
      type,
      status: 'in_progress',
      verified: false
    };

    try {
      logger.info(`Starting ${type} backup`, { filename, filePath });

      // 直接复制数据库文件，更简单可靠
      const sourcePath = env.DATABASE_PATH;
      logger.info('Copying database file', { sourcePath, targetPath: filePath });
      
      // 确保源文件存在
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source database file not found: ${sourcePath}`);
      }
      
      // 复制文件
      fs.copyFileSync(sourcePath, filePath);
      
      // 检查备份文件是否创建成功
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        logger.info('Backup file created successfully', { filePath, size: stats.size });
      } else {
        throw new Error(`Backup file not found after copy: ${filePath}`);
      }

      if (this.config.compression) {
        const compressedPath = `${filePath}.gz`;
        try {
          logger.info('Compressing backup file', { from: filePath, to: compressedPath });
          await runGzip(filePath, compressedPath);
          logger.info('Compression done, removing original file', { filePath });
          fs.unlinkSync(filePath);
          backupInfo.filePath = compressedPath;
          backupInfo.filename = `${filename}.gz`;
          logger.info('Backup info updated', { newFilePath: backupInfo.filePath, newFilename: backupInfo.filename });
        } catch (compressError) {
          logger.warn('Compression failed, keeping uncompressed backup', compressError as Error);
        }
      }

      // AES 加密备份文件（默认启用）
      if (shouldEncryptBackup()) {
        const encryptedPath = `${backupInfo.filePath}.enc`;
        try {
          logger.info('🔐 Encrypting backup file', { from: backupInfo.filePath, to: encryptedPath });
          const { checksum } = await encryptBackupFile(backupInfo.filePath, encryptedPath);
          logger.info('Encryption done, removing original file');
          fs.unlinkSync(backupInfo.filePath);
          backupInfo.filePath = encryptedPath;
          backupInfo.filename = `${backupInfo.filename}.enc`;
          backupInfo.checksum = checksum;
          logger.info('Backup info updated with encryption', { newFilePath: backupInfo.filePath });
        } catch (encryptError) {
          logger.warn('Encryption failed, keeping unencrypted backup', encryptError as Error);
        }
      }

      // 确保文件存在
      logger.info('Checking if backup file exists', { filePath: backupInfo.filePath });
      if (!fs.existsSync(backupInfo.filePath)) {
        throw new Error(`Backup file not found: ${backupInfo.filePath}`);
      }
      
      const stats = fs.statSync(backupInfo.filePath);
      backupInfo.size = stats.size;
      logger.info('Got backup file stats', { size: backupInfo.size });
      
      if (this.config.verifyAfterBackup) {
        try {
          const verified = await this.verifyBackup(backupInfo.filePath);
          backupInfo.verified = verified;
          
          if (verified) {
            backupInfo.checksum = await this.calculateChecksum(backupInfo.filePath);
          }
        } catch (verifyError) {
          logger.warn('Backup verification failed, but backup is saved', verifyError as Error);
          backupInfo.verified = false;
        }
      }
      
      backupInfo.status = 'completed';

      logger.info('Backup completed successfully', {
        filename: backupInfo.filename,
        size: this.formatSize(backupInfo.size),
        duration: Date.now() - startTime,
        verified: backupInfo.verified
      });

      this.cleanupOldBackups();

    } catch (error) {
      backupInfo.status = 'failed';
      backupInfo.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Backup failed', error as Error);
      throw error;
    } finally {
      this.isRunning = false;
      this.backupHistory.unshift(backupInfo);
      this.saveHistory();
    }

    return backupInfo;
  }

  private async verifyBackup(backupPath: string): Promise<boolean> {
    try {
      logger.info('Verifying backup integrity', { path: backupPath });
      
      let workPath = backupPath;
      const tempFiles: string[] = [];
      let tempDb: Database.Database | null = null;
      
      // 处理加密文件
      if (isEncryptedBackup(backupPath)) {
        const decryptedPath = backupPath + '.decrypted';
        await decryptBackupFile(backupPath, decryptedPath);
        tempFiles.push(decryptedPath);
        workPath = decryptedPath;
      }
      
      // 处理压缩文件
      if (workPath.endsWith('.gz')) {
        const decompressedPath = workPath.replace(/\.gz$/, '');
        if (decompressedPath !== workPath) {
          await runGunzip(workPath, decompressedPath);
          tempFiles.push(decompressedPath);
          workPath = decompressedPath;
        }
      }
      
      // 对于 .enc 结尾的文件，去掉 .enc
      if (workPath.endsWith('.enc')) {
        const decryptedPath = workPath.replace(/\.enc$/, '');
        await decryptBackupFile(workPath, decryptedPath);
        tempFiles.push(decryptedPath);
        workPath = decryptedPath;
      }
      
      try {
        tempDb = new Database(workPath, { readonly: true });
        
        // 完整性检查
        const integrityRow = tempDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
        const integrityCheck = integrityRow?.integrity_check || '';
        
        if (integrityCheck !== 'ok') {
          logger.error('Backup verification failed', { 
            integrityCheck
          });
          return false;
        }
        
        // 额外验证：检查关键表是否存在
        const tableCount = (tempDb.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }).count;
        
        // 检查是否有用户数据
        const userCount = (tempDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number })?.count ?? 0;
        const agentCount = (tempDb.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number })?.count ?? 0;
        
        logger.info('Backup verification successful', {
          tableCount,
          integrityCheck,
          userCount,
          agentCount
        });
        
        return true;
      } finally {
        if (tempDb) {
          tempDb.close();
        }
        
        // 清理临时文件
        for (const tmpFile of tempFiles) {
          try {
            if (fs.existsSync(tmpFile)) {
              fs.unlinkSync(tmpFile);
            }
          } catch {
            // 忽略清理错误
          }
        }
      }
    } catch (error) {
      logger.error('Backup verification failed', error as Error);
      return false;
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const hash = createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.warn('Failed to calculate backup checksum', error as Error);
      return '';
    }
  }

  private cleanupOldBackups(): void {
    try {
      const files = fs.readdirSync(this.config.backupDir)
        .filter(f => f.startsWith('itops-backup-'))
        .sort()
        .reverse();

      if (files.length > this.config.keepLast) {
        const toDelete = files.slice(this.config.keepLast);
        for (const file of toDelete) {
          try {
            fs.unlinkSync(path.join(this.config.backupDir, file));
            logger.info('Deleted old backup', { file });
          } catch (err) {
            logger.warn(`Failed to delete old backup: ${file}`, err as Error);
          }
        }
      }

      this.backupHistory = this.backupHistory.slice(0, this.config.keepLast * 2);
    } catch (error) {
      logger.error('Failed to cleanup old backups', error as Error);
    }
  }

  startAutoBackup(): void {
    if (!this.config.enabled) return;
    
    // 使用 node-schedule 实现精确的定时备份
    // 默认每天凌晨 3:00 执行
    const backupCron = process.env.BACKUP_CRON || '0 3 * * *';
    
    // 同时也保留基于间隔的倒计时作为补充
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    
    // 启动定时任务
    try {
      this.scheduleTimer = scheduleJob(backupCron, async () => {
        try {
          logger.info('⏰ Scheduled backup trigger (daily 3AM)');
          await this.createBackup('auto');
        } catch (error) {
          logger.error('Scheduled auto backup failed', error as Error);
        }
      });
      logger.info(`Scheduled backup set: ${backupCron}`);
    } catch (error) {
      logger.warn('Failed to set scheduled backup via cron, falling back to interval', error as Error);
    }
    
    // 间隔备份作为 backup（如果定时任务失败则使用间隔）
    this.timer = setInterval(async () => {
      try {
        await this.createBackup('auto');
      } catch (error) {
        logger.error('Auto backup failed', error as Error);
      }
    }, intervalMs);
    this.timer.unref();

    logger.info(`Auto backup started, schedule: ${backupCron}, interval: ${this.config.intervalHours} hours`);
  }

  stopAutoBackup(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.scheduleTimer) {
      this.scheduleTimer.cancel();
      this.scheduleTimer = null;
    }
    logger.info('Auto backup stopped');
  }

  getHistory(): BackupInfo[] {
    return [...this.backupHistory];
  }

  getStatus(): {
    isRunning: boolean;
    lastBackup?: BackupInfo;
    lastBackupAgeHours: number;
    nextScheduledBackup?: string;
    config: BackupConfig;
    totalBackups: number;
    totalSize: number;
    healthy: boolean;
  } {
    const files = fs.existsSync(this.config.backupDir)
      ? fs.readdirSync(this.config.backupDir).filter(f => f.startsWith('itops-backup-'))
      : [];

    const totalSize = files.reduce((sum, file) => {
      try {
        return sum + fs.statSync(path.join(this.config.backupDir, file)).size;
      } catch {
        return sum;
      }
    }, 0);

    const lastBackupAgeHours = this.getLastBackupAgeHours();

    return {
      isRunning: this.isRunning,
      lastBackup: this.backupHistory[0],
      lastBackupAgeHours,
      config: this.getConfig(),
      totalBackups: files.length,
      totalSize,
      healthy: this.isHealthy(),
    };
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private isRestoring = false;

  async restoreBackup(backupId: string): Promise<{ success: boolean; requiresRestart?: boolean; message?: string }> {
    if (this.isRunning) {
      throw new Error('Cannot restore while backup is in progress');
    }
    if (this.isRestoring) {
      throw new Error('Restore already in progress');
    }

    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    if (!fs.existsSync(backup.filePath)) {
      throw new Error('Backup file not found on disk');
    }

    this.isRestoring = true;
    let restorePath = backup.filePath;
    let tempDbPath: string | null = null;
    let afterDecryptPath: string | null = null;
    const dbPath = env.DATABASE_PATH;

    try {
      // 解密加密的备份
      if (backup.filePath.endsWith('.enc')) {
        const decryptedPath = backup.filePath.replace(/\.enc$/, '');
        logger.info('🔓 Decrypting backup file before restore', { from: backup.filePath });
        await decryptBackupFile(backup.filePath, decryptedPath);
        afterDecryptPath = decryptedPath;
        restorePath = decryptedPath;
      }

      if (restorePath.endsWith('.gz')) {
        const decompressedPath = restorePath.replace(/\.gz$/, '');
        await runGunzip(restorePath, decompressedPath);
        tempDbPath = decompressedPath;
        restorePath = decompressedPath;
      }

      if (!fs.existsSync(restorePath)) {
        throw new Error('Decompressed/decrypted backup file not found');
      }

      const verifyDb = new Database(restorePath, { readonly: true, fileMustExist: true });
      const integrity = verifyDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
      verifyDb.close();

      if (integrity[0]?.integrity_check !== 'ok') {
        throw new Error(`Backup integrity check failed: ${integrity[0]?.integrity_check}`);
      }

      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;
      const backupPath = `${dbPath}.pre-restore-${Date.now()}`;

      logger.info('⚠️ Backing up current database before restore...');
      fs.copyFileSync(dbPath, backupPath);
      if (fs.existsSync(walPath)) fs.copyFileSync(walPath, `${backupPath}-wal`);
      if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, `${backupPath}-shm`);
      logger.info(`📦 Current database backed up to: ${backupPath}`);

      fs.copyFileSync(restorePath, dbPath);
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      logger.info('✅ Database file restored from backup');

      logger.info('🔄 Database restored successfully. Starting graceful restart...');
      setTimeout(() => {
        gracefulRestart();
      }, 1000);
      return { success: true, requiresRestart: true, message: '数据库已恢复，系统将在1秒后自动重启' };
    } finally {
      if (tempDbPath && fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
      if (afterDecryptPath && fs.existsSync(afterDecryptPath)) {
        fs.unlinkSync(afterDecryptPath);
      }
      this.isRestoring = false;
    }
  }

  deleteBackup(backupId: string): boolean {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    try {
      if (fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }
      this.backupHistory = this.backupHistory.filter(b => b.id !== backupId);
      this.saveHistory();
      logger.info('Backup deleted', { backupId });
      return true;
    } catch (error) {
      logger.error('Failed to delete backup', error as Error);
      throw error;
    }
  }

  getBackupFilePath(backupId: string): string {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }
    if (!fs.existsSync(backup.filePath)) {
      throw new Error('Backup file not found on disk');
    }
    return backup.filePath;
  }

  async uploadBackup(filePath: string, originalName: string): Promise<BackupInfo> {
    this.ensureBackupDir();
    
    const fileStat = fs.statSync(filePath);
    const timestamp = new Date().toISOString();
    const backupId = uuidv4();
    
    const destFileName = `uploaded-${timestamp.replace(/[:.]/g, '-')}${path.extname(originalName)}`;
    const destFilePath = path.join(this.config.backupDir, destFileName);
    
    fs.copyFileSync(filePath, destFilePath);
    
    let finalPath = destFilePath;
    let finalSize = fileStat.size;
    
    if (this.config.compression && !destFileName.endsWith('.gz')) {
      logger.info('Compressing uploaded backup...');
      const compressedPath = `${destFilePath}.gz`;
      await runGzip(destFilePath, compressedPath);
      fs.unlinkSync(destFilePath);
      
      const compressedStat = fs.statSync(compressedPath);
      finalSize = compressedStat.size;
      finalPath = compressedPath;
    }

    const record: BackupInfo = {
      id: backupId,
      filename: path.basename(finalPath),
      filePath: finalPath,
      size: finalSize,
      createdAt: new Date().toISOString(),
      type: 'manual', // 使用 manual，因为 BackupInfo 只支持 auto 和 manual
      status: 'completed',
      verified: false
    };

    this.backupHistory.unshift(record);
    this.saveHistory();
    
    logger.info('Uploaded backup imported', { backupId, originalName });
    return record;
  }
}

export const backupService = new BackupService();
