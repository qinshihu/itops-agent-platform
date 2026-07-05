/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * 虚拟机管理 - 类型定义
 * =============================================================================
 */

// 虚拟化平台类型
export type HypervisorType = 'vmware' | 'kvm' | 'proxmox' | 'hyperv' | 'ovirt' | 'cloud';

// 虚拟机状态
export type VMStatus = 'running' | 'stopped' | 'paused' | 'suspended' | 'unknown';

// 虚拟机电源状态
export type VMPowerState = 'poweredOn' | 'poweredOff' | 'suspended' | 'unknown';

// 虚拟网络接口
export interface VMNetworkInterface {
  id: string;
  name: string;
  macAddress?: string;
  ipAddress?: string[];
  networkName?: string;
  portGroupName?: string;
  connected: boolean;
}

// 虚拟磁盘
export interface VMDisk {
  id: string;
  name: string;
  sizeGB: number;
  path?: string;
  type: 'thin' | 'thick';
  datastore?: string;
}

// 虚拟机配置
export interface VMConfig {
  name: string;
  description?: string;
  memoryMB: number;
  numCPUs: number;
  numCoresPerSocket?: number;
  guestId?: string;
  networkInterfaces: VMNetworkInterface[];
  disks: VMDisk[];
  bootOrder?: string[];
}

// 虚拟机信息
export interface VirtualMachine {
  id: string;
  name: string;
  hypervisorType: HypervisorType;
  hypervisorId: string;
  status: VMStatus;
  powerState: VMPowerState;
  guestOs?: string;
  memoryMB: number;
  numCPUs: number;
  numCoresPerSocket?: number;
  ipAddress?: string;
  hostName?: string;
  datacenter?: string;
  host?: string;
  resourcePool?: string;
  folderPath?: string;
  path?: string;
  disks: VMDisk[];
  networkInterfaces: VMNetworkInterface[];
  annotations?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

// 虚拟机状态信息
export interface VMStats {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  memoryUsageMB: number;
  memoryTotalMB: number;
  diskUsageBytes: number;
  diskTotalBytes: number;
  networkTxBytes: number;
  networkRxBytes: number;
  uptimeSeconds: number;
  snapshotCount?: number;
}

// 快照信息
export interface VMSnapshot {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  sizeBytes?: number;
  isCurrent: boolean;
  parentId?: string;
  childrenIds: string[];
}

// 模板信息
export interface VMTemplate {
  id: string;
  name: string;
  description?: string;
  hypervisorType: HypervisorType;
  guestOs?: string;
  memoryMB: number;
  numCPUs: number;
  disks: VMDisk[];
  networkInterfaces: VMNetworkInterface[];
  createdAt: string;
  tags?: string[];
}

// 主机信息
export interface HypervisorHost {
  id: string;
  name: string;
  hypervisorType: HypervisorType;
  status: 'connected' | 'disconnected' | 'maintenance';
  ipAddress: string;
  vendor?: string;
  model?: string;
  cpuModel?: string;
  numCpus: number;
  cpuMhz: number;
  memoryTotalMB: number;
  memoryUsageMB: number;
  datastores?: string[];
  networks?: string[];
  numVMs?: number;
  numRunningVMs?: number;
  version?: string;
}

// 数据存储信息
export interface Datastore {
  id: string;
  name: string;
  hypervisorType: HypervisorType;
  hypervisorId: string;
  type: 'vmfs' | 'nfs' | 'iscsi' | 'local' | 'other';
  capacityBytes: number;
  freeBytes: number;
  usedBytes: number;
  path?: string;
  host?: string;
  accessible: boolean;
}

// 网络信息
export interface VirtualNetwork {
  id: string;
  name: string;
  hypervisorType: HypervisorType;
  hypervisorId: string;
  type: 'standard' | 'distributed' | 'bridge' | 'ovs' | 'other';
  vlanId?: number;
  portGroup?: string;
  switchName?: string;
  numPorts?: number;
  numUsedPorts?: number;
}

// 资源池信息
export interface ResourcePool {
  id: string;
  name: string;
  hypervisorType: HypervisorType;
  hypervisorId: string;
  parentId?: string;
  cpuReservationMHz?: number;
  cpuLimitMHz?: number;
  cpuShares?: number;
  memoryReservationMB?: number;
  memoryLimitMB?: number;
  memoryShares?: number;
}

// 虚拟机平台配置（数据库存储）
export interface VMPlatformConfig {
  id: string;
  name: string;
  hypervisorType: HypervisorType;
  host: string;
  port?: number;
  username?: string;
  // 密码会加密存储
  encryptedPassword?: string;
  encryptedPasswordIV?: string;
  // 额外配置
  config?: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  lastConnected?: string;
  errorMessage?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// 创建VM请求
export interface CreateVMRequest {
  platformId: string;
  name: string;
  description?: string;
  templateId?: string;
  fromTemplate?: boolean;
  config: VMConfig;
  resourcePoolId?: string;
  folderPath?: string;
  datastoreId?: string;
  powerOn?: boolean;
  annotations?: Record<string, string>;
}

// 克隆VM请求
export interface CloneVMRequest {
  platformId: string;
  vmId: string;
  name: string;
  description?: string;
  snapshotId?: string;
  template?: boolean;
  powerOn?: boolean;
  resourcePoolId?: string;
  folderPath?: string;
  datastoreId?: string;
}

// 创建快照请求
export interface CreateSnapshotRequest {
  vmId: string;
  name: string;
  description?: string;
  includeMemory?: boolean;
  quiesce?: boolean;
}

// 恢复快照请求
export interface RestoreSnapshotRequest {
  vmId: string;
  snapshotId: string;
  suppressPowerOn?: boolean;
}

// 迁移VM请求
export interface MigrateVMRequest {
  vmId: string;
  targetHostId?: string;
  targetDatastoreId?: string;
  targetResourcePoolId?: string;
  priority?: 'defaultPriority' | 'highPriority' | 'lowPriority';
}

// 重新配置VM请求
export interface ReconfigureVMRequest {
  vmId: string;
  memoryMB?: number;
  numCPUs?: number;
  numCoresPerSocket?: number;
  networkInterfaces?: VMNetworkInterface[];
  disks?: VMDisk[];
  annotations?: Record<string, string>;
}
