/**
 * =============================================================================
 * VMware 适配器 - 快照和模板管理
 * =============================================================================
 */

import type { VMwareAdapter } from './vmwareAdapter';
import type {
  VMSnapshot,
  VMTemplate,
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
} from '../../../../../types/vmManagement';
import { logger } from '../../../../../utils/logger';

// ==========================================================================
// 快照管理
// ==========================================================================

export async function impl_listSnapshots(adapter: VMwareAdapter, vmId: string): Promise<VMSnapshot[]> {
  if (!adapter.connState) await adapter.connect();
  try {
    const result = await adapter.apiRequest('GET', `/rest/vcenter/vm/${vmId}/snapshots`);
    if (!result?.value || !Array.isArray(result.value)) return [];
    return result.value.map((s: Record<string, unknown>) => ({
      id: s.snapshot, name: s.name || s.snapshot,
      description: s.description || '', createdAt: s.creation_date || new Date().toISOString(),
      isCurrent: s.state === 'active', parentId: undefined, childrenIds: [],
    }));
  } catch (error) {
    logger.error(`❌ 获取 VMware 快照列表(${vmId})失败:`, error);
    return [];
  }
}

export async function impl_createSnapshot(adapter: VMwareAdapter, request: CreateSnapshotRequest): Promise<VMSnapshot> {
  if (!adapter.connState) await adapter.connect();
  try {
    const result = await adapter.apiRequest('POST', `/rest/vcenter/vm/${request.vmId}/snapshots`, {
      name: request.name, description: request.description || '',
      memory: request.includeMemory !== false,
    });
    return {
      id: result?.value || `snap-${Date.now()}`, name: request.name,
      description: request.description || '', createdAt: new Date().toISOString(),
      isCurrent: true, childrenIds: [],
    };
  } catch (error) {
    logger.error(`❌ 创建 VMware 快照(${request.vmId})失败:`, error);
    throw error;
  }
}

export async function impl_restoreSnapshot(adapter: VMwareAdapter, request: RestoreSnapshotRequest): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  await adapter.apiRequest(
    'POST',
    `/rest/vcenter/vm/${request.vmId}/snapshots/${request.snapshotId}?action=restore`
  );
}

export async function impl_deleteSnapshot(adapter: VMwareAdapter, snapshotId: string): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  const vms = await impl_listVMs_forSnapshot(adapter);
  for (const vm of vms) {
    const snaps = await impl_listSnapshots(adapter, vm.id);
    if (snaps.some((s) => s.id === snapshotId)) {
      await adapter.apiRequest('DELETE', `/rest/vcenter/vm/${vm.id}/snapshots/${snapshotId}`);
      return;
    }
  }
  logger.warn(`⚠️ 未找到 VMware 快照 ${snapshotId}`);
}

// 内联 listVMs 避免循环依赖
async function impl_listVMs_forSnapshot(adapter: VMwareAdapter): Promise<{ id: string }[]> {
  if (!adapter.connState) await adapter.connect();
  const result = await adapter.apiRequest('GET', '/rest/vcenter/vm');
  if (!result?.value || !Array.isArray(result.value)) return [];
  return result.value.map((s: Record<string, unknown>) => ({ id: s.vm }));
}

// ==========================================================================
// 模板管理
// ==========================================================================

export async function impl_listTemplates(adapter: VMwareAdapter): Promise<VMTemplate[]> {
  if (!adapter.connState) await adapter.connect();
  try {
    const result = await adapter.apiRequest('GET', '/rest/vcenter/vm-template');
    if (!result?.value || !Array.isArray(result.value)) return [];
    return result.value.map((t: Record<string, unknown>) => ({
      id: t.template, name: t.name, description: t.description || '',
      hypervisorType: 'vmware' as const, guestOs: t.guest_OS || undefined,
      memoryMB: t.memory_size_MiB || 0, numCPUs: t.cpu_count || 0,
      disks: [], networkInterfaces: [], createdAt: new Date().toISOString(),
    }));
  } catch (error) {
    logger.error('❌ 获取 VMware 模板列表失败:', error);
    return [];
  }
}

export async function impl_createTemplate(adapter: VMwareAdapter, vmId: string, name: string, description?: string): Promise<VMTemplate> {
  if (!adapter.connState) await adapter.connect();
  const sourceVM = await adapter.getVM(vmId);
  if (!sourceVM) throw new Error('源虚拟机不存在');
  try {
    const result = await adapter.apiRequest('POST', '/rest/vcenter/vm-template', {
      spec: { source_vm: vmId, name, description: description || '' },
    });
    return {
      id: result?.value || vmId, name, description,
      hypervisorType: 'vmware', guestOs: sourceVM.guestOs,
      memoryMB: sourceVM.memoryMB, numCPUs: sourceVM.numCPUs,
      disks: sourceVM.disks, networkInterfaces: sourceVM.networkInterfaces,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('❌ 创建 VMware 模板失败:', error);
    throw error;
  }
}

export async function impl_deleteTemplate(adapter: VMwareAdapter, templateId: string): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  await adapter.apiRequest('DELETE', `/rest/vcenter/vm-template/${templateId}`);
}