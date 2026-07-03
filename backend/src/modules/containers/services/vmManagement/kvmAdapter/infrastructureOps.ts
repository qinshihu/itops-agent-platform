import { logger } from '../../../../../utils/logger';
import type {
  VMStats,
  HypervisorHost,
  Datastore,
  VirtualNetwork,
  ResourcePool,
  MigrateVMRequest,
  ReconfigureVMRequest,
  VirtualMachine,
} from '../../../../../types/vmManagement';
import type { KvmSshClient } from './sshClient';
import { parseStats } from './mappers';

// ==========================================================================
// 监控统计
// ==========================================================================

export async function getVMStats(client: KvmSshClient, vmId: string): Promise<VMStats> {
  await client.ensureConnected();
  logger.info(`📊 获取 KVM 虚拟机状态: ${vmId}`);

  try {
    const { stdout: dominfo } = await client.execSSH(`virsh dominfo "${vmId}"`);

    let maxMemKB = 0;
    let usedMemKB = 0;
    for (const line of dominfo.split('\n')) {
      if (line.includes('Max memory:')) {
        maxMemKB = parseInt(line.replace(/\D/g, '')) || 0;
      }
      if (line.includes('Used memory:')) {
        usedMemKB = parseInt(line.replace(/\D/g, '')) || 0;
      }
    }

    let cpuInfo = 0;
    let memInfo = 0;
    let netRx = 0;
    let netTx = 0;

    try {
      const { stdout: stats } = await client.execSSH(`virsh domstats "${vmId}"`);
      const parsed = parseStats(stats);
      cpuInfo = parsed.cpuPercent;
      memInfo = parsed.memKB;
      netRx = parsed.netRxBytes;
      netTx = parsed.netTxBytes;
    } catch {
      // domstats 可能不支持，忽略
    }

    const maxMemMB = maxMemKB ? Math.round(maxMemKB / 1024) : 0;
    const usedMemMB = usedMemKB ? Math.round(usedMemKB / 1024) : memInfo ? Math.round(memInfo / 1024) : 0;
    const memPct = maxMemMB > 0 ? Math.round((usedMemMB / maxMemMB) * 10000) / 100 : 0;

    return {
      cpuUsagePercent: cpuInfo || 0,
      memoryUsagePercent: memPct,
      memoryUsageMB: usedMemMB,
      memoryTotalMB: maxMemMB,
      diskUsageBytes: 0,
      diskTotalBytes: 0,
      networkTxBytes: netTx,
      networkRxBytes: netRx,
      uptimeSeconds: 0,
      snapshotCount: 0,
    };
  } catch (error) {
    logger.error(`❌ 获取 KVM 虚拟机 ${vmId} 状态失败:`, error);
    throw error;
  }
}

// ==========================================================================
// 配置与迁移
// ==========================================================================

export async function reconfigureVM(client: KvmSshClient, request: ReconfigureVMRequest): Promise<VirtualMachine> {
  await client.ensureConnected();
  logger.info(`⚙️ 重新配置 KVM 虚拟机: ${request.vmId}`);

  const { stdout: state } = await client.execSSH(`virsh domstate "${request.vmId}"`);
  const wasRunning = state.trim().toLowerCase() === 'running';

  if (wasRunning) {
    logger.warn('⚠️ KVM 虚拟机正在运行，配置修改将在下次启动时生效');
  }

  if (request.memoryMB !== undefined) {
    if (!wasRunning) {
      await client.execSSH(`virsh setmaxmem "${request.vmId}" ${request.memoryMB * 1024} --config`);
    }
  }

  if (request.numCPUs !== undefined) {
    if (!wasRunning) {
      await client.execSSH(`virsh setvcpus "${request.vmId}" ${request.numCPUs} --config --maximum`);
      await client.execSSH(`virsh setvcpus "${request.vmId}" ${request.numCPUs} --config`);
    }
  }

  return {
    id: request.vmId,
    name: request.vmId,
    hypervisorType: 'kvm' as const,
    hypervisorId: client.platformId,
    status: wasRunning ? ('running' as const) : ('stopped' as const),
    powerState: wasRunning ? ('poweredOn' as const) : ('poweredOff' as const),
    memoryMB: request.memoryMB || 0,
    numCPUs: request.numCPUs || 0,
    disks: [],
    networkInterfaces: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function migrateVM(client: KvmSshClient, request: MigrateVMRequest): Promise<void> {
  await client.ensureConnected();
  logger.info(`🚚 迁移 KVM 虚拟机: ${request.vmId} -> ${request.targetHostId || 'auto'}`);

  if (!request.targetHostId) {
    throw new Error('KVM 迁移需要指定目标主机');
  }

  try {
    const cmd = `virsh migrate --live "${request.vmId}" qemu+tcp://${request.targetHostId}/system`;
    await client.execSSH(cmd);
    logger.info(`✅ KVM 虚拟机 ${request.vmId} 迁移完成`);
  } catch (error) {
    logger.error(`❌ 迁移 KVM 虚拟机 ${request.vmId} 失败:`, error);
    throw error;
  }
}

// ==========================================================================
// 主机管理
// ==========================================================================

export async function listHosts(client: KvmSshClient): Promise<HypervisorHost[]> {
  await client.ensureConnected();
  logger.info('📋 获取 KVM 主机列表');

  try {
    const { stdout: cpuInfo } = await client.execSSH('nproc');
    const { stdout: memInfo } = await client.execSSH('free -m | grep Mem');
    const { stdout: hostname } = await client.execSSH('hostname');
    const { stdout: version } = await client.execSSH('virsh version --short');

    const numCpus = parseInt(cpuInfo.trim()) || 0;
    const memParts = memInfo.trim().split(/\s+/);
    const memTotalMB = memParts[1] ? parseInt(memParts[1]) : 0;
    const memUsedMB = memParts[2] ? parseInt(memParts[2]) : 0;

    return [{
      id: client.host,
      name: hostname.trim() || client.host,
      hypervisorType: 'kvm',
      status: 'connected',
      ipAddress: client.host,
      numCpus,
      cpuMhz: 0,
      memoryTotalMB: memTotalMB,
      memoryUsageMB: memUsedMB,
      numVMs: 0,
      numRunningVMs: 0,
      version: version.trim() || undefined,
    }];
  } catch (error) {
    logger.error('❌ 获取 KVM 主机列表失败:', error);
    return [];
  }
}

export async function getHost(client: KvmSshClient, hostId: string): Promise<HypervisorHost | null> {
  await client.ensureConnected();

  try {
    const hosts = await listHosts(client);
    return hosts.find((h) => h.id === hostId) || null;
  } catch (error) {
    logger.error(`❌ 获取 KVM 主机 ${hostId} 失败:`, error);
    return null;
  }
}

// ==========================================================================
// 数据存储
// ==========================================================================

export async function listDatastores(client: KvmSshClient): Promise<Datastore[]> {
  await client.ensureConnected();
  logger.info('📋 获取 KVM 数据存储列表');

  try {
    const { stdout } = await client.execSSH('virsh pool-list --all');
    const lines = stdout.split('\n');
    const datastores: Datastore[] = [];
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
        try {
          const { stdout: poolInfo } = await client.execSSH(`virsh pool-info "${parts[0]}"`);
          let capacity = 0;
          let available = 0;
          for (const l of poolInfo.split('\n')) {
            if (l.includes('Capacity:')) capacity = parseFloat(l.replace(/[^0-9.]/g, '')) * 1024 * 1024 * 1024;
            if (l.includes('Available:')) available = parseFloat(l.replace(/[^0-9.]/g, '')) * 1024 * 1024 * 1024;
          }

          datastores.push({
            id: parts[0],
            name: parts[0],
            hypervisorType: 'kvm',
            hypervisorId: client.platformId,
            type: parts[2].includes('dir') ? ('local' as const) : ('other' as const),
            capacityBytes: Math.round(capacity),
            freeBytes: Math.round(available),
            usedBytes: Math.round(capacity - available),
            accessible: parts[1] === 'active',
          });
        } catch {
          datastores.push({
            id: parts[0],
            name: parts[0],
            hypervisorType: 'kvm',
            hypervisorId: client.platformId,
            type: 'other' as const,
            capacityBytes: 0,
            freeBytes: 0,
            usedBytes: 0,
            accessible: parts[1] === 'active',
          });
        }
      }
    }

    return datastores;
  } catch (error) {
    logger.error('❌ 获取 KVM 数据存储列表失败:', error);
    return [];
  }
}

export async function getDatastore(client: KvmSshClient, datastoreId: string): Promise<Datastore | null> {
  await client.ensureConnected();

  try {
    const datastores = await listDatastores(client);
    return datastores.find((d) => d.id === datastoreId) || null;
  } catch (error) {
    logger.error(`❌ 获取 KVM 数据存储 ${datastoreId} 失败:`, error);
    return null;
  }
}

// ==========================================================================
// 网络管理
// ==========================================================================

export async function listNetworks(client: KvmSshClient): Promise<VirtualNetwork[]> {
  await client.ensureConnected();
  logger.info('📋 获取 KVM 网络列表');

  try {
    const { stdout } = await client.execSSH('virsh net-list --all');
    const lines = stdout.split('\n');
    const networks: VirtualNetwork[] = [];
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
        networks.push({
          id: parts[0],
          name: parts[0],
          hypervisorType: 'kvm',
          hypervisorId: client.platformId,
          type: parts[2] === 'bridge' ? ('bridge' as const) : ('other' as const),
        });
      }
    }

    return networks;
  } catch (error) {
    logger.error('❌ 获取 KVM 网络列表失败:', error);
    return [];
  }
}

// ==========================================================================
// 资源池
// ==========================================================================

export async function listResourcePools(client: KvmSshClient): Promise<ResourcePool[]> {
  await client.ensureConnected();
  logger.info('📋 获取 KVM 资源池列表');

  try {
    const { stdout } = await client.execSSH('virsh pool-list --all');
    const lines = stdout.split('\n');
    const pools: ResourcePool[] = [];
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
        pools.push({
          id: parts[0],
          name: parts[0],
          hypervisorType: 'kvm',
          hypervisorId: client.platformId,
        });
      }
    }

    return pools;
  } catch (error) {
    logger.error('❌ 获取 KVM 资源池列表失败:', error);
    return [];
  }
}
