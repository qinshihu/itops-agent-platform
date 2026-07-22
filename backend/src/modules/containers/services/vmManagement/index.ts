/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * 虚拟机管理 - 统一管理服务
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import { vmPlatformRepository, vmAuditLogRepository } from '../../../../repositories';
import type {
  VirtualMachine,
  VMStats,
  VMSnapshot,
  VMTemplate,
  HypervisorHost,
  Datastore,
  VirtualNetwork,
  VMPlatformConfig,
  CreateVMRequest,
  CloneVMRequest,
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
  HypervisorType} from '../../../../types/vmManagement';
import type { VMAdapter } from './vmAdapter';
import { VMwareAdapter } from './vmwareAdapter';
import { KVMAdapter } from './kvmAdapter';
import { ProxmoxAdapter } from './proxmoxAdapter';
import { credentialService } from '../../../auth/services/credentialService';
import {
  loadPlatformConfigs as lifecycleLoadPlatformConfigs,
  createAdapter as lifecycleCreateAdapter,
  getAdapter as lifecycleGetAdapter,
} from './vmManagementService/lifecycle';
import {
  addPlatform as platformAddPlatform,
  updatePlatform as platformUpdatePlatform,
  deletePlatform as platformDeletePlatform,
  getPlatformConfig as platformGetPlatformConfig,
  listPlatformConfigs as platformListPlatformConfigs,
  testPlatformConnection as platformTestPlatformConnection,
} from './vmManagementService/platformOps';
import {
  logAudit as auditLogAudit,
  getAuditLogs as auditGetAuditLogs,
} from './vmManagementService/auditOps';
import {
  listVMs as vmListVMs,
  getVM as vmGetVM,
  createVM as vmCreateVM,
  cloneVM as vmCloneVM,
  deleteVM as vmDeleteVM,
  listTemplates as vmListTemplates,
  deleteTemplate as vmDeleteTemplate,
  createTemplate as vmCreateTemplate,
} from './vmManagementService/vmOps';
import {
  powerOnVM as powerOpsOn,
  powerOffVM as powerOpsOff,
  restartVM as powerOpsRestart,
} from './vmManagementService/powerOps';
import {
  listSnapshots as snapOpsList,
  createSnapshot as snapOpsCreate,
  restoreSnapshot as snapOpsRestore,
  deleteSnapshot as snapOpsDelete,
  migrateVM as snapOpsMigrate,
} from './vmManagementService/snapshotOps';
import {
  getVMStats as infraGetVMStats,
  listHosts as infraListHosts,
  listDatastores as infraListDatastores,
  listNetworks as infraListNetworks,
} from './vmManagementService/infraOps';

export class VMManagementService {
  private adapters: Map<string, VMAdapter> = new Map();
  private initialized = false;

  /**
   * 初始化服务：从数据库加载平台配置并创建适配器
   *
   * 注意：必须在数据库初始化完成后调用（由 serviceRegistry 在 db ready 后触发）。
   * 历史问题：构造函数中立即调用 init() 会因 db Proxy 未初始化而抛出
   * "Database not initialized" 错误（模块加载时序早于 initializeDatabase）。
   */
  init() {
    if (this.initialized) return;

    try {
      // 初始化数据库表
      // 注意：实际项目中应在应用启动时调用initializeVMManagementTables

      // 从数据库加载平台配置并创建适配器
      this.loadPlatformConfigs();

      this.initialized = true;
      logger.info('✅ VM管理服务初始化完成');
    } catch (error) {
      logger.error('❌ VM管理服务初始化失败:', error);
    }
  }

  private loadPlatformConfigs() {
    // 委托给 lifecycle 模块（2026-07-21 拆分）
    lifecycleLoadPlatformConfigs({ adapters: this.adapters });
  }

  private createAdapter(platformId: string, type: HypervisorType, config: any): VMAdapter {
    // 委托给 lifecycle 模块（2026-07-21 拆分）
    return lifecycleCreateAdapter({ adapters: this.adapters }, platformId, type, config);
  }

  private getAdapter(platformId: string): VMAdapter {
    // 委托给 lifecycle 模块（2026-07-21 拆分）
    return lifecycleGetAdapter({ adapters: this.adapters }, platformId);
  }

  // ========== 平台配置管理 ==========
  // 2026-07-21 拆分：以下 6 个方法委托给 vmManagementService/platformOps 模块
  // 主类保留方法签名（外部调用零改动），实现下沉到子模块

  async addPlatform(config: Omit<VMPlatformConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<VMPlatformConfig> {
    return platformAddPlatform({ adapters: this.adapters }, config);
  }

  async updatePlatform(platformId: string, updates: Partial<VMPlatformConfig>): Promise<VMPlatformConfig> {
    return platformUpdatePlatform({ adapters: this.adapters }, platformId, updates);
  }

  async deletePlatform(platformId: string): Promise<void> {
    return platformDeletePlatform({ adapters: this.adapters }, platformId);
  }

  getPlatformConfig(platformId: string): VMPlatformConfig | null {
    return platformGetPlatformConfig(platformId);
  }

  listPlatformConfigs(): VMPlatformConfig[] {
    return platformListPlatformConfigs();
  }

  async testPlatformConnection(platformId: string): Promise<{ success: boolean; message?: string }> {
    return platformTestPlatformConnection({ adapters: this.adapters }, platformId);
  }

  // ========== 审计日志 ==========
  // 2026-07-21 拆分：logAudit + getAuditLogs 委托给 vmManagementService/auditOps 模块

  private logAudit(
    platformId: string,
    vmId: string | null,
    vmName: string | null,
    operation: string,
    userId: string | null,
    username: string | null,
    parameters: Record<string, unknown> | null,
    result: string,
    status: 'success' | 'failed',
    errorMessage?: string,
    startedAt?: string,
    completedAt?: string,
  ): void {
    return auditLogAudit(
      platformId, vmId, vmName, operation, userId, username,
      parameters, result, status, errorMessage, startedAt, completedAt,
    );
  }

  getAuditLogs(platformId?: string, vmId?: string, limit = 100): Array<Record<string, unknown>> {
    return auditGetAuditLogs(platformId, vmId, limit);
  }

  // ========== 虚拟机管理 - 委托给适配器 ==========
  // 2026-07-21 拆分：以下 5 个 VM CRUD 方法委托给 vmManagementService/vmOps 模块

  async listVMs(platformId: string): Promise<VirtualMachine[]> {
    return vmListVMs({ adapters: this.adapters }, platformId);
  }

  async getVM(platformId: string, vmId: string): Promise<VirtualMachine | null> {
    return vmGetVM({ adapters: this.adapters }, platformId, vmId);
  }

  async createVM(platformId: string, request: CreateVMRequest, userId?: string, username?: string): Promise<VirtualMachine> {
    return vmCreateVM({ adapters: this.adapters }, platformId, request, userId, username);
  }

  async cloneVM(platformId: string, request: CloneVMRequest, userId?: string, username?: string): Promise<VirtualMachine> {
    return vmCloneVM({ adapters: this.adapters }, platformId, request, userId, username);
  }

  async deleteVM(platformId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    return vmDeleteVM({ adapters: this.adapters }, platformId, vmId, userId, username);
  }

  async powerOnVM(platformId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    return powerOpsOn({ adapters: this.adapters }, platformId, vmId, userId, username);
  }

  async powerOffVM(platformId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    return powerOpsOff({ adapters: this.adapters }, platformId, vmId, userId, username);
  }

  async restartVM(platformId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    return powerOpsRestart({ adapters: this.adapters }, platformId, vmId, userId, username);
  }

  /**
   * 迁移虚拟机（真实调用 hypervisor API）
   */
  async migrateVM(platformId: string, request: { vmId: string; targetHostId?: string; targetDatastoreId?: string; priority?: 'defaultPriority' | 'highPriority' | 'lowPriority' }, userId?: string, username?: string): Promise<void> {
    return snapOpsMigrate({ adapters: this.adapters }, platformId, request, userId, username);
  }

  async listSnapshots(platformId: string, vmId: string): Promise<VMSnapshot[]> {
    return snapOpsList({ adapters: this.adapters }, platformId, vmId);
  }

  async createSnapshot(platformId: string, request: CreateSnapshotRequest, userId?: string, username?: string): Promise<VMSnapshot> {
    return snapOpsCreate({ adapters: this.adapters }, platformId, request, userId, username);
  }

  async restoreSnapshot(platformId: string, request: RestoreSnapshotRequest, userId?: string, username?: string): Promise<void> {
    return snapOpsRestore({ adapters: this.adapters }, platformId, request, userId, username);
  }

  async deleteSnapshot(platformId: string, snapshotId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    return snapOpsDelete({ adapters: this.adapters }, platformId, snapshotId, vmId, userId, username);
  }

  // ========== VM 模板 + 基础设施查询 - 委托给 vmManagementService 拆分模块 ==========
  // 2026-07-21 拆分：template 操作委托给 vmOps；listHosts/Datastores/Networks/getVMStats 委托给 infraOps

  async createTemplate(platformId: string, vmId: string, name: string, description?: string, userId?: string, username?: string): Promise<VMTemplate> {
    return vmCreateTemplate({ adapters: this.adapters }, platformId, vmId, name, description, userId, username);
  }

  async deleteTemplate(platformId: string, templateId: string, userId?: string, username?: string): Promise<void> {
    return vmDeleteTemplate({ adapters: this.adapters }, platformId, templateId, userId, username);
  }

  async listTemplates(platformId: string): Promise<VMTemplate[]> {
    return vmListTemplates({ adapters: this.adapters }, platformId);
  }

  async getVMStats(platformId: string, vmId: string): Promise<VMStats> {
    return infraGetVMStats({ adapters: this.adapters }, platformId, vmId);
  }

  async listHosts(platformId: string): Promise<HypervisorHost[]> {
    return infraListHosts({ adapters: this.adapters }, platformId);
  }

  async listDatastores(platformId: string): Promise<Datastore[]> {
    return infraListDatastores({ adapters: this.adapters }, platformId);
  }

  async listNetworks(platformId: string): Promise<VirtualNetwork[]> {
    return infraListNetworks({ adapters: this.adapters }, platformId);
  }
}

export const vmManagementService = new VMManagementService();
