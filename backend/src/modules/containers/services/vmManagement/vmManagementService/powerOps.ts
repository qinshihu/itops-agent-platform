/**
 * vmManagementService 电源控制子模块（2026-07-21 拆分）
 *
 * 把主类 3 个电源操作抽为模块级纯函数：
 * - powerOnVM / powerOffVM / restartVM
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { logAudit } from './auditOps';
import { getAdapter } from './lifecycle';
import type { LifecycleContext } from './lifecycle';
import type { VMAdapter } from '../vmAdapter';

export interface PowerOpsContext extends LifecycleContext {
  adapters: Map<string, VMAdapter>;
}

/** 启动 VM */
export async function powerOnVM(
  ctx: PowerOpsContext, platformId: string, vmId: string,
  userId?: string, username?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.getVM(vmId);

    await adapter.powerOnVM(vmId);

    logAudit(
      platformId, vmId, vm?.name || null, 'powerOnVM', userId || null, username || null,
      { vmId },
      '启动虚拟机成功', 'success', undefined, startedAt, new Date().toISOString(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, vmId, null, 'powerOnVM', userId || null, username || null,
      { vmId },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 停止 VM */
export async function powerOffVM(
  ctx: PowerOpsContext, platformId: string, vmId: string,
  userId?: string, username?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.getVM(vmId);

    await adapter.powerOffVM(vmId);

    logAudit(
      platformId, vmId, vm?.name || null, 'powerOffVM', userId || null, username || null,
      { vmId },
      '关闭虚拟机成功', 'success', undefined, startedAt, new Date().toISOString(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, vmId, null, 'powerOffVM', userId || null, username || null,
      { vmId },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 重启 VM */
export async function restartVM(
  ctx: PowerOpsContext, platformId: string, vmId: string,
  userId?: string, username?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.getVM(vmId);

    await adapter.restartVM(vmId);

    logAudit(
      platformId, vmId, vm?.name || null, 'restartVM', userId || null, username || null,
      { vmId },
      '重启虚拟机成功', 'success', undefined, startedAt, new Date().toISOString(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, vmId, null, 'restartVM', userId || null, username || null,
      { vmId },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}
