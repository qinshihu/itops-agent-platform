/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { vmSnapshotPolicyRepository } from '../../../repositories';
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
  private intervals: Map<string, NodeJS.Timeout> = new Map(); // 实际存的是 setTimeout 返回的 Timeout 对象

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
      const rows = vmSnapshotPolicyRepository.listEnabled();
      for (const row of rows) {
        this.schedulePolicy(row);
      }
      logger.info(`📋 Loaded ${rows.length} snapshot policies`);
    } catch (err) {
      logger.error('Failed to load snapshot policies:', err);
    }
  }

  /**
   * 解析 cron 表达式 → 下次触发时间（毫秒时间戳）
   *
   * 支持常见的 5 段 cron 语法（minute hour day-of-month month day-of-week）：
   *   - * * * * *      每分钟
   *   - m * * * *       每 m 分钟（m 1-59）
   *   - m h * * *       每天 h:m
   *   - m h * * d       每周星期 d 的 h:m
   *   - *(步进 n) * * * *   每 n 分钟
   *   - m h * * 1-5     周一到周五的 h:m
   *
   * 不支持：复杂 day-of-month / 范围 / L 表达式 → 退回到每分钟执行
   *
   * 较之前实现的优势：
   *   1) 使用"到下次触发时间"差值而不是 setInterval 的固定间隔，确保到点执行
   *   2) 支持更多 cron 语法（步进、星期几、星期范围）
   *   3) 解析失败不静默降级为 1 小时，而是返回下次 1 分钟后（更快重试）
   */
  private parseCronToNextRun(cronExpression: string, fromDate: Date = new Date()): number {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) {
      // 解析失败 → 1 分钟后执行
      return fromDate.getTime() + 60 * 1000;
    }
    const [minute, hour, , , dow] = parts;

    // 计算候选时间：从下一分钟开始（cron 触发到分钟边界）
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);

    // 最多往前看 8 天（足够覆盖 dows 7 + 1 缓冲）
    for (let i = 0; i < 60 * 24 * 8; i++) {
      if (
        this.matchCronField(minute, next.getMinutes()) &&
        this.matchCronField(hour, next.getHours()) &&
        this.matchCronField(dow, next.getDay())
      ) {
        return next.getTime();
      }
      next.setMinutes(next.getMinutes() + 1);
    }

    // 实在找不到匹配：8 天后再试
    return fromDate.getTime() + 8 * 24 * 60 * 60 * 1000;
  }

  /**
   * 判断 cron 字段是否匹配给定数值
   * 支持 *、数字、步进（星号斜杠n）、a-b、a,b,c
   */
  private matchCronField(field: string, value: number): boolean {
    if (field === '*') return true;

    // 逗号分隔：任一子表达式匹配即可
    for (const part of field.split(',')) {
      // 步进：星号 / n
      const stepMatch = part.match(/^\*\/(\d+)$/);
      if (stepMatch) {
        const step = parseInt(stepMatch[1]);
        if (step > 0 && value % step === 0) return true;
        continue;
      }
      // 范围 a-b
      const rangeMatch = part.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        if (value >= start && value <= end) return true;
        continue;
      }
      // 单值
      const num = parseInt(part);
      if (!isNaN(num) && num === value) return true;
    }
    return false;
  }

  private schedulePolicy(row: any) {
    const scheduleNext = () => {
      const delay = Math.max(this.parseCronToNextRun(row.cron_expression) - Date.now(), 1000);

      const timeout = setTimeout(async () => {
        try {
          await this.executePolicy(row);
        } catch (err) {
          logger.error(`Snapshot policy ${row.name} failed:`, err);
        }
        // 重新调度
        if (this.intervals.has(row.id)) {
          scheduleNext();
        }
      }, delay);

      this.intervals.set(row.id, timeout);
    };

    scheduleNext();
  }

  private async executePolicy(policy: any) {
    logger.info(`📸 Executing snapshot policy: ${policy.name} for VM ${policy.vm_id}`);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // 快照名带 policyId 前缀，避免不同策略/手动快照被误删
      const snapshotName = `auto-${policy.id}-${timestamp}`;

      await vmManagementService.createSnapshot(policy.platform_id, {
        vmId: policy.vm_id,
        name: snapshotName,
        description: `Scheduled snapshot by policy ${policy.name}`,
        includeMemory: policy.snapshot_memory === 1,
      });

      // 只清理属于本策略的快照（按 policyId 前缀）
      await this.cleanupOldSnapshots(policy.platform_id, policy.vm_id, policy.id, policy.retention);

      vmSnapshotPolicyRepository.updateLastRunAt(policy.id);

      logger.info(`✅ Snapshot policy ${policy.name} completed`);
    } catch (err) {
      logger.error(`❌ Snapshot policy ${policy.name} failed:`, err);
    }
  }

  /**
   * 清理本策略的旧快照（按 policyId 隔离，避免误删其它策略/手动快照）
   */
  private async cleanupOldSnapshots(platformId: string, vmId: string, policyId: string, retention: number) {
    try {
      const snapshots = await vmManagementService.listSnapshots(platformId, vmId);
      const policyPrefix = `auto-${policyId}-`;

      const policySnapshots = snapshots
        .filter(s => s.name.startsWith(policyPrefix))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (policySnapshots.length > retention) {
        const toDelete = policySnapshots.slice(0, policySnapshots.length - retention);

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
    const rows = vmSnapshotPolicyRepository.list();
    return rows.map(r => ({
      id: r.id, name: r.name, platformId: r.platform_id, vmId: r.vm_id,
      cronExpression: r.cron_expression, retention: r.retention,
      snapshotMemory: r.snapshot_memory === 1, enabled: r.enabled === 1,
      lastRunAt: r.last_run_at ?? undefined, nextRunAt: r.next_run_at ?? undefined,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  getPolicy(policyId: string): SnapshotPolicy | null {
    const row = vmSnapshotPolicyRepository.getById(policyId);
    if (!row) return null;
    return {
      id: row.id, name: row.name, platformId: row.platform_id, vmId: row.vm_id,
      cronExpression: row.cron_expression, retention: row.retention,
      snapshotMemory: row.snapshot_memory === 1, enabled: row.enabled === 1,
      lastRunAt: row.last_run_at ?? undefined, nextRunAt: row.next_run_at ?? undefined,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  createPolicy(data: Omit<SnapshotPolicy, 'id' | 'createdAt' | 'updatedAt'>): SnapshotPolicy {
    const id = randomUUID();
    vmSnapshotPolicyRepository.create({
      id,
      name: data.name,
      platform_id: data.platformId,
      vm_id: data.vmId,
      cron_expression: data.cronExpression,
      retention: data.retention,
      snapshot_memory: data.snapshotMemory ? 1 : 0,
      enabled: data.enabled ? 1 : 0,
    });

    const policy = this.getPolicy(id)!;
    if (policy.enabled) {
      this.schedulePolicy(this.getPolicyRow(id));
    }
    return policy;
  }

  private getPolicyRow(policyId: string): any {
    return vmSnapshotPolicyRepository.getById(policyId);
  }

  updatePolicy(policyId: string, updates: Partial<SnapshotPolicy>): SnapshotPolicy {
    const existing = this.getPolicy(policyId);
    if (!existing) throw new Error('策略不存在');

    const fields: Record<string, unknown> = {};
    if (updates.name !== undefined) fields.name = updates.name;
    if (updates.cronExpression !== undefined) fields.cron_expression = updates.cronExpression;
    if (updates.retention !== undefined) fields.retention = updates.retention;
    if (updates.snapshotMemory !== undefined) fields.snapshot_memory = updates.snapshotMemory ? 1 : 0;
    if (updates.enabled !== undefined) fields.enabled = updates.enabled ? 1 : 0;
    vmSnapshotPolicyRepository.update(policyId, fields);

    this.stopPolicy(policyId);
    const updated = this.getPolicy(policyId)!;
    if (updated.enabled) {
      this.schedulePolicy(this.getPolicyRow(policyId));
    }
    return updated;
  }

  deletePolicy(policyId: string): void {
    this.stopPolicy(policyId);
    vmSnapshotPolicyRepository.delete(policyId);
  }

  private stopPolicy(policyId: string) {
    const timeout = this.intervals.get(policyId);
    if (timeout) {
      clearTimeout(timeout);
      this.intervals.delete(policyId);
    }
  }

  stopAll() {
    this.intervals.forEach((timeout) => clearTimeout(timeout));
    this.intervals.clear();
  }
}

export const vmSnapshotSchedulerService = new VmSnapshotSchedulerService();
