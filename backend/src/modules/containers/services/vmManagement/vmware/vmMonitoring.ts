/**
 * =============================================================================
 * VMware 适配器 - 监控、主机、数据存储、网络、资源池
 * =============================================================================
 */

import type { VMwareAdapter } from './vmwareAdapter';
import type {
  VMStats,
  HypervisorHost,
  Datastore,
  VirtualNetwork,
  ResourcePool,
} from '../../../../../types/vmManagement';
import { logger } from '../../../../../utils/logger';

// ==========================================================================
// 监控统计
// ==========================================================================

export async function impl_getVMStats(adapter: VMwareAdapter, vmId: string): Promise<VMStats> {
  if (!adapter.connState) await adapter.connect();
  const detail = await adapter.apiRequest('GET', `/rest/vcenter/vm/${vmId}`);
  const vm = detail?.value || {};
  const memSize = vm.memory?.size_MiB || 0;
  const memPct = vm.memory?.usage_percent || 0;
  return {
    cpuUsagePercent: vm.cpu?.usage_percent || 0,
    memoryUsagePercent: memPct,
    memoryUsageMB: Math.round((memSize * memPct) / 100),
    memoryTotalMB: memSize,
    diskUsageBytes: 0, diskTotalBytes: 0,
    networkTxBytes: 0, networkRxBytes: 0,
    uptimeSeconds: 0, snapshotCount: 0,
  };
}

// ==========================================================================
// 主机管理
// ==========================================================================

export async function impl_listHosts(adapter: VMwareAdapter): Promise<HypervisorHost[]> {
  if (!adapter.connState) await adapter.connect();
  try {
    const result = await adapter.apiRequest('GET', '/rest/vcenter/host');
    if (!result?.value || !Array.isArray(result.value)) return [];
    return result.value.map((h: Record<string, unknown>) => ({
      id: h.host, name: h.name, hypervisorType: 'vmware' as const,
      status: h.connection_state === 'CONNECTED' ? ('connected' as const) : ('disconnected' as const),
      ipAddress: '', numCpus: 0, cpuMhz: 0, memoryTotalMB: 0, memoryUsageMB: 0,
      numVMs: 0, numRunningVMs: 0, version: undefined,
    }));
  } catch (error) {
    logger.error('❌ 获取 VMware 主机列表失败:', error);
    return [];
  }
}

export async function impl_getHost(adapter: VMwareAdapter, hostId: string): Promise<HypervisorHost | null> {
  const hosts = await impl_listHosts(adapter);
  return hosts.find((h) => h.id === hostId) || null;
}

// ==========================================================================
// 数据存储
// ==========================================================================

export async function impl_listDatastores(adapter: VMwareAdapter): Promise<Datastore[]> {
  if (!adapter.connState) await adapter.connect();
  try {
    const result = await adapter.apiRequest('GET', '/rest/vcenter/datastore');
    if (!result?.value || !Array.isArray(result.value)) return [];
    return result.value.map((ds: Record<string, unknown>) => ({
      id: ds.datastore, name: ds.name, hypervisorType: 'vmware' as const, hypervisorId: adapter.platId,
      type: ds.type === 'NFS' ? ('nfs' as const) : ('vmfs' as const),
      capacityBytes: (ds.capacity as number) || 0, freeBytes: (ds.free_space as number) || 0,
      usedBytes: ((ds.capacity as number) || 0) - ((ds.free_space as number) || 0),
      accessible: ds.accessible !== false,
    }));
  } catch (error) {
    logger.error('❌ 获取 VMware 数据存储列表失败:', error);
    return [];
  }
}

export async function impl_getDatastore(adapter: VMwareAdapter, datastoreId: string): Promise<Datastore | null> {
  const datastores = await impl_listDatastores(adapter);
  return datastores.find((d) => d.id === datastoreId) || null;
}

// ==========================================================================
// 网络管理
// ==========================================================================

export async function impl_listNetworks(adapter: VMwareAdapter): Promise<VirtualNetwork[]> {
  if (!adapter.connState) await adapter.connect();
  try {
    const result = await adapter.apiRequest('GET', '/rest/vcenter/network');
    if (!result?.value || !Array.isArray(result.value)) return [];
    return result.value.map((net: Record<string, unknown>) => ({
      id: net.network, name: net.name, hypervisorType: 'vmware' as const, hypervisorId: adapter.platId,
      type: net.type === 'DISTRIBUTED_PORTGROUP' ? ('distributed' as const) : ('standard' as const),
    }));
  } catch (error) {
    logger.error('❌ 获取 VMware 网络列表失败:', error);
    return [];
  }
}

// ==========================================================================
// 资源池
// ==========================================================================

export async function impl_listResourcePools(adapter: VMwareAdapter): Promise<ResourcePool[]> {
  if (!adapter.connState) await adapter.connect();
  try {
    const result = await adapter.apiRequest('GET', '/rest/vcenter/resource-pool');
    if (!result?.value || !Array.isArray(result.value)) return [];
    return result.value.map((rp: Record<string, unknown>) => ({
      id: rp.resource_pool, name: rp.name, hypervisorType: 'vmware' as const, hypervisorId: adapter.platId,
    }));
  } catch (error) {
    logger.error('❌ 获取 VMware 资源池列表失败:', error);
    return [];
  }
}