import { logger } from '../../../../../utils/logger';
import type {
  VirtualMachine,
  CreateVMRequest,
  CloneVMRequest,
} from '../../../../../types/vmManagement';
import type { ProxmoxApiClient } from './apiClient';
import { mapVM, mapVMFromConfig } from './mappers';
import { powerOnVM } from './vmPower';

export async function listVMs(client: ProxmoxApiClient): Promise<VirtualMachine[]> {
  await client.ensureConnected();

  logger.info(`📋 获取 Proxmox 虚拟机列表 (节点: ${client.node})`);

  try {
    const vms = await client.apiRequest('GET', `/nodes/${client.node}/qemu`);
    return vms.map((vm: any) => mapVM(vm, client.platformId));
  } catch (error) {
    logger.error('❌ 获取 Proxmox 虚拟机列表失败:', error);
    throw error;
  }
}

export async function getVM(client: ProxmoxApiClient, vmId: string): Promise<VirtualMachine | null> {
  await client.ensureConnected();

  logger.info(`📋 获取 Proxmox 虚拟机详情: ${vmId}`);

  try {
    const config = await client.apiRequest('GET', `/nodes/${client.node}/qemu/${vmId}/config`);
    const status = await client.apiRequest('GET', `/nodes/${client.node}/qemu/${vmId}/status/current`);
    return mapVMFromConfig({ id: vmId, ...config, ...status }, client.platformId);
  } catch (error) {
    logger.error(`❌ 获取 Proxmox 虚拟机 ${vmId} 详情失败:`, error);
    return null;
  }
}

export async function createVM(client: ProxmoxApiClient, request: CreateVMRequest): Promise<VirtualMachine> {
  await client.ensureConnected();

  logger.info(`🚀 创建 Proxmox 虚拟机: ${request.name}`);

  const body: Record<string, any> = {
    vmid: 0,
    name: request.name,
    memory: request.config.memoryMB,
    cores: request.config.numCPUs,
    sockets: 1,
    ostype: 'l26',
    scsihw: 'virtio-scsi-pci',
    net0: 'virtio,bridge=vmbr0',
  };

  if (request.config.disks && request.config.disks.length > 0) {
    const disk = request.config.disks[0];
    body.scsi0 = `local-lvm:${disk.sizeGB}`;
  }

  if (request.config.description) {
    body.description = request.config.description;
  }

  try {
    const result = await client.apiRequest('POST', `/nodes/${client.node}/qemu`, body);
    if (result.upid) {
      await client.waitForTask(result.upid);
    }

    if (request.powerOn) {
      await powerOnVM(client, String(body.vmid === 0 ? 0 : body.vmid));
    }

    const vm: VirtualMachine = {
      id: String(body.vmid === 0 ? result : body.vmid),
      name: request.name,
      hypervisorType: 'proxmox',
      hypervisorId: client.platformId,
      status: request.powerOn ? 'running' : 'stopped',
      powerState: request.powerOn ? 'poweredOn' : 'poweredOff',
      memoryMB: request.config.memoryMB,
      numCPUs: request.config.numCPUs,
      disks: request.config.disks,
      networkInterfaces: request.config.networkInterfaces,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return vm;
  } catch (error) {
    logger.error('❌ 创建 Proxmox 虚拟机失败:', error);
    throw error;
  }
}

export async function cloneVM(client: ProxmoxApiClient, request: CloneVMRequest): Promise<VirtualMachine> {
  await client.ensureConnected();

  logger.info(`📋 克隆 Proxmox 虚拟机: ${request.vmId} -> ${request.name}`);

  const sourceVM = await getVM(client, request.vmId);
  if (!sourceVM) {
    throw new Error('源虚拟机不存在');
  }

  const body: Record<string, any> = {
    newid: 0,
    name: request.name,
  };

  if (request.snapshotId) {
    body.snapname = request.snapshotId;
  }

  try {
    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${request.vmId}/clone`,
      body
    );

    if (result.upid) {
      await client.waitForTask(result.upid);
    }

    if (request.powerOn) {
      await powerOnVM(client, String(request.vmId));
    }

    return {
      ...sourceVM,
      id: String(request.vmId),
      name: request.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      powerState: request.powerOn ? 'poweredOn' : 'poweredOff',
      status: request.powerOn ? 'running' : 'stopped',
    };
  } catch (error) {
    logger.error('❌ 克隆 Proxmox 虚拟机失败:', error);
    throw error;
  }
}

export async function deleteVM(client: ProxmoxApiClient, vmId: string): Promise<void> {
  await client.ensureConnected();

  logger.info(`🗑️ 删除 Proxmox 虚拟机: ${vmId}`);

  try {
    const result = await client.apiRequest(
      'DELETE',
      `/nodes/${client.node}/qemu/${vmId}`
    );
    if (result?.upid) {
      await client.waitForTask(result.upid);
    }
  } catch (error) {
    logger.error(`❌ 删除 Proxmox 虚拟机 ${vmId} 失败:`, error);
    throw error;
  }
}
