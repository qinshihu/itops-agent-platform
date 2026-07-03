/**
 * =============================================================================
 * 虚拟机管理 - 基础适配器接口
 * =============================================================================
 */

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
  ReconfigureVMRequest} from '../../../../types/vmManagement';

export interface VMAdapter {
  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<boolean>;

  // 虚拟机管理
  listVMs(): Promise<VirtualMachine[]>;
  getVM(vmId: string): Promise<VirtualMachine | null>;
  createVM(request: CreateVMRequest): Promise<VirtualMachine>;
  cloneVM(request: CloneVMRequest): Promise<VirtualMachine>;
  deleteVM(vmId: string): Promise<void>;
  
  // 电源操作
  powerOnVM(vmId: string): Promise<void>;
  powerOffVM(vmId: string): Promise<void>;
  restartVM(vmId: string): Promise<void>;
  suspendVM(vmId: string): Promise<void>;
  pauseVM(vmId: string): Promise<void>;
  resumeVM(vmId: string): Promise<void>;

  // 快照管理
  listSnapshots(vmId: string): Promise<VMSnapshot[]>;
  createSnapshot(request: CreateSnapshotRequest): Promise<VMSnapshot>;
  restoreSnapshot(request: RestoreSnapshotRequest): Promise<void>;
  deleteSnapshot(snapshotId: string): Promise<void>;

  // 模板管理
  listTemplates(): Promise<VMTemplate[]>;
  createTemplate(vmId: string, name: string, description?: string): Promise<VMTemplate>;
  deleteTemplate(templateId: string): Promise<void>;

  // 监控
  getVMStats(vmId: string): Promise<VMStats>;
  
  // 重新配置
  reconfigureVM(request: ReconfigureVMRequest): Promise<VirtualMachine>;
  
  // 迁移
  migrateVM(request: MigrateVMRequest): Promise<void>;
  
  // 主机管理
  listHosts(): Promise<HypervisorHost[]>;
  getHost(hostId: string): Promise<HypervisorHost | null>;
  
  // 数据存储
  listDatastores(): Promise<Datastore[]>;
  getDatastore(datastoreId: string): Promise<Datastore | null>;
  
  // 网络管理
  listNetworks(): Promise<VirtualNetwork[]>;
  
  // 资源池
  listResourcePools(): Promise<ResourcePool[]>;
}

export abstract class BaseVMAdapter implements VMAdapter {
  protected connected = false;
  protected platformId: string;
  protected config: any;

  constructor(platformId: string, config: any) {
    this.platformId = platformId;
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  
  isConnected(): boolean {
    return this.connected;
  }
  
  abstract testConnection(): Promise<boolean>;

  abstract listVMs(): Promise<VirtualMachine[]>;
  abstract getVM(vmId: string): Promise<VirtualMachine | null>;
  abstract createVM(request: CreateVMRequest): Promise<VirtualMachine>;
  abstract cloneVM(request: CloneVMRequest): Promise<VirtualMachine>;
  abstract deleteVM(vmId: string): Promise<void>;
  
  abstract powerOnVM(vmId: string): Promise<void>;
  abstract powerOffVM(vmId: string): Promise<void>;
  abstract restartVM(vmId: string): Promise<void>;
  abstract suspendVM(vmId: string): Promise<void>;
  abstract pauseVM(vmId: string): Promise<void>;
  abstract resumeVM(vmId: string): Promise<void>;

  abstract listSnapshots(vmId: string): Promise<VMSnapshot[]>;
  abstract createSnapshot(request: CreateSnapshotRequest): Promise<VMSnapshot>;
  abstract restoreSnapshot(request: RestoreSnapshotRequest): Promise<void>;
  abstract deleteSnapshot(snapshotId: string): Promise<void>;

  abstract listTemplates(): Promise<VMTemplate[]>;
  abstract createTemplate(vmId: string, name: string, description?: string): Promise<VMTemplate>;
  abstract deleteTemplate(templateId: string): Promise<void>;

  abstract getVMStats(vmId: string): Promise<VMStats>;
  abstract reconfigureVM(request: ReconfigureVMRequest): Promise<VirtualMachine>;
  abstract migrateVM(request: MigrateVMRequest): Promise<void>;
  
  abstract listHosts(): Promise<HypervisorHost[]>;
  abstract getHost(hostId: string): Promise<HypervisorHost | null>;
  
  abstract listDatastores(): Promise<Datastore[]>;
  abstract getDatastore(datastoreId: string): Promise<Datastore | null>;
  
  abstract listNetworks(): Promise<VirtualNetwork[]>;
  abstract listResourcePools(): Promise<ResourcePool[]>;
}
