import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import db from '../../../models/database';
import { vmManagementService } from '../../containers/services/vmManagement';

interface SnapshotPolicy {
  id: string;
  name: string;
  platformId: string;
  vmId: string;
  cronExpression: string;
  retention: number;
  snapshotMemory: boolean;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

class VmSnapshotSchedulerService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // 表结构由 migration v050 维护；本服务的运行时策略加载由 initialize() 负责。
  }

  /**
   * 启动时加载已启用的快照策略
   * （原 ensureTables() 的运行时部分，schema 已下沉到 migration v050）
   */
  initialize() {
    this.loadPolicies();
  }

  private loadPolicies() {
    try {
      const rows = db.prepare('SELECT * FROM vm_snapshot_policies WHERE enabled = 1').all() as any[];
      for (const row of rows) {
        this.schedulePolicy(row);
      }
      logger.info(`📋 Loaded ${rows.length} snapshot policies`);
    } catch (err) {
      logger.error('Failed to load snapshot policies:', err);
    }
  }

  private parseCronToInterval(cronExpression: string): number {
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return 3600000;

    const [minute, hour] = parts;
    if (hour === '*' && minute !== '*') {
      return parseInt(minute) * 60 * 1000;
    }
    if (hour !== '*' && minute !== '*') {
      return 24 * 60 * 60 * 1000;
    }
    return 60 * 60 * 1000;
  }

  private schedulePolicy(row: any) {
    const intervalMs = this.parseCronToInterval(row.cron_expression);

    const interval = setInterval(async () => {
      try {
        await this.executePolicy(row);
      } catch (err) {
        logger.error(`Snapshot policy ${row.name} failed:`, err);
      }
    }, intervalMs);

    this.intervals.set(row.id, interval);
  }

  private async executePolicy(policy: any) {
    logger.info(`📸 Executing snapshot policy: ${policy.name} for VM ${policy.vm_id}`);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      await vmManagementService.createSnapshot(policy.platform_id, {
        vmId: policy.vm_id,
        name: `auto-${policy.name}-${timestamp}`,
        description: `Scheduled snapshot by policy ${policy.name}`,
        includeMemory: policy.snapshot_memory === 1,
      });

      await this.cleanupOldSnapshots(policy.platform_id, policy.vm_id, policy.retention);

      db.prepare(`UPDATE vm_snapshot_policies SET last_run_at=datetime('now','localtime') WHERE id=?`).run(policy.id);

      logger.info(`✅ Snapshot policy ${policy.name} completed`);
    } catch (err) {
      logger.error(`❌ Snapshot policy ${policy.name} failed:`, err);
    }
  }

  private async cleanupOldSnapshots(platformId: string, vmId: string, retention: number) {
    try {
      const snapshots = await vmManagementService.listSnapshots(platformId, vmId);
      const autoSnapshots = snapshots
        .filter(s => s.name.startsWith('auto-'))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (autoSnapshots.length > retention) {
        const toDelete = autoSnapshots.slice(0, autoSnapshots.length - retention);

        for (const snap of toDelete) {
          await vmManagementService.deleteSnapshot(platformId, snap.id, vmId);
          logger.info(`🗑️ Cleaned up old snapshot: ${snap.name}`);
        }
      }
    } catch (err) {
      logger.error('Failed to cleanup old snapshots:', err);
    }
  }

  listPolicies(): SnapshotPolicy[] {
    const rows = db.prepare('SELECT * FROM vm_snapshot_policies ORDER BY name').all() as any[];
    return rows.map(r => ({
      id: r.id, name: r.name, platformId: r.platform_id, vmId: r.vm_id,
      cronExpression: r.cron_expression, retention: r.retention,
      snapshotMemory: r.snapshot_memory === 1, enabled: r.enabled === 1,
      lastRunAt: r.last_run_at, nextRunAt: r.next_run_at,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  getPolicy(policyId: string): SnapshotPolicy | null {
    const row = db.prepare('SELECT * FROM vm_snapshot_policies WHERE id = ?').get(policyId) as any;
    if (!row) return null;
    return {
      id: row.id, name: row.name, platformId: row.platform_id, vmId: row.vm_id,
      cronExpression: row.cron_expression, retention: row.retention,
      snapshotMemory: row.snapshot_memory === 1, enabled: row.enabled === 1,
      lastRunAt: row.last_run_at, nextRunAt: row.next_run_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  createPolicy(data: Omit<SnapshotPolicy, 'id' | 'createdAt' | 'updatedAt'>): SnapshotPolicy {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO vm_snapshot_policies (id, name, platform_id, vm_id, cron_expression, retention, snapshot_memory, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.platformId, data.vmId, data.cronExpression, data.retention, data.snapshotMemory ? 1 : 0, data.enabled ? 1 : 0);

    const policy = this.getPolicy(id)!;
    if (policy.enabled) {
      this.schedulePolicy(this.getPolicyRow(id));
    }
    return policy;
  }

  private getPolicyRow(policyId: string): any {
    return db.prepare('SELECT * FROM vm_snapshot_policies WHERE id = ?').get(policyId);
  }

  updatePolicy(policyId: string, updates: Partial<SnapshotPolicy>): SnapshotPolicy {
    const existing = this.getPolicy(policyId);
    if (!existing) throw new Error('策略不存在');

    db.prepare(`
      UPDATE vm_snapshot_policies SET name=?, cron_expression=?, retention=?, snapshot_memory=?, enabled=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      updates.name || existing.name, updates.cronExpression || existing.cronExpression,
      updates.retention !== undefined ? updates.retention : existing.retention,
      updates.snapshotMemory !== undefined ? (updates.snapshotMemory ? 1 : 0) : (existing.snapshotMemory ? 1 : 0),
      updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      policyId
    );

    this.stopPolicy(policyId);
    const updated = this.getPolicy(policyId)!;
    if (updated.enabled) {
      this.schedulePolicy(this.getPolicyRow(policyId));
    }
    return updated;
  }

  deletePolicy(policyId: string): void {
    this.stopPolicy(policyId);
    db.prepare('DELETE FROM vm_snapshot_policies WHERE id = ?').run(policyId);
  }

  private stopPolicy(policyId: string) {
    const interval = this.intervals.get(policyId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(policyId);
    }
  }

  stopAll() {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
  }
}

export const vmSnapshotSchedulerService = new VmSnapshotSchedulerService();
