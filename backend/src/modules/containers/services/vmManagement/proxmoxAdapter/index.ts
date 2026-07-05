/**
 * =============================================================================
 * 虚拟机管理 - Proxmox VE 适配器
 * =============================================================================
 * 通过 Proxmox VE REST API 管理 QEMU/KVM 虚拟机
 * 认证方式：用户名密码 (Ticket) 或 API Token
 *
 * 组合模式：ProxmoxAdapter 是薄壳类，委托给：
 *   - ProxmoxApiClient (apiClient.ts): HTTPS 通信与认证
 *   - vmLifecycle/vmPower/vmSnapshot/infrastructureOps: 各操作类型
 *   - mappers.ts: 数据映射纯函数
 */

import { BaseVMAdapter } from '../vmAdapter';
import type {
  VirtualMachine,
  VMStats,
  VMSnapshot,
  VMTemplate,
  HypervisorHost,
  Datastore,
  VirtualNetwork,
  ResourcePool,
  CreateVMRequest,
  CloneVMRequest,
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
  MigrateVMRequest,
  ReconfigureVMRequest,
} from '../../../../../types/vmManagement';
import { ProxmoxApiClient } from './apiClient';
import type { ProxmoxConfig } from './apiClient';
import {
  listVMs,
  getVM,
  createVM,
  cloneVM,
  deleteVM,
} from './vmLifecycle';
import {
  powerOnVM,
  powerOffVM,
  restartVM,
  suspendVM,
  pauseVM,
  resumeVM,
} from './vmPower';
import {
  listSnapshots,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  listTemplates,
  createTemplate,
  deleteTemplate,
} from './vmSnapshot';
import {
  getVMStats,
  reconfigureVM,
  migrateVM,
  listHosts,
  getHost,
  listDatastores,
  getDatastore,
  listNetworks,
  listResourcePools,
} from './infrastructureOps';

export type { ProxmoxConfig } from './apiClient';

export class ProxmoxAdapter extends BaseVMAdapter {
  private client: ProxmoxApiClient;

  constructor(platformId: string, config: ProxmoxConfig) {
    super(platformId, config);
    this.client = new ProxmoxApiClient(platformId, config);
  }

  // 连接管理
  async connect(): Promise<void> {
    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.client.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }

  // 虚拟机管理
  async listVMs(): Promise<VirtualMachine[]> { return listVMs(this.client); }
  async getVM(vmId: string): Promise<VirtualMachine | null> { return getVM(this.client, vmId); }
  async createVM(request: CreateVMRequest): Promise<VirtualMachine> { return createVM(this.client, request); }
  async cloneVM(request: CloneVMRequest): Promise<VirtualMachine> { return cloneVM(this.client, request); }
  async deleteVM(vmId: string): Promise<void> { return deleteVM(this.client, vmId); }

  // 电源操作
  async powerOnVM(vmId: string): Promise<void> { return powerOnVM(this.client, vmId); }
  async powerOffVM(vmId: string): Promise<void> { return powerOffVM(this.client, vmId); }
  async restartVM(vmId: string): Promise<void> { return restartVM(this.client, vmId); }
  async suspendVM(vmId: string): Promise<void> { return suspendVM(this.client, vmId); }
  async pauseVM(vmId: string): Promise<void> { return pauseVM(this.client, vmId); }
  async resumeVM(vmId: string): Promise<void> { return resumeVM(this.client, vmId); }

  // 快照管理
  async listSnapshots(vmId: string): Promise<VMSnapshot[]> { return listSnapshots(this.client, vmId); }
  async createSnapshot(request: CreateSnapshotRequest): Promise<VMSnapshot> { return createSnapshot(this.client, request); }
  async restoreSnapshot(request: RestoreSnapshotRequest): Promise<void> { return restoreSnapshot(this.client, request); }
  async deleteSnapshot(snapshotId: string): Promise<void> { return deleteSnapshot(this.client, snapshotId); }

  // 模板管理
  async listTemplates(): Promise<VMTemplate[]> { return listTemplates(this.client); }
  async createTemplate(vmId: string, name: string, description?: string): Promise<VMTemplate> { return createTemplate(this.client, vmId, name, description); }
  async deleteTemplate(templateId: string): Promise<void> { return deleteTemplate(this.client, templateId); }

  // 监控
  async getVMStats(vmId: string): Promise<VMStats> { return getVMStats(this.client, vmId); }

  // 重新配置
  async reconfigureVM(request: ReconfigureVMRequest): Promise<VirtualMachine> { return reconfigureVM(this.client, request); }

  // 迁移
  async migrateVM(request: MigrateVMRequest): Promise<void> { return migrateVM(this.client, request); }

  // 主机管理
  async listHosts(): Promise<HypervisorHost[]> { return listHosts(this.client); }
  async getHost(hostId: string): Promise<HypervisorHost | null> { return getHost(this.client, hostId); }

  // 数据存储
  async listDatastores(): Promise<Datastore[]> { return listDatastores(this.client); }
  async getDatastore(datastoreId: string): Promise<Datastore | null> { return getDatastore(this.client, datastoreId); }

  // 网络管理
  async listNetworks(): Promise<VirtualNetwork[]> { return listNetworks(this.client); }

  // 资源池
  async listResourcePools(): Promise<ResourcePool[]> { return listResourcePools(this.client); }
}
