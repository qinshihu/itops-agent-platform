/**
 * 备份操作层（pure functions / 无状态）
 *
 * 从 backup/services/index.ts 抽离（2026-07-08 增量-14 P1-9 拆分）。
 *
 * 拆出 4 个核心操作（pure async functions）：
 *  1. performCreateBackup() — 创建备份（copy db → compress → encrypt → verify）
 *  2. performRestoreBackup() — 恢复备份（decrypt → decompress → integrity → swap）
 *  3. performDeleteBackup() — 删除备份
 *  4. performUploadBackup() — 上传导入备份
 *
 * 这些函数操作的是 BackupInfo + BackupConfig 状态对象，不依赖 BackupService 单例。
 * 主类 index.ts 退化为"配置 + 调度 + 委托"。
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { logger } from '../../../utils/logger';
import { env } from '../../../utils/env';
import { gracefulRestart } from '../../infra/services/restartService';
import type { BackupInfo, BackupConfig } from './backupTypes';
import {
  encryptBackupFile,
  decryptBackupFile,
  shouldEncryptBackup,
  runGzip,
  runGunzip,
} from './backupCrypto';
import {
  ensureBackupDir,
  verifyBackup,
  calculateChecksum,
  formatSize,
} from './backupStorage';

// ──────────────────────────────────────────────────────────────────
// 1. 创建备份
// ──────────────────────────────────────────────────────────────────

export interface CreateBackupOptions {
  config: BackupConfig;
  type: 'auto' | 'manual';
}

export interface CreateBackupResult {
  backupInfo: BackupInfo;
  duration: number;
}

export async function performCreateBackup(
  options: CreateBackupOptions
): Promise<CreateBackupResult> {
  const { config, type } = options;
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `itops-backup-${timestamp}.db`;
  const filePath = path.join(config.backupDir, filename);

  const backupInfo: BackupInfo = {
    id: `backup-${Date.now()}`,
    filename,
    filePath,
    size: 0,
    createdAt: new Date().toISOString(),
    type,
    status: 'in_progress',
    verified: false,
  };

  try {
    ensureBackupDir(config.backupDir);
    logger.info(`Starting ${type} backup`, { filename, filePath });

    // 1. 复制 DB 文件
    const sourcePath = env.DATABASE_PATH;
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source database file not found: ${sourcePath}`);
    }
    fs.copyFileSync(sourcePath, filePath);
    logger.info('Backup file created', { filePath });

    // 2. 压缩
    if (config.compression) {
      const compressedPath = `${filePath}.gz`;
      try {
        await runGzip(filePath, compressedPath);
        fs.unlinkSync(filePath);
        backupInfo.filePath = compressedPath;
        backupInfo.filename = `${filename}.gz`;
      } catch (err) {
        logger.warn('Compression failed, keeping uncompressed backup', err as Error);
      }
    }

    // 3. 加密
    if (shouldEncryptBackup()) {
      const encryptedPath = `${backupInfo.filePath}.enc`;
      try {
        const { checksum } = await encryptBackupFile(backupInfo.filePath, encryptedPath);
        fs.unlinkSync(backupInfo.filePath);
        backupInfo.filePath = encryptedPath;
        backupInfo.filename = `${backupInfo.filename}.enc`;
        backupInfo.checksum = checksum;
      } catch (err) {
        logger.warn('Encryption failed, keeping unencrypted backup', err as Error);
      }
    }

    // 4. 更新大小
    if (!fs.existsSync(backupInfo.filePath)) {
      throw new Error(`Backup file not found: ${backupInfo.filePath}`);
    }
    backupInfo.size = fs.statSync(backupInfo.filePath).size;

    // 5. 校验
    if (config.verifyAfterBackup) {
      try {
        backupInfo.verified = await verifyBackup(backupInfo.filePath);
        if (backupInfo.verified) {
          backupInfo.checksum = await calculateChecksum(backupInfo.filePath);
        }
      } catch (err) {
        logger.warn('Backup verification failed, but backup is saved', err as Error);
        backupInfo.verified = false;
      }
    }

    backupInfo.status = 'completed';
    logger.info('Backup completed', {
      filename: backupInfo.filename,
      size: formatSize(backupInfo.size),
      duration: Date.now() - startTime,
      verified: backupInfo.verified,
    });

    return { backupInfo, duration: Date.now() - startTime };
  } catch (error) {
    backupInfo.status = 'failed';
    backupInfo.error = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Backup failed', error as Error);
    throw error;
  }
}

// ──────────────────────────────────────────────────────────────────
// 2. 恢复备份
// ──────────────────────────────────────────────────────────────────

export interface RestoreBackupOptions {
  backup: BackupInfo;
  dbPath: string;
}

export interface RestoreBackupResult {
  success: boolean;
  requiresRestart: boolean;
  message?: string;
}

export async function performRestoreBackup(
  options: RestoreBackupOptions
): Promise<RestoreBackupResult> {
  const { backup, dbPath } = options;

  if (!fs.existsSync(backup.filePath)) {
    throw new Error('Backup file not found on disk');
  }

  let restorePath = backup.filePath;
  let tempDbPath: string | null = null;
  let afterDecryptPath: string | null = null;

  try {
    // 1. 解密
    if (backup.filePath.endsWith('.enc')) {
      const decryptedPath = backup.filePath.replace(/\.enc$/, '');
      logger.info('Decrypting backup file before restore', { from: backup.filePath });
      await decryptBackupFile(backup.filePath, decryptedPath);
      afterDecryptPath = decryptedPath;
      restorePath = decryptedPath;
    }

    // 2. 解压
    if (restorePath.endsWith('.gz')) {
      const decompressedPath = restorePath.replace(/\.gz$/, '');
      await runGunzip(restorePath, decompressedPath);
      tempDbPath = decompressedPath;
      restorePath = decompressedPath;
    }

    if (!fs.existsSync(restorePath)) {
      throw new Error('Decompressed/decrypted backup file not found');
    }

    // 3. 完整性校验
    const verifyDb = new Database(restorePath, { readonly: true, fileMustExist: true });
    const integrity = verifyDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
    verifyDb.close();
    if (integrity[0]?.integrity_check !== 'ok') {
      throw new Error(`Backup integrity check failed: ${integrity[0]?.integrity_check}`);
    }

    // 4. 备份当前 DB
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    const backupPath = `${dbPath}.pre-restore-${Date.now()}`;

    logger.info('Backing up current database before restore...');
    fs.copyFileSync(dbPath, backupPath);
    if (fs.existsSync(walPath)) fs.copyFileSync(walPath, `${backupPath}-wal`);
    if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, `${backupPath}-shm`);

    // 5. 覆盖 DB
    fs.copyFileSync(restorePath, dbPath);
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    logger.info('Database file restored from backup');

    // 6. 触发优雅重启
    logger.info('Database restored. Starting graceful restart...');
    setTimeout(() => {
      gracefulRestart();
    }, 1000);

    return {
      success: true,
      requiresRestart: true,
      message: '数据库已恢复，系统将在1秒后自动重启',
    };
  } finally {
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
    if (afterDecryptPath && fs.existsSync(afterDecryptPath)) {
      fs.unlinkSync(afterDecryptPath);
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// 3. 删除备份
// ──────────────────────────────────────────────────────────────────

export function performDeleteBackup(backup: BackupInfo): boolean {
  try {
    if (fs.existsSync(backup.filePath)) {
      fs.unlinkSync(backup.filePath);
    }
    logger.info('Backup deleted', { backupId: backup.id });
    return true;
  } catch (error) {
    logger.error('Failed to delete backup', error as Error);
    throw error;
  }
}

// ──────────────────────────────────────────────────────────────────
// 4. 上传导入备份
// ──────────────────────────────────────────────────────────────────

export interface UploadBackupOptions {
  config: BackupConfig;
  filePath: string;
  originalName: string;
}

export async function performUploadBackup(
  options: UploadBackupOptions
): Promise<BackupInfo> {
  const { config, filePath, originalName } = options;
  ensureBackupDir(config.backupDir);

  const fileStat = fs.statSync(filePath);
  const timestamp = new Date().toISOString();
  const backupId = uuidv4();

  const destFileName = `uploaded-${timestamp.replace(/[:.]/g, '-')}${path.extname(originalName)}`;
  const destFilePath = path.join(config.backupDir, destFileName);
  fs.copyFileSync(filePath, destFilePath);

  let finalPath = destFilePath;
  let finalSize = fileStat.size;

  if (config.compression && !destFileName.endsWith('.gz')) {
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
    verified: false,
  };

  logger.info('Uploaded backup imported', { backupId, originalName });
  return record;
}
