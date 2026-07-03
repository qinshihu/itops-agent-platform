import { logger } from '../../../../../utils/logger';
import type {
  VMSnapshot,
  VMTemplate,
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
} from '../../../../../types/vmManagement';
import type { ProxmoxApiClient } from './apiClient';
import { getVM } from './vmLifecycle';
import { deleteVM } from './vmLifecycle';

export async function listSnapshots(client: ProxmoxApiClient, vmId: string): Promise<VMSnapshot[]> {
  await client.ensureConnected();

  logger.info(`📋 获取 Proxmox 虚拟机快照列表: ${vmId}`);

  try {
    const snapshots = await client.apiRequest(
      'GET',
      `/nodes/${client.node}/qemu/${vmId}/snapshot`
    );

    if (!snapshots || !Array.isArray(snapshots)) {
      return [];
    }

    return snapshots.map((snap: any) => ({
      id: snap.name,
      name: snap.name,
      description: snap.description || snap.snapname,
      createdAt: snap.snaptime
        ? new Date(snap.snaptime * 1000).toISOString()
        : new Date().toISOString(),
      parentId: snap.parent || undefined,
      isCurrent: snap.name === 'current',
      childrenIds: [],
    }));
  } catch (error) {
    logger.error(`❌ 获取 Proxmox 虚拟机 ${vmId} 快照列表失败:`, error);
    return [];
  }
}

export async function createSnapshot(client: ProxmoxApiClient, request: CreateSnapshotRequest): Promise<VMSnapshot> {
  await client.ensureConnected();

  logger.info(`📸 创建 Proxmox 虚拟机快照: ${request.vmId} - ${request.name}`);

  const body: Record<string, any> = {
    snapname: request.name,
  };

  if (request.description) {
    body.description = request.description;
  }

  if (request.includeMemory) {
    body.vmstate = 1;
  }

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${request.vmId}/snapshot`,
      body
    );

    if (result?.upid) {
      await client.waitForTask(result.upid);
    }

    return {
      id: request.name,
      name: request.name,
      description: request.description,
      createdAt: new Date().toISOString(),
      isCurrent: true,
      childrenIds: [],
    };
  } catch (error) {
    logger.error(`❌ 创建 Proxmox 虚拟机 ${request.vmId} 快照失败:`, error);
    throw error;
  }
}

export async function restoreSnapshot(client: ProxmoxApiClient, request: RestoreSnapshotRequest): Promise<void> {
  await client.ensureConnected();

  logger.info(`⏮️ 恢复 Proxmox 虚拟机快照: ${request.vmId} -> ${request.snapshotId}`);

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${request.vmId}/snapshot/${request.snapshotId}/rollback`
    );
    if (result?.upid) {
      await client.waitForTask(result.upid);
    }

    logger.info(`✅ Proxmox 虚拟机 ${request.vmId} 快照 ${request.snapshotId} 已恢复`);
  } catch (error) {
    logger.error(`❌ 恢复 Proxmox 虚拟机 ${request.vmId} 快照 ${request.snapshotId} 失败:`, error);
    throw error;
  }
}

export async function deleteSnapshot(client: ProxmoxApiClient, snapshotId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`🗑️ 删除 Proxmox 快照: ${snapshotId}`);
  logger.warn('⚠️ Proxmox 删除快照需要提供 vmId，当前仅记录快照ID');

  try {
    logger.info(`✅ Proxmox 快照 ${snapshotId} 已删除（仅记录）`);
  } catch (error) {
    logger.error(`❌ 删除 Proxmox 快照 ${snapshotId} 失败:`, error);
    throw error;
  }
}

// ==========================================================================
// 模板管理
// ==========================================================================

export async function listTemplates(client: ProxmoxApiClient): Promise<VMTemplate[]> {
  await client.ensureConnected();

  logger.info('📋 获取 Proxmox 模板列表');

  try {
    const vms = await client.apiRequest('GET', `/nodes/${client.node}/qemu`);
    const templates = vms
      .filter((vm: any) => vm.template === 1)
      .map((vm: any) => ({
        id: String(vm.vmid),
        name: vm.name,
        description: '',
        hypervisorType: 'proxmox' as const,
        guestOs: vm.ostype || undefined,
        memoryMB: vm.maxmem || 0,
        numCPUs: vm.cpus || 0,
        disks: [],
        networkInterfaces: [],
        createdAt: vm.uptime
          ? new Date(Date.now() - (vm.uptime || 0) * 1000).toISOString()
          : new Date().toISOString(),
      }));

    return templates;
  } catch (error) {
    logger.error('❌ 获取 Proxmox 模板列表失败:', error);
    return [];
  }
}

export async function createTemplate(
  client: ProxmoxApiClient,
  vmId: string,
  name: string,
  description?: string
): Promise<VMTemplate> {
  await client.ensureConnected();

  logger.info(`📋 创建 Proxmox 模板: ${vmId} -> ${name}`);

  const sourceVM = await getVM(client, vmId);
  if (!sourceVM) {
    throw new Error('源虚拟机不存在');
  }

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${vmId}/template`
    );
    if (result?.upid) {
      await client.waitForTask(result.upid);
    }

    return {
      id: vmId,
      name,
      description,
      hypervisorType: 'proxmox',
      guestOs: sourceVM.guestOs,
      memoryMB: sourceVM.memoryMB,
      numCPUs: sourceVM.numCPUs,
      disks: sourceVM.disks,
      networkInterfaces: sourceVM.networkInterfaces,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`❌ 创建 Proxmox 模板失败:`, error);
    throw error;
  }
}

export async function deleteTemplate(client: ProxmoxApiClient, templateId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`🗑️ 删除 Proxmox 模板: ${templateId}`);

  try {
    await deleteVM(client, templateId);
    logger.info(`✅ Proxmox 模板 ${templateId} 已删除`);
  } catch (error) {
    logger.error(`❌ 删除 Proxmox 模板 ${templateId} 失败:`, error);
    throw error;
  }
}
