import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';
import db from '../models/database';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { gracefulRestart } from './restartService';

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
  private config: BackupConfig;
  private timer: NodeJS.Timeout | null = null;
  private backupHistory: BackupInfo[] = [];
  private isRunning = false;

  constructor() {
    this.config = this.loadConfig();
    this.loadHistory();
    this.ensureBackupDir();
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
    const json = JSON.stringify(this.config);
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('backup_config', ?, CURRENT_TIMESTAMP)
    `).run(json);
  }

  private loadHistory(): void {
    try {
      const saved = db.prepare('SELECT value FROM settings WHERE key = ?').get('backup_history') as { value: string } | undefined;
      if (saved) {
        this.backupHistory = JSON.parse(saved.value);
      }
    } catch (error) {
      logger.warn('Failed to load backup history', error as Error);
    }
  }

  private saveHistory(): void {
    const json = JSON.stringify(this.backupHistory.slice(-50));
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('backup_history', ?, CURRENT_TIMESTAMP)
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
      logger.info(`Starting ${type} backup`, { filename });

      db.exec('BEGIN IMMEDIATE');
      
      try {
        await db.backup(filePath);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      if (this.config.compression) {
        const compressedPath = `${filePath}.gz`;
        try {
          await runGzip(filePath, compressedPath);
          fs.unlinkSync(filePath);
          backupInfo.filePath = compressedPath;
          backupInfo.filename = `${filename}.gz`;
        } catch (compressError) {
          logger.warn('Compression failed, keeping uncompressed backup', compressError as Error);
        }
      }

      const stats = fs.statSync(backupInfo.filePath);
      backupInfo.size = stats.size;
      
      if (this.config.verifyAfterBackup) {
        const verified = await this.verifyBackup(backupInfo.filePath);
        backupInfo.verified = verified;
        
        if (verified) {
          backupInfo.checksum = await this.calculateChecksum(backupInfo.filePath);
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
      
      let dbPath = backupPath;
      let tempDb: Database.Database | null = null;
      
      if (backupPath.endsWith('.gz')) {
        const tempPath = backupPath.replace('.gz', '');
        await runGunzip(backupPath, tempPath);
        dbPath = tempPath;
      }
      
      try {
        tempDb = new Database(dbPath, { readonly: true });
        
        const integrityCheck = tempDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
        
        if (integrityCheck.integrity_check !== 'ok') {
          logger.error('Backup verification failed', { 
            integrityCheck: integrityCheck.integrity_check 
          });
          return false;
        }
        
        const tableCount = (tempDb.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }).count;
        
        logger.info('Backup verification successful', {
          tableCount,
          integrityCheck: integrityCheck.integrity_check
        });
        
        return true;
      } finally {
        if (tempDb) {
          tempDb.close();
        }
        
        if (backupPath.endsWith('.gz') && fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
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
    
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    
    this.timer = setInterval(async () => {
      try {
        await this.createBackup('auto');
      } catch (error) {
        logger.error('Auto backup failed', error as Error);
      }
    }, intervalMs);
    this.timer.unref();

    logger.info(`Auto backup started, interval: ${this.config.intervalHours} hours`);
  }

  stopAutoBackup(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Auto backup stopped');
    }
  }

  getHistory(): BackupInfo[] {
    return [...this.backupHistory];
  }

  getStatus(): {
    isRunning: boolean;
    lastBackup?: BackupInfo;
    nextScheduledBackup?: string;
    config: BackupConfig;
    totalBackups: number;
    totalSize: number;
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

    return {
      isRunning: this.isRunning,
      lastBackup: this.backupHistory[0],
      config: this.getConfig(),
      totalBackups: files.length,
      totalSize
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
    const dbPath = env.DATABASE_PATH;

    try {
      if (backup.filePath.endsWith('.gz')) {
        tempDbPath = backup.filePath.replace(/\.gz$/, '');
        await runGunzip(backup.filePath, tempDbPath);
        restorePath = tempDbPath;
      }

      if (!fs.existsSync(restorePath)) {
        throw new Error('Decompressed backup file not found');
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

  init(): void {
    if (this.config.enabled) {
      this.startAutoBackup();
    }
    logger.info('Backup service initialized');
  }
}

export const backupService = new BackupService();
