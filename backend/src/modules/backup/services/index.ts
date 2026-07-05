import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { scheduleJob, type Job } from 'node-schedule';
import Database from 'better-sqlite3';
import { logger } from '../../../utils/logger';
import { env } from '../../../utils/env';
import { gracefulRestart, registerShutdownHook } from '../../infra/services/restartService';
import type { BackupInfo, BackupConfig} from './backupTypes';
import { DEFAULT_CONFIG } from './backupTypes';
import {
  encryptBackupFile,
  decryptBackupFile,
  isEncryptedBackup,
  shouldEncryptBackup,
  runGzip,
  runGunzip
} from './backupCrypto';
import {
  loadBackupConfig,
  saveBackupConfig,
  loadBackupHistory,
  saveBackupHistory,
  ensureBackupDir,
  scanBackupFiles,
  calculateChecksum,
  verifyBackup,
  cleanupOldBackups,
  formatSize,
  getBackupFilesInfo
} from './backupStorage';

// Re-exports for backward compatibility
export {
  encryptBackupFile,
  decryptBackupFile,
  isEncryptedBackup,
  shouldEncryptBackup
};
export type { BackupInfo, BackupConfig };

export class BackupService {
  private config: BackupConfig = DEFAULT_CONFIG;
  private timer: NodeJS.Timeout | null = null;
  private scheduleTimer: Job | null = null;
  private backupHistory: BackupInfo[] = [];
  private isRunning = false;
  private isInitialized = false;
  private isRestoring = false;

  getLastBackupAgeHours(): number {
    if (this.backupHistory.length === 0) {
      return -1;
    }
    const lastBackup = this.backupHistory[0];
    if (!lastBackup.createdAt) return -1;
    const ageMs = Date.now() - new Date(lastBackup.createdAt).getTime();
    return ageMs / (1000 * 60 * 60);
  }

  isHealthy(): boolean {
    const ageHours = this.getLastBackupAgeHours();
    if (ageHours < 0) return true;
    return ageHours < 48;
  }

  constructor() {
  }

  init(): void {
    if (this.isInitialized) {
      logger.info('Backup service already initialized');
      return;
    }

    try {
      this.config = loadBackupConfig();
      ensureBackupDir(this.config.backupDir);
      this.backupHistory = loadBackupHistory();

      if (this.backupHistory.length === 0) {
        this.backupHistory = scanBackupFiles(this.config.backupDir);
        this.saveHistory();
      }

      if (this.config.enabled) {
        this.startAutoBackup();
      }

      this.isInitialized = true;
      logger.info('Backup service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize backup service', error as Error);
      throw error;
    }
  }

  private saveConfig(): void {
    if (!this.isInitialized) {
      logger.warn('Attempted to save config before backup service initialization');
      return;
    }
    saveBackupConfig(this.config);
  }

  private saveHistory(): void {
    if (!this.isInitialized) {
      logger.warn('Attempted to save history before backup service initialization');
      return;
    }
    saveBackupHistory(this.backupHistory);
  }

  getConfig(): BackupConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<BackupConfig>): BackupConfig {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    ensureBackupDir(this.config.backupDir);

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
    ensureBackupDir(this.config.backupDir);

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
          logger.info('Encrypting backup file', { from: backupInfo.filePath, to: encryptedPath });
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
          const verified = await verifyBackup(backupInfo.filePath);
          backupInfo.verified = verified;

          if (verified) {
            backupInfo.checksum = await calculateChecksum(backupInfo.filePath);
          }
        } catch (verifyError) {
          logger.warn('Backup verification failed, but backup is saved', verifyError as Error);
          backupInfo.verified = false;
        }
      }

      backupInfo.status = 'completed';

      logger.info('Backup completed successfully', {
        filename: backupInfo.filename,
        size: formatSize(backupInfo.size),
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

  private cleanupOldBackups(): void {
    cleanupOldBackups(this.config.backupDir, this.config.keepLast);
    this.backupHistory = this.backupHistory.slice(0, this.config.keepLast * 2);
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
          logger.info('Scheduled backup trigger (daily 3AM)');
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
    const { totalBackups, totalSize } = getBackupFilesInfo(this.config.backupDir);

    const lastBackupAgeHours = this.getLastBackupAgeHours();

    return {
      isRunning: this.isRunning,
      lastBackup: this.backupHistory[0],
      lastBackupAgeHours,
      config: this.getConfig(),
      totalBackups,
      totalSize,
      healthy: this.isHealthy(),
    };
  }

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
        logger.info('Decrypting backup file before restore', { from: backup.filePath });
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

      logger.info('Backing up current database before restore...');
      fs.copyFileSync(dbPath, backupPath);
      if (fs.existsSync(walPath)) fs.copyFileSync(walPath, `${backupPath}-wal`);
      if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, `${backupPath}-shm`);
      logger.info(`Current database backed up to: ${backupPath}`);

      fs.copyFileSync(restorePath, dbPath);
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      logger.info('Database file restored from backup');

      logger.info('Database restored successfully. Starting graceful restart...');
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
    ensureBackupDir(this.config.backupDir);

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
      type: 'manual',
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

// 注册优雅关闭钩子（避免 restartService ↔ backupService 循环依赖）
registerShutdownHook(() => backupService.stopAutoBackup());
