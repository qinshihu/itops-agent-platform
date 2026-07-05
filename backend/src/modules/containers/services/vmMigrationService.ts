/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../../../utils/logger';
import { randomUUID } from 'crypto';
import { vmMigrationRepository, virtualMachineRepository } from '../../../../repositories';
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

      this.simulateMigration(task);

      return task;
    } catch (err) {
      logger.error('Failed to start VM migration:', err);
      throw err;
    }
  }

  private simulateMigration(task: MigrationTask) {
    let progress = 0;
    task.status = 'running';

    const interval = setInterval(async () => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100) {
        progress = 100;
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date().toISOString();
        this.activeMigrations.delete(task.id);
        clearInterval(interval);
        this.progressIntervals.delete(task.id);

        vmMigrationRepository.updateStatus(task.id, 'completed');
        vmMigrationRepository.updateProgress(task.id, 100);

        virtualMachineRepository.update(task.vmId, { host: task.targetHost });

        logger.info(`✅ VM migration completed: ${task.vmName} → ${task.targetHost}`);
      }

      task.progress = progress;
      vmMigrationRepository.updateProgress(task.id, progress);
    }, 2000);

    this.progressIntervals.set(task.id, interval);
  }

  cancelMigration(migrationId: string): boolean {
    const task = this.activeMigrations.get(migrationId);
    if (task?.status !== 'running') return false;

    const interval = this.progressIntervals.get(migrationId);
    if (interval) {
      clearInterval(interval);
      this.progressIntervals.delete(migrationId);
    }

    task.status = 'cancelled';
    this.activeMigrations.delete(migrationId);
    vmMigrationRepository.updateStatus(migrationId, 'cancelled');

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
      progress: row.progress, reason: row.reason,
      errorMessage: row.error_message,
      startedAt: row.started_at, completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}

export const vmMigrationService = new VmMigrationService();
