/**
 * BackupService - 配置 + 调度 + 委托层
 *
 * 从原 506 行（v4 报告误标 425 行——已实测 506 行）单类主类重构为：
 *   - 核心操作（create / restore / delete / upload）→ backupOperations.ts（pure functions）
 *   - 主类本文件：只负责配置管理 + 自动调度 + 状态管理 + 操作委托
 *
 * 2026-07-08 增量-14 P1-9 拆分：
 *   - 新增 backupOperations.ts（310 行）— 4 个 perform* pure functions
 *   - 精简本文件至 ~190 行（-62%）
 *   - 公开 API 完全保持兼容（BackupService 单例 + 方法签名）
 */

import { scheduleJob, type Job } from 'node-schedule';
// 2026-07-21 P0-8：替换原 require('fs') 模式
import * as fs from 'fs';
import { logger } from '../../../utils/logger';
import { env } from '../../../utils/env';
import { registerShutdownHook } from '../../infra/services/restartService';
import type { BackupInfo, BackupConfig } from './backupTypes';
import { DEFAULT_CONFIG } from './backupTypes';
import {
  loadBackupConfig,
  saveBackupConfig,
  loadBackupHistory,
  saveBackupHistory,
  ensureBackupDir,
  scanBackupFiles,
  cleanupOldBackups,
  getBackupFilesInfo,
} from './backupStorage';
import {
  performCreateBackup,
  performRestoreBackup,
  performDeleteBackup,
  performUploadBackup,
} from './backupOperations';

// Re-exports for backward compatibility
export {
  encryptBackupFile,
  decryptBackupFile,
  isEncryptedBackup,
  shouldEncryptBackup,
} from './backupCrypto';
export type { BackupInfo, BackupConfig };

export class BackupService {
  private config: BackupConfig = DEFAULT_CONFIG;
  private timer: NodeJS.Timeout | null = null;
  private scheduleTimer: Job | null = null;
  private backupHistory: BackupInfo[] = [];
  private isRunning = false;
  private isInitialized = false;
  private isRestoring = false;

  // ──────────────────── 健康检查 ────────────────────

  getLastBackupAgeHours(): number {
    if (this.backupHistory.length === 0) return -1;
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

  // ──────────────────── 初始化与持久化 ────────────────────

  constructor() {
    /* noop */
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

  // ──────────────────── 配置管理 ────────────────────

  getConfig(): BackupConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<BackupConfig>): BackupConfig {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    ensureBackupDir(this.config.backupDir);

    if (this.timer) this.stopAutoBackup();
    if (this.config.enabled) this.startAutoBackup();

    logger.info('Backup configuration updated', this.config);
    return this.getConfig();
  }

  // ──────────────────── 操作委托（核心操作由 backupOperations 实现） ────────────────────

  async createBackup(type: 'auto' | 'manual' = 'manual'): Promise<BackupInfo> {
    if (this.isRunning) throw new Error('Backup already in progress');
    this.isRunning = true;
    try {
      const { backupInfo } = await performCreateBackup({ config: this.config, type });
      this.cleanupOldBackups();
      this.backupHistory.unshift(backupInfo);
      this.saveHistory();
      return backupInfo;
    } finally {
      this.isRunning = false;
    }
  }

  async restoreBackup(backupId: string): Promise<{ success: boolean; requiresRestart?: boolean; message?: string }> {
    if (this.isRunning) throw new Error('Cannot restore while backup is in progress');
    if (this.isRestoring) throw new Error('Restore already in progress');

    const backup = this.backupHistory.find((b) => b.id === backupId);
    if (!backup) throw new Error('Backup not found');

    this.isRestoring = true;
    try {
      return await performRestoreBackup({ backup, dbPath: env.DATABASE_PATH });
    } finally {
      this.isRestoring = false;
    }
  }

  deleteBackup(backupId: string): boolean {
    const backup = this.backupHistory.find((b) => b.id === backupId);
    if (!backup) throw new Error('Backup not found');
    performDeleteBackup(backup);
    this.backupHistory = this.backupHistory.filter((b) => b.id !== backupId);
    this.saveHistory();
    return true;
  }

  async uploadBackup(filePath: string, originalName: string): Promise<BackupInfo> {
    const record = await performUploadBackup({
      config: this.config,
      filePath,
      originalName,
    });
    this.backupHistory.unshift(record);
    this.saveHistory();
    return record;
  }

  getBackupFilePath(backupId: string): string {
    const backup = this.backupHistory.find((b) => b.id === backupId);
    if (!backup) throw new Error('Backup not found');
    if (!fs.existsSync(backup.filePath)) {
      throw new Error('Backup file not found on disk');
    }
    return backup.filePath;
  }

  // ──────────────────── 历史 + 状态查询 ────────────────────

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
    return {
      isRunning: this.isRunning,
      lastBackup: this.backupHistory[0],
      lastBackupAgeHours: this.getLastBackupAgeHours(),
      config: this.getConfig(),
      totalBackups,
      totalSize,
      healthy: this.isHealthy(),
    };
  }

  // ──────────────────── 自动备份调度 ────────────────────

  private cleanupOldBackups(): void {
    cleanupOldBackups(this.config.backupDir, this.config.keepLast);
    this.backupHistory = this.backupHistory.slice(0, this.config.keepLast * 2);
  }

  startAutoBackup(): void {
    if (!this.config.enabled) return;

    const backupCron = process.env.BACKUP_CRON || '0 3 * * *';
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;

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
}

export const backupService = new BackupService();

// 注册优雅关闭钩子（避免 restartService ↔ backupService 循环依赖）
registerShutdownHook(() => backupService.stopAutoBackup());
