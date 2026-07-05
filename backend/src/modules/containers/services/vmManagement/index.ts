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

export class VMManagementService {
  private adapters: Map<string, VMAdapter> = new Map();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
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
    try {
      const rows = vmPlatformRepository.listByStatus('active');

      for (const row of rows) {
        try {
          const config = row.config ? JSON.parse(row.config) : {};
          
          // 解密密码
          let password = '';
          if (row.encrypted_password && row.encrypted_password_iv) {
            try {
              password = credentialService.decryptCredential(row.encrypted_password, row.encrypted_password_iv);
            } catch (_e) {
              logger.warn('⚠️ 无法解密平台密码');
            }
          }
          
          config.host = row.host;
          config.port = row.port;
          config.username = row.username;
          config.password = password;
          
          this.createAdapter(row.id, row.hypervisor_type as HypervisorType, config);
        } catch (e) {
          logger.error('❌ 加载平台配置失败:', e);
        }
      }
      
      logger.info('📋 已加载虚拟化平台');
    } catch (error) {
      logger.error('❌ 加载平台配置失败:', error);
    }
  }

  private createAdapter(platformId: string, type: HypervisorType, config: any): VMAdapter {
    let adapter: VMAdapter;
    
    switch (type) {
      case 'vmware':
        adapter = new VMwareAdapter(platformId, config);
        break;
      case 'kvm':
        adapter = new KVMAdapter(platformId, config);
        break;
      case 'proxmox':
        adapter = new ProxmoxAdapter(platformId, config);
        break;
      case 'hyperv':
      case 'ovirt':
      case 'cloud':
        throw new Error('暂不支持虚拟化平台类型');
      default:
        throw new Error('未知虚拟化平台类型');
    }
    
    this.adapters.set(platformId, adapter);
    return adapter;
  }

  private getAdapter(platformId: string): VMAdapter {
    const adapter = this.adapters.get(platformId);
    if (!adapter) {
      throw new Error('找不到虚拟化平台');
    }
    return adapter;
  }

  // ========== 平台配置管理 ==========
  
  async addPlatform(config: Omit<VMPlatformConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<VMPlatformConfig> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    let encryptedPassword = '';
    let encryptedPasswordIV = '';
    
    if (config.encryptedPassword) {
      const { encrypted, iv } = credentialService.encryptCredential(config.encryptedPassword);
      encryptedPassword = encrypted;
      encryptedPasswordIV = iv;
    }
    
    const platformConfig: VMPlatformConfig = {
      ...config,
      id,
      encryptedPassword,
      encryptedPasswordIV,
      createdAt: now,
      updatedAt: now
    };
    
    try {
      vmPlatformRepository.create({
        id,
        name: config.name,
        hypervisor_type: config.hypervisorType,
        host: config.host,
        port: config.port || null,
        username: config.username || null,
        encrypted_password: encryptedPassword || null,
        encrypted_password_iv: encryptedPasswordIV || null,
        config: config.config ? JSON.stringify(config.config) : null,
        status: config.status,
        tags: config.tags ? JSON.stringify(config.tags) : null,
      });

      // 创建适配器
      const adapterConfig = config.config || {};
      adapterConfig.host = config.host;
      adapterConfig.port = config.port;
      adapterConfig.username = config.username;
      if (config.encryptedPassword) {
        adapterConfig.password = config.encryptedPassword;
      }
      
      this.createAdapter(id, config.hypervisorType, adapterConfig);
      
      logger.info('✅ 添加虚拟化平台');
      return platformConfig;
    } catch (error) {
      logger.error('❌ 添加虚拟化平台失败:', error);
      throw error;
    }
  }

  async updatePlatform(platformId: string, updates: Partial<VMPlatformConfig>): Promise<VMPlatformConfig> {
    const existing = this.getPlatformConfig(platformId);
    if (!existing) {
      throw new Error('平台配置不存在');
    }
    
    let encryptedPassword = existing.encryptedPassword;
    let encryptedPasswordIV = existing.encryptedPasswordIV;
    
    if (updates.encryptedPassword !== undefined) {
      if (updates.encryptedPassword) {
        const { encrypted, iv } = credentialService.encryptCredential(updates.encryptedPassword);
        encryptedPassword = encrypted;
        encryptedPasswordIV = iv;
      } else {
        encryptedPassword = '';
        encryptedPasswordIV = '';
      }
    }
    
    const now = new Date().toISOString();
    
    try {
      const fields: Record<string, unknown> = {};
      if (updates.name !== undefined) fields.name = updates.name;
      if (updates.hypervisorType !== undefined) fields.hypervisor_type = updates.hypervisorType;
      if (updates.host !== undefined) fields.host = updates.host;
      if (updates.port !== undefined) fields.port = updates.port || null;
      if (updates.username !== undefined) fields.username = updates.username;
      if (updates.encryptedPassword !== undefined) {
        fields.encrypted_password = encryptedPassword || null;
        fields.encrypted_password_iv = encryptedPasswordIV || null;
      }
      if (updates.config !== undefined) fields.config = updates.config ? JSON.stringify(updates.config) : null;
      if (updates.status !== undefined) fields.status = updates.status;
      if (updates.tags !== undefined) fields.tags = updates.tags ? JSON.stringify(updates.tags) : null;
      vmPlatformRepository.update(platformId, fields);

      // 重新创建适配器
      if (this.adapters.has(platformId)) {
        this.adapters.delete(platformId);
      }
      
      const _updatedConfig = { ...existing, ...updates, updatedAt: now };
      
      const adapterConfig = updates.config || {};
      adapterConfig.host = updates.host || existing.host;
      adapterConfig.port = updates.port || existing.port;
      adapterConfig.username = updates.username !== undefined ? updates.username : existing.username;
      if (updates.encryptedPassword !== undefined) {
        adapterConfig.password = updates.encryptedPassword;
      } else if (existing.encryptedPassword) {
        adapterConfig.password = credentialService.decryptCredential(existing.encryptedPassword, existing.encryptedPasswordIV!);
      }
      
      this.createAdapter(platformId, updates.hypervisorType || existing.hypervisorType, adapterConfig);
      
      logger.info('✅ 更新虚拟化平台');
      return this.getPlatformConfig(platformId)!;
    } catch (error) {
      logger.error('❌ 更新虚拟化平台失败:', error);
      throw error;
    }
  }

  async deletePlatform(platformId: string): Promise<void> {
    try {
      // 断开连接
      const adapter = this.adapters.get(platformId);
      if (adapter) {
        if (adapter.isConnected()) {
          await adapter.disconnect();
        }
        this.adapters.delete(platformId);
      }
      
      vmPlatformRepository.delete(platformId);
      logger.info('🗑️ 删除虚拟化平台');
    } catch (error) {
      logger.error('❌ 删除虚拟化平台失败:', error);
      throw error;
    }
  }

  getPlatformConfig(platformId: string): VMPlatformConfig | null {
    try {
      const row = vmPlatformRepository.getById(platformId);
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        hypervisorType: row.hypervisor_type as HypervisorType,
        host: row.host,
        port: row.port ?? undefined,
        username: row.username ?? undefined,
        encryptedPassword: row.encrypted_password ?? undefined,
        encryptedPasswordIV: row.encrypted_password_iv ?? undefined,
        config: row.config ? JSON.parse(row.config) : undefined,
        status: row.status as VMPlatformConfig['status'],
        lastConnected: row.last_connected ?? undefined,
        errorMessage: row.error_message ?? undefined,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.error('❌ 获取平台配置失败:', error);
      return null;
    }
  }

  listPlatformConfigs(): VMPlatformConfig[] {
    try {
      const rows = vmPlatformRepository.list();
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        hypervisorType: row.hypervisor_type as HypervisorType,
        host: row.host,
        port: row.port ?? undefined,
        username: row.username ?? undefined,
        encryptedPassword: row.encrypted_password ?? undefined,
        encryptedPasswordIV: row.encrypted_password_iv ?? undefined,
        config: row.config ? JSON.parse(row.config) : undefined,
        status: row.status as VMPlatformConfig['status'],
        lastConnected: row.last_connected ?? undefined,
        errorMessage: row.error_message ?? undefined,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      logger.error('❌ 获取平台配置列表失败:', error);
      return [];
    }
  }

  async testPlatformConnection(platformId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const adapter = this.getAdapter(platformId);
      const success = await adapter.testConnection();

      if (success) {
        vmPlatformRepository.update(platformId, {
          status: 'active',
          last_connected: new Date().toISOString(),
          error_message: null,
        });
      } else {
        vmPlatformRepository.update(platformId, {
          status: 'error',
          error_message: '连接测试失败',
        });
      }

      return { success };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vmPlatformRepository.update(platformId, { status: 'error', error_message: message });
      return { success: false, message };
    }
  }

  // ========== 审计日志 ==========
  
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
    completedAt?: string
  ) {
    try {
      vmAuditLogRepository.create({
        id: randomUUID(),
        platform_id: platformId,
        vm_id: vmId,
        vm_name: vmName,
        operation,
        user_id: userId,
        username,
        parameters: parameters ? JSON.stringify(parameters) : null,
        result,
        status,
        error_message: errorMessage || null,
        started_at: startedAt || null,
        completed_at: completedAt || null,
      });
    } catch (error) {
      logger.error('❌ 记录审计日志失败:', error);
    }
  }

  getAuditLogs(platformId?: string, vmId?: string, limit = 100): Array<Record<string, unknown>> {
    try {
      const { rows } = vmAuditLogRepository.list({ platform_id: platformId, vm_id: vmId, page: 1, limit });
      return rows.map(row => ({
        id: row.id,
        platformId: row.platform_id,
        vmId: row.vm_id,
        vmName: row.vm_name,
        operation: row.operation,
        userId: row.user_id,
        username: row.username,
        parameters: row.parameters ? JSON.parse(row.parameters) : undefined,
        result: row.result,
        status: row.status,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        completedAt: row.completed_at
      }));
    } catch (error) {
      logger.error('❌ 获取审计日志失败:', error);
      return [];
    }
  }

  // ========== 虚拟机管理 - 委托给适配器 ==========
  
  async listVMs(platformId: string): Promise<VirtualMachine[]> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vms = await adapter.listVMs();
      
      this.logAudit(
        platformId, null, null, 'listVMs', null, null, null,
        '获取到虚拟机列表', 'success', undefined, startedAt, new Date().toISOString()
      );
      
      return vms;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, null, null, 'listVMs', null, null, null,
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async getVM(platformId: string, vmId: string): Promise<VirtualMachine | null> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.getVM(vmId);
      
      this.logAudit(
        platformId, vmId, vm?.name || null, 'getVM', null, null, null,
        '获取虚拟机详情', 'success', undefined, startedAt, new Date().toISOString()
      );
      
      return vm;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, vmId, null, 'getVM', null, null, null,
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async createVM(platformId: string, request: CreateVMRequest, userId?: string, username?: string): Promise<VirtualMachine> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.createVM(request);
      
      this.logAudit(
        platformId, vm.id, vm.name, 'createVM', userId || null, username || null,
        { name: request.name },
        '创建虚拟机成功', 'success', undefined, startedAt, new Date().toISOString()
      );
      
      return vm;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, null, request.name, 'createVM', userId || null, username || null,
        { name: request.name },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async cloneVM(platformId: string, request: CloneVMRequest, userId?: string, username?: string): Promise<VirtualMachine> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.cloneVM(request);
      
      this.logAudit(
        platformId, vm.id, vm.name, 'cloneVM', userId || null, username || null,
        { sourceVmId: request.vmId, name: request.name },
        '克隆虚拟机成功', 'success', undefined, startedAt, new Date().toISOString()
      );
      
      return vm;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, request.vmId, null, 'cloneVM', userId || null, username || null,
        { sourceVmId: request.vmId, name: request.name },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async deleteVM(platformId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.getVM(vmId);
      
      await adapter.deleteVM(vmId);
      
      this.logAudit(
        platformId, vmId, vm?.name || null, 'deleteVM', userId || null, username || null,
        { vmId },
        '删除虚拟机成功', 'success', undefined, startedAt, new Date().toISOString()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, vmId, null, 'deleteVM', userId || null, username || null,
        { vmId },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async powerOnVM(platformId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.getVM(vmId);
      
      await adapter.powerOnVM(vmId);
      
      this.logAudit(
        platformId, vmId, vm?.name || null, 'powerOnVM', userId || null, username || null,
        { vmId },
        '启动虚拟机成功', 'success', undefined, startedAt, new Date().toISOString()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, vmId, null, 'powerOnVM', userId || null, username || null,
        { vmId },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async powerOffVM(platformId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.getVM(vmId);
      
      await adapter.powerOffVM(vmId);
      
      this.logAudit(
        platformId, vmId, vm?.name || null, 'powerOffVM', userId || null, username || null,
        { vmId },
        '关闭虚拟机成功', 'success', undefined, startedAt, new Date().toISOString()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, vmId, null, 'powerOffVM', userId || null, username || null,
        { vmId },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async restartVM(platformId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.getVM(vmId);
      
      await adapter.restartVM(vmId);
      
      this.logAudit(
        platformId, vmId, vm?.name || null, 'restartVM', userId || null, username || null,
        { vmId },
        '重启虚拟机成功', 'success', undefined, startedAt, new Date().toISOString()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, vmId, null, 'restartVM', userId || null, username || null,
        { vmId },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async listSnapshots(platformId: string, vmId: string): Promise<VMSnapshot[]> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const snapshots = await adapter.listSnapshots(vmId);
      
      this.logAudit(
        platformId, vmId, null, 'listSnapshots', null, null,
        { vmId },
        '获取到快照列表', 'success', undefined, startedAt, new Date().toISOString()
      );
      
      return snapshots;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, vmId, null, 'listSnapshots', null, null,
        { vmId },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async createSnapshot(platformId: string, request: CreateSnapshotRequest, userId?: string, username?: string): Promise<VMSnapshot> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.getVM(request.vmId);
      
      const snapshot = await adapter.createSnapshot(request);
      
      this.logAudit(
        platformId, request.vmId, vm?.name || null, 'createSnapshot', userId || null, username || null,
        { vmId: request.vmId, name: request.name },
        '创建快照成功', 'success', undefined, startedAt, new Date().toISOString()
      );
      
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, request.vmId, null, 'createSnapshot', userId || null, username || null,
        { vmId: request.vmId, name: request.name },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async restoreSnapshot(platformId: string, request: RestoreSnapshotRequest, userId?: string, username?: string): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const vm = await adapter.getVM(request.vmId);
      
      await adapter.restoreSnapshot(request);
      
      this.logAudit(
        platformId, request.vmId, vm?.name || null, 'restoreSnapshot', userId || null, username || null,
        { vmId: request.vmId, snapshotId: request.snapshotId },
        '恢复快照成功', 'success', undefined, startedAt, new Date().toISOString()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, request.vmId, null, 'restoreSnapshot', userId || null, username || null,
        { vmId: request.vmId, snapshotId: request.snapshotId },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async deleteSnapshot(platformId: string, snapshotId: string, vmId: string, userId?: string, username?: string): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      
      await adapter.deleteSnapshot(snapshotId);
      
      this.logAudit(
        platformId, vmId, null, 'deleteSnapshot', userId || null, username || null,
        { snapshotId },
        '删除快照成功', 'success', undefined, startedAt, new Date().toISOString()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, vmId, null, 'deleteSnapshot', userId || null, username || null,
        { snapshotId },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async createTemplate(platformId: string, vmId: string, name: string, description?: string, userId?: string, username?: string): Promise<VMTemplate> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      const template = await adapter.createTemplate(vmId, name, description);
      
      this.logAudit(
        platformId, vmId, name, 'createTemplate', userId || null, username || null,
        { vmId, name },
        '创建模板成功', 'success', undefined, startedAt, new Date().toISOString()
      );
      
      return template;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, vmId, null, 'createTemplate', userId || null, username || null,
        { vmId, name },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async deleteTemplate(platformId: string, templateId: string, userId?: string, username?: string): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const adapter = this.getAdapter(platformId);
      
      await adapter.deleteTemplate(templateId);
      
      this.logAudit(
        platformId, null, null, 'deleteTemplate', userId || null, username || null,
        { templateId },
        '删除模板成功', 'success', undefined, startedAt, new Date().toISOString()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAudit(
        platformId, null, null, 'deleteTemplate', userId || null, username || null,
        { templateId },
        '', 'failed', message, startedAt, new Date().toISOString()
      );
      throw error;
    }
  }

  async getVMStats(platformId: string, vmId: string): Promise<VMStats> {
    const adapter = this.getAdapter(platformId);
    return adapter.getVMStats(vmId);
  }

  async listHosts(platformId: string): Promise<HypervisorHost[]> {
    const adapter = this.getAdapter(platformId);
    return adapter.listHosts();
  }

  async listDatastores(platformId: string): Promise<Datastore[]> {
    const adapter = this.getAdapter(platformId);
    return adapter.listDatastores();
  }

  async listNetworks(platformId: string): Promise<VirtualNetwork[]> {
    const adapter = this.getAdapter(platformId);
    return adapter.listNetworks();
  }

  async listTemplates(platformId: string): Promise<VMTemplate[]> {
    const adapter = this.getAdapter(platformId);
    return adapter.listTemplates();
  }
}

export const vmManagementService = new VMManagementService();
