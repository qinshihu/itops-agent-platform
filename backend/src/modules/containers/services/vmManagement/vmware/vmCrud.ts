/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * VMware 适配器 - VM CRUD 和电源操作
 * =============================================================================
 */

import type { VMwareAdapter } from './vmwareAdapter';
import type {
  VirtualMachine,
  CreateVMRequest,
  CloneVMRequest,
} from '../../../../../types/vmManagement';
import { logger } from '../../../../../utils/logger';

// ==========================================================================
// VM CRUD
// ==========================================================================

export async function impl_listVMs(adapter: VMwareAdapter): Promise<VirtualMachine[]> {
  if (!adapter.connState) await adapter.connect();
  logger.info('📋 获取 VMware 虚拟机列表');
  try {
    const result = await adapter.apiRequest('GET', '/rest/vcenter/vm');
    if (!result?.value || !Array.isArray(result.value)) return [];
    const vms = await Promise.all(
      result.value.map(async (s: any) => {
        try {
          const d = await adapter.apiRequest('GET', `/rest/vcenter/vm/${s.vm}`);
          return adapter.mapVM(s.vm, d?.value || s);
        } catch {
          return adapter.mapVM(s.vm, s);
        }
      })
    );
    return vms;
  } catch (error) {
    logger.error('❌ 获取 VMware 虚拟机列表失败:', error);
    throw error;
  }
}

export async function impl_getVM(adapter: VMwareAdapter, vmId: string): Promise<VirtualMachine | null> {
  if (!adapter.connState) await adapter.connect();
  try {
    const detail = await adapter.apiRequest('GET', `/rest/vcenter/vm/${vmId}`);
    if (!detail?.value) return null;
    return adapter.mapVM(vmId, detail.value);
  } catch (error) {
    logger.error(`❌ 获取 VMware 虚拟机 ${vmId} 详情失败:`, error);
    return null;
  }
}

export async function impl_createVM(adapter: VMwareAdapter, request: CreateVMRequest): Promise<VirtualMachine> {
  if (!adapter.connState) await adapter.connect();
  const body: Record<string, any> = {
    spec: {
      name: request.name,
      guest_OS: 'OTHER_LINUX_64',
      memory: { size_MiB: request.config.memoryMB },
      cpu: { count: request.config.numCPUs },
      boot: { type: 'BIOS' },
    },
  };
  if (request.datastoreId) body.spec.placement = { datastore: request.datastoreId };
  try {
    const result = await adapter.apiRequest('POST', '/rest/vcenter/vm', body);
    if (!result?.value) throw new Error('创建虚拟机失败：未返回 VM ID');
    if (request.powerOn) {
      try { await impl_powerOnVM(adapter, result.value); } catch (e) { logger.warn('⚠️ 创建后启动失败:', e); }
    }
    return {
      id: result.value, name: request.name, hypervisorType: 'vmware', hypervisorId: adapter.platId,
      status: request.powerOn ? 'running' : 'stopped',
      powerState: request.powerOn ? 'poweredOn' : 'poweredOff',
      memoryMB: request.config.memoryMB, numCPUs: request.config.numCPUs,
      disks: request.config.disks, networkInterfaces: request.config.networkInterfaces,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('❌ 创建 VMware 虚拟机失败:', error);
    throw error;
  }
}

export async function impl_cloneVM(adapter: VMwareAdapter, request: CloneVMRequest): Promise<VirtualMachine> {
  if (!adapter.connState) await adapter.connect();
  const sourceVM = await impl_getVM(adapter, request.vmId);
  if (!sourceVM) throw new Error('源虚拟机不存在');
  try {
    const result = await adapter.apiRequest('POST', '/rest/vcenter/vm?action=clone', {
      spec: { name: request.name, source: request.vmId },
    });
    if (!result?.value) throw new Error('克隆失败：未返回 VM ID');
    if (request.powerOn) {
      try { await impl_powerOnVM(adapter, result.value); } catch { logger.warn('⚠️ 克隆后启动失败'); }
    }
    return {
      ...sourceVM, id: result.value, name: request.name,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      powerState: request.powerOn ? 'poweredOn' : 'poweredOff',
      status: request.powerOn ? 'running' : 'stopped',
    };
  } catch (error) {
    logger.error('❌ 克隆 VMware 虚拟机失败:', error);
    throw error;
  }
}

export async function impl_deleteVM(adapter: VMwareAdapter, vmId: string): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  try {
    await adapter.apiRequest('DELETE', `/rest/vcenter/vm/${vmId}`);
  } catch (error) {
    logger.error(`❌ 删除 VMware 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}

// ==========================================================================
// 电源操作
// ==========================================================================

export async function impl_powerOnVM(adapter: VMwareAdapter, vmId: string): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  await adapter.apiRequest('POST', `/rest/vcenter/vm/${vmId}/power/start`);
}

export async function impl_powerOffVM(adapter: VMwareAdapter, vmId: string): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  await adapter.apiRequest('POST', `/rest/vcenter/vm/${vmId}/power/stop`);
}

export async function impl_restartVM(adapter: VMwareAdapter, vmId: string): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  await adapter.apiRequest('POST', `/rest/vcenter/vm/${vmId}/power/reset`);
}

export async function impl_suspendVM(adapter: VMwareAdapter, vmId: string): Promise<void> {
  if (!adapter.connState) await adapter.connect();
  await adapter.apiRequest('POST', `/rest/vcenter/vm/${vmId}/power/suspend`);
}

export async function impl_pauseVM(adapter: VMwareAdapter, vmId: string): Promise<void> {
  await impl_suspendVM(adapter, vmId);
}

export async function impl_resumeVM(adapter: VMwareAdapter, vmId: string): Promise<void> {
  await impl_powerOnVM(adapter, vmId);
}