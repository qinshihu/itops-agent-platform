/**
 * vmManagementService 基础设施查询子模块（2026-07-21 拆分）
 *
 * 把主类 4 个基础设施查询方法抽为模块级纯函数：
 * - getVMStats / listHosts / listDatastores / listNetworks
 *
 * 这 4 个方法只转发到 adapter 对应方法，adapter 通过 getAdapter 上下文获取
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { getAdapter } from './lifecycle';
import type { LifecycleContext } from './lifecycle';
import type { VMAdapter } from '../vmAdapter';
import type { VMStats, HypervisorHost, Datastore, VirtualNetwork } from '../../../../../types/vmManagement';

export interface InfraOpsContext extends LifecycleContext {
  adapters: Map<string, VMAdapter>;
}

/** 获取 VM 的性能统计 */
export async function getVMStats(ctx: InfraOpsContext, platformId: string, vmId: string): Promise<VMStats> {
  const adapter = getAdapter(ctx, platformId);
  return adapter.getVMStats(vmId);
}

/** 列出 hypervisor 主机 */
export async function listHosts(ctx: InfraOpsContext, platformId: string): Promise<HypervisorHost[]> {
  const adapter = getAdapter(ctx, platformId);
  return adapter.listHosts();
}

/** 列出 datastore */
export async function listDatastores(ctx: InfraOpsContext, platformId: string): Promise<Datastore[]> {
  const adapter = getAdapter(ctx, platformId);
  return adapter.listDatastores();
}

/** 列出网络 */
export async function listNetworks(ctx: InfraOpsContext, platformId: string): Promise<VirtualNetwork[]> {
  const adapter = getAdapter(ctx, platformId);
  return adapter.listNetworks();
}
