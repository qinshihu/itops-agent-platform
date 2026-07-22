/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../../../utils/logger';
import { randomUUID } from 'crypto';
import { vmMigrationRepository, virtualMachineRepository } from '../../../repositories';
import { vmManagementService } from '../../containers/services/vmManagement';

interface MigrationTask {
  id: string;
  vmId: string;
  vmName: string;
  sourceHost: string;
  targetHost: string;
  platformId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  reason?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

class VmMigrationService {
  private activeMigrations: Map<string, MigrationTask> = new Map();
  /** 实际发起的迁移任务（用于取消） */
  private pendingRequests: Map<string, AbortController> = new Map();
  /** 进度轮询 interval（hypervisor API 进度） */
  private progressIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // 表结构由 migration v049 维护，本服务不再 ensureTables。
  }

  async startMigration(platformId: string, vmId: string, targetHost: string, reason?: string): Promise<MigrationTask> {
    try {
      const vm = await vmManagementService.getVM(platformId, vmId);
      if (!vm) throw new Error('VM 不存在');
      if (vm.status !== 'running') throw new Error('仅运行中的 VM 支持迁移');

      const task: MigrationTask = {
        id: randomUUID(),
        vmId, vmName: vm.name, sourceHost: vm.host || 'unknown',
        targetHost, platformId,
        status: 'pending', progress: 0,
        reason, startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      vmMigrationRepository.create({
        id: task.id,
        vm_id: vmId,
        vm_name: vm.name,
        source_host: task.sourceHost,
        target_host: targetHost,
        platform_id: platformId,
        status: 'running',
        reason: reason || null,
        started_at: task.startedAt,
      });

      this.activeMigrations.set(task.id, task);

      // 真实迁移（异步执行，立即返回 task）
      void this.runRealMigration(task).catch(err => {
        logger.error('Migration task crashed:', err);
        this.markFailed(task.id, err instanceof Error ? err.message : String(err));
      });

      return task;
    } catch (err) {
      logger.error('Failed to start VM migration:', err);
      throw err;
    }
  }

  /**
   * 真实执行迁移：
   *   1) 调用 hypervisor 的 migrateVM
   *   2) 后台进度轮询（hypervisor 自身可能不支持进度查询，则走"乐观进度"）
   *   3) 成功后更新 SQLite 中的 host 字段
   */
  private async runRealMigration(task: MigrationTask): Promise<void> {
    task.status = 'running';
    const abort = new AbortController();
    this.pendingRequests.set(task.id, abort);

    // 立即给个基础进度，让 UI 有反馈
    vmMigrationRepository.updateProgress(task.id, 5);

    let optimisticInterval: NodeJS.Timeout | null = null;

    try {
      // 启乐观进度：每 2s 推进 5~10%，最多 90%（剩余 10% 等真实结果）
      let optimistic = 5;
      optimisticInterval = setInterval(() => {
        if (abort.signal.aborted) return;
        optimistic = Math.min(optimistic + Math.floor(Math.random() * 6) + 5, 90);
        task.progress = optimistic;
        vmMigrationRepository.updateProgress(task.id, optimistic);
      }, 2000);
      this.progressIntervals.set(task.id, optimisticInterval);

      await vmManagementService.migrateVM(task.platformId, {
        vmId: task.vmId,
        targetHostId: task.targetHost,
        priority: 'defaultPriority',
      });

      // hypervisor API 已成功返回
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = new Date().toISOString();
      vmMigrationRepository.updateStatus(task.id, 'completed');
      vmMigrationRepository.updateProgress(task.id, 100);

      // 同步本地 SQLite 记录
      virtualMachineRepository.update(task.vmId, { host: task.targetHost });

      logger.info(`✅ VM migration completed: ${task.vmName} → ${task.targetHost}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.markFailed(task.id, message);
      throw err;
    } finally {
      if (optimisticInterval) clearInterval(optimisticInterval);
      this.progressIntervals.delete(task.id);
      this.pendingRequests.delete(task.id);
      this.activeMigrations.delete(task.id);
    }
  }

  private markFailed(taskId: string, message: string) {
    vmMigrationRepository.updateStatus(taskId, 'failed', message);
    const task = this.activeMigrations.get(taskId);
    if (task) {
      task.status = 'failed';
      task.errorMessage = message;
      task.completedAt = new Date().toISOString();
      this.activeMigrations.delete(taskId);
    }
  }

  cancelMigration(migrationId: string): boolean {
    const task = this.activeMigrations.get(migrationId);
    if (!task) return false;
    if (task.status !== 'running' && task.status !== 'pending') return false;

    // 中止 AbortController（对支持 AbortSignal 的 hypervisor 调用生效）
    const abort = this.pendingRequests.get(migrationId);
    abort?.abort();

    const interval = this.progressIntervals.get(migrationId);
    if (interval) {
      clearInterval(interval);
      this.progressIntervals.delete(migrationId);
    }

    task.status = 'cancelled';
    task.completedAt = new Date().toISOString();
    this.activeMigrations.delete(migrationId);
    vmMigrationRepository.updateStatus(migrationId, 'cancelled');

    logger.info(`🛑 VM migration cancelled: ${task.vmName}`);
    return true;
  }

  getMigration(migrationId: string): MigrationTask | null {
    const row = vmMigrationRepository.getById(migrationId);
    if (!row) return null;
    return this.rowToTask(row);
  }

  listMigrations(vmId?: string): MigrationTask[] {
    const { rows } = vmMigrationRepository.list({ vm_id: vmId });
    return rows.map((r) => this.rowToTask(r));
  }

  getActiveMigrations(): MigrationTask[] {
    return Array.from(this.activeMigrations.values());
  }

  private rowToTask(row: any): MigrationTask {
    return {
      id: row.id, vmId: row.vm_id, vmName: row.vm_name,
      sourceHost: row.source_host, targetHost: row.target_host,
      platformId: row.platform_id, status: row.status,
      progress: row.progress || 0, reason: row.reason,
      errorMessage: row.error_message,
      startedAt: row.started_at, completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}

export const vmMigrationService = new VmMigrationService();
