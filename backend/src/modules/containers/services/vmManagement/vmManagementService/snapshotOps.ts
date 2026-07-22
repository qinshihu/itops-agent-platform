/**
 * vmManagementService 快照 + 迁移子模块（2026-07-21 拆分）
 *
 * 把主类 5 个操作抽为模块级纯函数：
 * - listSnapshots / createSnapshot / restoreSnapshot / deleteSnapshot
 * - migrateVM（虚拟机迁移）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { logAudit } from './auditOps';
import { getAdapter } from './lifecycle';
import type { LifecycleContext } from './lifecycle';
import type { VMAdapter } from '../vmAdapter';
import type { VMSnapshot, CreateSnapshotRequest, RestoreSnapshotRequest } from '../../../../../types/vmManagement';

export interface SnapshotOpsContext extends LifecycleContext {
  adapters: Map<string, VMAdapter>;
}

/** 列出快照 */
export async function listSnapshots(ctx: SnapshotOpsContext, platformId: string, vmId: string): Promise<VMSnapshot[]> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const snapshots = await adapter.listSnapshots(vmId);

    logAudit(
      platformId, vmId, null, 'listSnapshots', null, null,
      { vmId },
      '获取到快照列表', 'success', undefined, startedAt, new Date().toISOString(),
    );

    return snapshots;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, vmId, null, 'listSnapshots', null, null,
      { vmId },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 创建快照 */
export async function createSnapshot(
  ctx: SnapshotOpsContext, platformId: string, request: CreateSnapshotRequest,
  userId?: string, username?: string,
): Promise<VMSnapshot> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.getVM(request.vmId);

    const snapshot = await adapter.createSnapshot(request);

    logAudit(
      platformId, request.vmId, vm?.name || null, 'createSnapshot', userId || null, username || null,
      { vmId: request.vmId, name: request.name },
      '创建快照成功', 'success', undefined, startedAt, new Date().toISOString(),
    );

    return snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, request.vmId, null, 'createSnapshot', userId || null, username || null,
      { vmId: request.vmId, name: request.name },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 恢复快照 */
export async function restoreSnapshot(
  ctx: SnapshotOpsContext, platformId: string, request: RestoreSnapshotRequest,
  userId?: string, username?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.getVM(request.vmId);

    await adapter.restoreSnapshot(request);

    logAudit(
      platformId, request.vmId, vm?.name || null, 'restoreSnapshot', userId || null, username || null,
      { vmId: request.vmId, snapshotId: request.snapshotId },
      '恢复快照成功', 'success', undefined, startedAt, new Date().toISOString(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, request.vmId, null, 'restoreSnapshot', userId || null, username || null,
      { vmId: request.vmId, snapshotId: request.snapshotId },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 删除快照 */
export async function deleteSnapshot(
  ctx: SnapshotOpsContext, platformId: string, snapshotId: string, vmId: string,
  userId?: string, username?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);

    await adapter.deleteSnapshot(snapshotId);

    logAudit(
      platformId, vmId, null, 'deleteSnapshot', userId || null, username || null,
      { snapshotId },
      '删除快照成功', 'success', undefined, startedAt, new Date().toISOString(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, vmId, null, 'deleteSnapshot', userId || null, username || null,
      { snapshotId },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 迁移 VM */
export async function migrateVM(
  ctx: SnapshotOpsContext,
  platformId: string,
  request: { vmId: string; targetHostId?: string; targetDatastoreId?: string; priority?: 'defaultPriority' | 'highPriority' | 'lowPriority' },
  userId?: string, username?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.getVM(request.vmId);

    await adapter.migrateVM(request);

    logAudit(
      platformId, request.vmId, vm?.name || null, 'migrateVM', userId || null, username || null,
      { ...request },
      '迁移虚拟机成功', 'success', undefined, startedAt, new Date().toISOString(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, request.vmId, null, 'migrateVM', userId || null, username || null,
      { ...request },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}
