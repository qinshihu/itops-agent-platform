/**
 * vmManagementService 虚拟机 CRUD 子模块（2026-07-21 拆分）
 *
 * 把主类 VM CRUD 操作抽为模块级纯函数 + context 传参：
 * - listVMs / getVM / createVM / cloneVM / deleteVM
 * - createTemplate / deleteTemplate / listTemplates
 *
 * 通过 adapter + logAudit 函数参数显式依赖传递
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { logAudit } from './auditOps';
import { getAdapter } from './lifecycle';
import type { LifecycleContext } from './lifecycle';
import type { VMAdapter } from '../vmAdapter';
import type {
  VirtualMachine,
  CreateVMRequest,
  CloneVMRequest,
  VMTemplate,
} from '../../../../../types/vmManagement';

export interface VmOpsContext extends LifecycleContext {
  adapters: Map<string, VMAdapter>;
}

/** 列出平台上所有 VM */
export async function listVMs(ctx: VmOpsContext, platformId: string): Promise<VirtualMachine[]> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vms = await adapter.listVMs();

    logAudit(
      platformId, null, null, 'listVMs', null, null, null,
      '获取到虚拟机列表', 'success', undefined, startedAt, new Date().toISOString(),
    );

    return vms;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, null, null, 'listVMs', null, null, null,
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 获取单个 VM 详情 */
export async function getVM(ctx: VmOpsContext, platformId: string, vmId: string): Promise<VirtualMachine | null> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.getVM(vmId);

    logAudit(
      platformId, vmId, vm?.name || null, 'getVM', null, null, null,
      '获取虚拟机详情', 'success', undefined, startedAt, new Date().toISOString(),
    );

    return vm;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, vmId, null, 'getVM', null, null, null,
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 创建 VM */
export async function createVM(
  ctx: VmOpsContext, platformId: string, request: CreateVMRequest,
  userId?: string, username?: string,
): Promise<VirtualMachine> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.createVM(request);

    logAudit(
      platformId, vm.id, vm.name, 'createVM', userId || null, username || null,
      { name: request.name },
      '创建虚拟机成功', 'success', undefined, startedAt, new Date().toISOString(),
    );

    return vm;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, null, request.name, 'createVM', userId || null, username || null,
      { name: request.name },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 克隆 VM */
export async function cloneVM(
  ctx: VmOpsContext, platformId: string, request: CloneVMRequest,
  userId?: string, username?: string,
): Promise<VirtualMachine> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.cloneVM(request);

    logAudit(
      platformId, vm.id, vm.name, 'cloneVM', userId || null, username || null,
      { sourceVmId: request.vmId, name: request.name },
      '克隆虚拟机成功', 'success', undefined, startedAt, new Date().toISOString(),
    );

    return vm;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, request.vmId, null, 'cloneVM', userId || null, username || null,
      { sourceVmId: request.vmId, name: request.name },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 删除 VM */
export async function deleteVM(
  ctx: VmOpsContext, platformId: string, vmId: string,
  userId?: string, username?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const adapter = getAdapter(ctx, platformId);
    const vm = await adapter.getVM(vmId);

    await adapter.deleteVM(vmId);

    logAudit(
      platformId, vmId, vm?.name || null, 'deleteVM', userId || null, username || null,
      { vmId },
      '删除虚拟机成功', 'success', undefined, startedAt, new Date().toISOString(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit(
      platformId, vmId, null, 'deleteVM', userId || null, username || null,
      { vmId },
      '', 'failed', message, startedAt, new Date().toISOString(),
    );
    throw error;
  }
}

/** 列出所有模板 */
export async function listTemplates(ctx: VmOpsContext, platformId: string): Promise<VMTemplate[]> {
  const adapter = getAdapter(ctx, platformId);
  return adapter.listTemplates();
}

/** 删除模板 */
export async function deleteTemplate(
  ctx: VmOpsContext, platformId: string, templateId: string,
  userId?: string, username?: string,
): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = getAdapter(ctx, platformId);

      await adapter.deleteTemplate(templateId);

      logAudit(
        platformId, null, null, 'deleteTemplate', userId || null, username || null,
        { templateId },
        '删除模板成功', 'success', undefined, startedAt, new Date().toISOString(),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAudit(
        platformId, null, null, 'deleteTemplate', userId || null, username || null,
        { templateId },
        '', 'failed', message, startedAt, new Date().toISOString(),
      );
      throw error;
    }
  }

/** 创建模板 */
export async function createTemplate(
  ctx: VmOpsContext, platformId: string, vmId: string, name: string,
  description?: string, userId?: string, username?: string,
): Promise<VMTemplate> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = getAdapter(ctx, platformId);
      const template = await adapter.createTemplate(vmId, name, description);

      logAudit(
        platformId, vmId, name, 'createTemplate', userId || null, username || null,
        { vmId, name },
        '创建模板成功', 'success', undefined, startedAt, new Date().toISOString(),
      );

      return template;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAudit(
        platformId, vmId, null, 'createTemplate', userId || null, username || null,
        { vmId, name },
        '', 'failed', message, startedAt, new Date().toISOString(),
      );
      throw error;
    }
  }
