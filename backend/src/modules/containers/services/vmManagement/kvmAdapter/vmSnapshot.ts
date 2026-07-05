import { logger } from '../../../../../utils/logger';
import type {
  VMSnapshot,
  VMTemplate,
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
} from '../../../../../types/vmManagement';
import type { KvmSshClient } from './sshClient';
import { getVM } from './vmLifecycle';
import { listVMs } from './vmLifecycle';

export async function listSnapshots(client: KvmSshClient, vmId: string): Promise<VMSnapshot[]> {
  await client.ensureConnected();
  logger.info(`📋 获取 KVM 虚拟机快照列表: ${vmId}`);

  try {
    const { stdout } = await client.execSSH(`virsh snapshot-list "${vmId}"`);

    const lines = stdout.split('\n');
    const snapshots: VMSnapshot[] = [];
    let startParsing = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('Name') || trimmed.startsWith('---')) {
        startParsing = true;
        continue;
      }
      if (!startParsing) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        snapshots.push({
          id: parts[0],
          name: parts[0],
          description: '',
          createdAt: `${parts[1]} ${parts[2]}`,
          isCurrent: trimmed.includes('current'),
          childrenIds: [],
        });
      }
    }

    return snapshots;
  } catch (error) {
    logger.error(`❌ 获取 KVM 虚拟机 ${vmId} 快照列表失败:`, error);
    return [];
  }
}

export async function createSnapshot(client: KvmSshClient, request: CreateSnapshotRequest): Promise<VMSnapshot> {
  await client.ensureConnected();
  logger.info(`📸 创建 KVM 虚拟机快照: ${request.vmId} - ${request.name}`);

  try {
    await client.execSSH(`virsh snapshot-create-as "${request.vmId}" "${request.name}" "${request.description || ''}"`);
    return {
      id: request.name,
      name: request.name,
      description: request.description,
      createdAt: new Date().toISOString(),
      isCurrent: true,
      childrenIds: [],
    };
  } catch (error) {
    logger.error(`❌ 创建 KVM 虚拟机 ${request.vmId} 快照失败:`, error);
    throw error;
  }
}

export async function restoreSnapshot(client: KvmSshClient, request: RestoreSnapshotRequest): Promise<void> {
  await client.ensureConnected();
  logger.info(`⏮️ 恢复 KVM 虚拟机快照: ${request.vmId} -> ${request.snapshotId}`);

  try {
    await client.execSSH(`virsh snapshot-revert "${request.vmId}" "${request.snapshotId}"`);
    logger.info(`✅ KVM 虚拟机 ${request.vmId} 快照 ${request.snapshotId} 已恢复`);
  } catch (error) {
    logger.error(`❌ 恢复 KVM 虚拟机 ${request.vmId} 快照 ${request.snapshotId} 失败:`, error);
    throw error;
  }
}

export async function deleteSnapshot(client: KvmSshClient, snapshotId: string): Promise<void> {
  await client.ensureConnected();
  logger.info(`🗑️ 删除 KVM 快照: ${snapshotId}`);

  try {
    const vms = await listVMs(client);
    let deleted = false;

    for (const vm of vms) {
      try {
        const snapshots = await listSnapshots(client, vm.id);
        if (snapshots.some((s) => s.id === snapshotId)) {
          await client.execSSH(`virsh snapshot-delete "${vm.id}" "${snapshotId}"`);
          deleted = true;
          logger.info(`✅ KVM 快照 ${snapshotId} 已删除 (VM: ${vm.id})`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!deleted) {
      logger.warn(`⚠️ 未找到 KVM 快照 ${snapshotId}`);
    }
  } catch (error) {
    logger.error(`❌ 删除 KVM 快照 ${snapshotId} 失败:`, error);
    throw error;
  }
}

// ==========================================================================
// 模板管理
// ==========================================================================

export async function listTemplates(client: KvmSshClient): Promise<VMTemplate[]> {
  await client.ensureConnected();
  logger.info('📋 获取 KVM 模板列表');
  return [];
}

export async function createTemplate(
  client: KvmSshClient,
  vmId: string,
  name: string,
  description?: string
): Promise<VMTemplate> {
  await client.ensureConnected();
  logger.info(`📋 创建 KVM 模板: ${vmId} -> ${name}`);

  const sourceVM = await getVM(client, vmId);
  if (!sourceVM) {
    throw new Error('源虚拟机不存在');
  }

  return {
    id: name,
    name,
    description,
    hypervisorType: 'kvm',
    guestOs: sourceVM.guestOs,
    memoryMB: sourceVM.memoryMB,
    numCPUs: sourceVM.numCPUs,
    disks: sourceVM.disks,
    networkInterfaces: sourceVM.networkInterfaces,
    createdAt: new Date().toISOString(),
  };
}

export async function deleteTemplate(client: KvmSshClient, templateId: string): Promise<void> {
  await client.ensureConnected();
  logger.info(`🗑️ 删除 KVM 模板: ${templateId}`);

  try {
    await client.execSSH(`virsh vol-delete --pool default "${templateId}.qcow2"`);
  } catch (error) {
    logger.warn(`⚠️ KVM 模板 ${templateId} 删除警告:`, error);
  }
}
