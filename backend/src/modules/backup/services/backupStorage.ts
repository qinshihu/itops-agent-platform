/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import { settingsRepository } from '../../../repositories/settingsRepository';
import { logger } from '../../../utils/logger';
import type { BackupInfo, BackupConfig} from './backupTypes';
import { DEFAULT_CONFIG } from './backupTypes';
import { isEncryptedBackup, decryptBackupFile, runGunzip } from './backupCrypto';
import { gracefulRestart } from '../../infra/services/restartService';

export function loadBackupConfig(): BackupConfig {
  try {
    const saved = settingsRepository.getValue('backup_config');
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (error) {
    logger.warn('Failed to load backup config, using defaults', error as Error);
  }
  return DEFAULT_CONFIG;
}

export function saveBackupConfig(config: BackupConfig): void {
  const json = JSON.stringify(config);
  settingsRepository.upsert('backup_config', json);
}

export function loadBackupHistory(): BackupInfo[] {
  try {
    const saved = settingsRepository.getValue('backup_history');
    if (saved) {
      // 加载历史记录并过滤掉不存在的文件
      const history = JSON.parse(saved);
      return history.filter((backup: any) => {
        if (!backup.filePath) return false;
        try {
          return fs.existsSync(backup.filePath);
        } catch {
          return false;
        }
      });
    } else {
      return [];
    }
  } catch (error) {
    logger.warn('Failed to load backup history, starting fresh', error as Error);
    return [];
  }
}

export function saveBackupHistory(history: BackupInfo[]): void {
  const json = JSON.stringify(history.slice(-50));
  settingsRepository.upsert('backup_history', json);
}

export function ensureBackupDir(backupDir: string): void {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

export function scanBackupFiles(backupDir: string): BackupInfo[] {
  try {
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('itops-backup-'))
      .sort()
      .reverse();

    const history = files.map(filename => {
      const filePath = path.join(backupDir, filename);
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

    logger.info('Scanned backup files from filesystem', { count: history.length });
    return history;
  } catch (error) {
    logger.warn('Failed to scan backup files', error as Error);
    return [];
  }
}

export async function calculateChecksum(filePath: string): Promise<string> {
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

export async function verifyBackup(backupPath: string): Promise<boolean> {
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

export function cleanupOldBackups(backupDir: string, keepLast: number): void {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('itops-backup-'))
      .sort()
      .reverse();

    if (files.length > keepLast) {
      const toDelete = files.slice(keepLast);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(path.join(backupDir, file));
          logger.info('Deleted old backup', { file });
        } catch (err) {
          logger.warn(`Failed to delete old backup: ${file}`, err as Error);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to cleanup old backups', error as Error);
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getBackupFilesInfo(backupDir: string): { totalBackups: number; totalSize: number } {
  const files = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir).filter(f => f.startsWith('itops-backup-'))
    : [];

  const totalSize = files.reduce((sum, file) => {
    try {
      return sum + fs.statSync(path.join(backupDir, file)).size;
    } catch {
      return sum;
    }
  }, 0);

  return { totalBackups: files.length, totalSize };
}

/**
 * 执行备份恢复的核心逻辑（解密、解压、完整性校验、文件替换）
 * 由 BackupService.restoreBackup 调用，处理实例状态后委托至此函数
 */
export async function performRestore(
  backup: BackupInfo,
  dbPath: string
): Promise<{ success: boolean; requiresRestart?: boolean; message?: string }> {
  let restorePath = backup.filePath;
  let tempDbPath: string | null = null;
  let afterDecryptPath: string | null = null;

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
  }
}
