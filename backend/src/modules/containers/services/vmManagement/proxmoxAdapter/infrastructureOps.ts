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
import type { ProxmoxApiClient } from './apiClient';
import { mapStorageType } from './mappers';
import { getVM } from './vmLifecycle';

// ==========================================================================
// 监控统计
// ==========================================================================

export async function getVMStats(client: ProxmoxApiClient, vmId: string): Promise<VMStats> {
  await client.ensureConnected();

  logger.info(`📊 获取 Proxmox 虚拟机状态: ${vmId}`);

  try {
    const status = await client.apiRequest(
      'GET',
      `/nodes/${client.node}/qemu/${vmId}/status/current`
    );

    const cpuPercent = status.cpu !== undefined ? status.cpu * 100 : 0;
    const maxMem = status.maxmem || 0;
    const usedMem = status.mem || 0;
    const memPercent = maxMem > 0 ? (usedMem / maxMem) * 100 : 0;

    const diskUsage = 0;
    let diskTotal = 0;

    try {
      const config = await client.apiRequest(
        'GET',
        `/nodes/${client.node}/qemu/${vmId}/config`
      );

      if (config) {
        for (const key of Object.keys(config)) {
          if (key.startsWith('scsi') || key.startsWith('virtio') || key.startsWith('ide')) {
            const match = config[key]?.match(/size=(\d+)G/);
            if (match) {
              diskTotal += parseInt(match[1]) * 1024 * 1024 * 1024;
            }
          }
        }
      }
    } catch {
      // 忽略配置获取失败
    }

    const netIn = status.netin || 0;
    const netOut = status.netout || 0;

    return {
      cpuUsagePercent: Math.min(Math.round(cpuPercent * 100) / 100, 100),
      memoryUsagePercent: Math.min(Math.round(memPercent * 100) / 100, 100),
      memoryUsageMB: Math.round(usedMem / (1024 * 1024)),
      memoryTotalMB: Math.round(maxMem / (1024 * 1024)),
      diskUsageBytes: diskUsage || 0,
      diskTotalBytes: diskTotal,
      networkTxBytes: netOut,
      networkRxBytes: netIn,
      uptimeSeconds: status.uptime || 0,
      snapshotCount: 0,
    };
  } catch (error) {
    logger.error(`❌ 获取 Proxmox 虚拟机 ${vmId} 状态失败:`, error);
    throw error;
  }
}

// ==========================================================================
// 配置与迁移
// ==========================================================================

export async function reconfigureVM(client: ProxmoxApiClient, request: ReconfigureVMRequest): Promise<VirtualMachine> {
  await client.ensureConnected();

  logger.info(`⚙️ 重新配置 Proxmox 虚拟机: ${request.vmId}`);

  try {
    const body: Record<string, any> = {};

    if (request.memoryMB !== undefined) {
      body.memory = request.memoryMB;
    }
    if (request.numCPUs !== undefined) {
      body.cores = request.numCPUs;
    }

    if (Object.keys(body).length > 0) {
      const result = await client.apiRequest(
        'PUT',
        `/nodes/${client.node}/qemu/${request.vmId}/config`,
        body
      );
      if (result?.upid) {
        await client.waitForTask(result.upid);
      }
    }

    const vm = await getVM(client, request.vmId);
    if (!vm) {
      throw new Error('虚拟机不存在');
    }

    return {
      ...vm,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`❌ 重新配置 Proxmox 虚拟机 ${request.vmId} 失败:`, error);
    throw error;
  }
}

export async function migrateVM(client: ProxmoxApiClient, request: MigrateVMRequest): Promise<void> {
  await client.ensureConnected();

  logger.info(`🚚 迁移 Proxmox 虚拟机: ${request.vmId} -> ${request.targetHostId || 'auto'}`);

  try {
    const body: Record<string, any> = {
      target: request.targetHostId || client.node,
    };

    const result = await client.apiRequest(
      'POST',
      `/nodes/${client.node}/qemu/${request.vmId}/migrate`,
      body
    );
    if (result?.upid) {
      await client.waitForTask(result.upid);
    }

    logger.info(`✅ Proxmox 虚拟机 ${request.vmId} 迁移完成`);
  } catch (error) {
    logger.error(`❌ 迁移 Proxmox 虚拟机 ${request.vmId} 失败:`, error);
    throw error;
  }
}

// ==========================================================================
// 主机管理
// ==========================================================================

export async function listHosts(client: ProxmoxApiClient): Promise<HypervisorHost[]> {
  await client.ensureConnected();

  logger.info('📋 获取 Proxmox 主机列表');

  try {
    const nodes = await client.apiRequest('GET', '/nodes');

    return nodes.map((node: any) => ({
      id: node.node,
      name: node.node,
      hypervisorType: 'proxmox' as const,
      status: node.status === 'online' ? ('connected' as const) : ('disconnected' as const),
      ipAddress: client.host,
      version: node.pveversion || undefined,
      numCpus: node.maxcpu || 0,
      cpuMhz: node.cpu ? Math.round(node.cpu * 1000) : 0,
      memoryTotalMB: node.maxmem ? Math.round(node.maxmem / (1024 * 1024)) : 0,
      memoryUsageMB: node.mem ? Math.round(node.mem / (1024 * 1024)) : 0,
      numVMs: 0,
      numRunningVMs: 0,
    }));
  } catch (error) {
    logger.error('❌ 获取 Proxmox 主机列表失败:', error);
    return [];
  }
}

export async function getHost(client: ProxmoxApiClient, hostId: string): Promise<HypervisorHost | null> {
  await client.ensureConnected();

  try {
    const hosts = await listHosts(client);
    return hosts.find((h) => h.id === hostId) || null;
  } catch (error) {
    logger.error(`❌ 获取 Proxmox 主机 ${hostId} 失败:`, error);
    return null;
  }
}

// ==========================================================================
// 数据存储
// ==========================================================================

export async function listDatastores(client: ProxmoxApiClient): Promise<Datastore[]> {
  await client.ensureConnected();

  logger.info('📋 获取 Proxmox 数据存储列表');

  try {
    const storages = await client.apiRequest(
      'GET',
      `/nodes/${client.node}/storage`
    );

    return storages.map((storage: any) => ({
      id: storage.storage,
      name: storage.storage,
      hypervisorType: 'proxmox' as const,
      hypervisorId: client.platformId,
      type: mapStorageType(storage.type),
      capacityBytes: storage.total || 0,
      freeBytes: storage.avail || 0,
      usedBytes: storage.used || 0,
      path: storage.path || undefined,
      accessible: storage.enabled !== 0,
    }));
  } catch (error) {
    logger.error('❌ 获取 Proxmox 数据存储列表失败:', error);
    return [];
  }
}

export async function getDatastore(client: ProxmoxApiClient, datastoreId: string): Promise<Datastore | null> {
  await client.ensureConnected();

  try {
    const datastores = await listDatastores(client);
    return datastores.find((d) => d.id === datastoreId) || null;
  } catch (error) {
    logger.error(`❌ 获取 Proxmox 数据存储 ${datastoreId} 失败:`, error);
    return null;
  }
}

// ==========================================================================
// 网络管理
// ==========================================================================

export async function listNetworks(client: ProxmoxApiClient): Promise<VirtualNetwork[]> {
  await client.ensureConnected();

  logger.info('📋 获取 Proxmox 网络列表');

  try {
    const networks = await client.apiRequest(
      'GET',
      `/nodes/${client.node}/network`
    );

    return networks.map((net: any) => ({
      id: net.iface,
      name: net.iface,
      hypervisorType: 'proxmox' as const,
      hypervisorId: client.platformId,
      type: net.type === 'bridge' ? ('bridge' as const) : ('other' as const),
      switchName: net.bridge_ports !== '' ? net.iface : undefined,
      vlanId: net.bridge_vlan_aware ? undefined : undefined,
    }));
  } catch (error) {
    logger.error('❌ 获取 Proxmox 网络列表失败:', error);
    return [];
  }
}

// ==========================================================================
// 资源池
// ==========================================================================

export async function listResourcePools(client: ProxmoxApiClient): Promise<ResourcePool[]> {
  await client.ensureConnected();

  logger.info('📋 获取 Proxmox 资源池列表');

  try {
    const pools = await client.apiRequest('GET', '/pools');

    return pools.map((pool: any) => ({
      id: pool.poolid,
      name: pool.poolid,
      hypervisorType: 'proxmox' as const,
      hypervisorId: client.platformId,
    }));
  } catch (error) {
    logger.error('❌ 获取 Proxmox 资源池列表失败:', error);
    return [];
  }
}
