/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * VMware 适配器 - 迁移和配置变更
 * =============================================================================
 */

import type { VMwareAdapter } from './vmwareAdapter';
import type {
  VirtualMachine,
  MigrateVMRequest,
  ReconfigureVMRequest,
} from '../../../../../types/vmManagement';

// ==========================================================================
// 配置变更
// ==========================================================================

export async function impl_reconfigureVM(adapter: VMwareAdapter, request: ReconfigureVMRequest): Promise<VirtualMachine> {
  if (!adapter.connState) await adapter.connect();
  const spec: Record<string, any> = {};
  if (request.memoryMB !== undefined) spec.memory = { size_MiB: request.memoryMB };
  if (request.numCPUs !== undefined) spec.cpu = { count: request.numCPUs };
  if (Object.keys(spec).length > 0) {
    await adapter.apiRequest('PATCH', `/rest/vcenter/vm/${request.vmId}`, { spec });
  }
  const vm = await adapter.getVM(request.vmId);
  if (!vm) throw new Error('虚拟机不存在');
  return { ...vm, updatedAt: new Date().toISOString() };
}

// ==========================================================================
// 迁移
// ==========================================================================

export async function impl_migrateVM(adapter: VMwareAdapter, request: MigrateVMRequest): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  await adapter.apiRequest('POST', `/rest/vcenter/vm/${request.vmId}?action=migrate`, {
    spec: {
      host: request.targetHostId || undefined,
      datastore: request.targetDatastoreId || undefined,
    },
  });
}