/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * 虚拟机管理 - VMware vSphere REST API 适配器（核心类）
 * =============================================================================
 * 通过 vSphere REST API (非 SOAP) 管理 ESXi / vCenter 虚拟机
 * 认证: POST /rest/com/vmware/cis/session 获取 session-id
 *
 * 方法实现分散在子文件中，通过 barrel export 统一导出。
 */

import https from 'https';
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
import { logger } from '../../../../../utils/logger';

// 从子文件导入方法实现
import {
  impl_listVMs,
  impl_getVM,
  impl_createVM,
  impl_cloneVM,
  impl_deleteVM,
  impl_powerOnVM,
  impl_powerOffVM,
  impl_restartVM,
  impl_suspendVM,
  impl_pauseVM,
  impl_resumeVM,
} from './vmCrud';

import {
  impl_listSnapshots,
  impl_createSnapshot,
  impl_restoreSnapshot,
  impl_deleteSnapshot,
  impl_listTemplates,
  impl_createTemplate,
  impl_deleteTemplate,
} from './vmSnapshot';

import {
  impl_reconfigureVM,
  impl_migrateVM,
} from './vmMigration';

import {
  impl_getVMStats,
  impl_listHosts,
  impl_getHost,
  impl_listDatastores,
  impl_getDatastore,
  impl_listNetworks,
  impl_listResourcePools,
} from './vmMonitoring';

export class VMwareAdapter extends BaseVMAdapter {
  host: string;
  port: number;
  username: string;
  password: string;
  sessionId?: string;
  baseUrl: string;
  httpsAgent: https.Agent;

  constructor(platformId: string, config: any) {
    super(platformId, config);
    this.host = config.host || config.baseUrl || '';
    this.port = config.port || 443;
    this.username = config.username || '';
    this.password = config.password || '';

    // baseUrl：兼容历史字段 baseUrl / host
    this.baseUrl = this.host.startsWith('https://')
      ? this.host
      : `https://${this.host}:${this.port}`;

    // 校验证书：默认 true（生产安全）
    //   关闭方式：平台 config 中设置 verifyTls: false（仅自签证书场景）
    //   历史行为是 rejectUnauthorized: false（不安全），改为默认开启
    const verifyTls = config.verifyTls !== false;
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: verifyTls,
      keepAlive: true,
    });
  }

  // ==========================================================================
  // 公开访问器（供子模块文件使用，绕过 protected 限制）
  // ==========================================================================

  /** 连接状态 */
  get connState(): boolean { return this.connected; }
  set connState(v: boolean) { this.connected = v; }

  /** 平台ID */
  get platId(): string { return this.platformId; }

  // ==========================================================================
  // 连接管理
  // ==========================================================================

  async connect(): Promise<void> {
    try {
      logger.info(`🔌 正在连接 VMware vSphere: ${this.baseUrl}`);

      if (!this.username || !this.password) {
        throw new Error('VMware vSphere 用户名/密码未配置');
      }

      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      const result = await this.apiRequest(
        'POST',
        '/rest/com/vmware/cis/session',
        null,
        { Authorization: `Basic ${auth}` }
      );

      if (result?.value) {
        this.sessionId = result.value;
        this.connected = true;
        logger.info(`✅ VMware vSphere 会话已建立 (${this.host})`);
      } else {
        throw new Error('获取 vSphere session-id 失败');
      }
    } catch (error) {
      logger.error('❌ VMware vSphere 连接失败:', error);
      this.connected = false;
      this.sessionId = undefined;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.apiRequest('DELETE', '/rest/com/vmware/cis/session');
      } catch {
        // 忽略
      }
    }
    this.connected = false;
    this.sessionId = undefined;
    logger.info('🔌 VMware vSphere 已断开连接');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.apiRequest('GET', '/rest/vcenter/vm');
      return true;
    } catch {
      return false;
    } finally {
      await this.disconnect();
    }
  }

  // ==========================================================================
  // HTTPS 请求（包内可见，子文件调用）
  // ==========================================================================

  apiRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    body?: Record<string, any> | null,
    extraHeaders?: Record<string, string>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(`${this.baseUrl}${path}`);
      const isBody = body && method !== 'GET';
      const bodyStr = isBody ? JSON.stringify(body) : undefined;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (this.sessionId) {
        headers['vmware-api-session-id'] = this.sessionId;
      }

      if (extraHeaders) {
        Object.assign(headers, extraHeaders);
      }

      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
        agent: this.httpsAgent,
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            if (res.statusCode === 204 || data.length === 0) {
              resolve(null); return;
            }
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.value?.messages?.[0]?.default_message || `HTTP ${res.statusCode}`));
            }
          } catch {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
            }
          }
        });
      });

      req.on('error', (err) => reject(new Error(`VMware API 请求失败: ${err.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('VMware API 请求超时 (30s)')); });
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  // ==========================================================================
  // 虚拟机管理（委托给 vmCrud.ts）
  // ==========================================================================

  async listVMs(): Promise<VirtualMachine[]> {
    return impl_listVMs(this);
  }

  async getVM(vmId: string): Promise<VirtualMachine | null> {
    return impl_getVM(this, vmId);
  }

  async createVM(request: CreateVMRequest): Promise<VirtualMachine> {
    return impl_createVM(this, request);
  }

  async cloneVM(request: CloneVMRequest): Promise<VirtualMachine> {
    return impl_cloneVM(this, request);
  }

  async deleteVM(vmId: string): Promise<void> {
    return impl_deleteVM(this, vmId);
  }

  // ==========================================================================
  // 电源操作（委托给 vmCrud.ts）
  // ==========================================================================

  async powerOnVM(vmId: string): Promise<void> {
    return impl_powerOnVM(this, vmId);
  }

  async powerOffVM(vmId: string): Promise<void> {
    return impl_powerOffVM(this, vmId);
  }

  async restartVM(vmId: string): Promise<void> {
    return impl_restartVM(this, vmId);
  }

  async suspendVM(vmId: string): Promise<void> {
    return impl_suspendVM(this, vmId);
  }

  async pauseVM(vmId: string): Promise<void> {
    return impl_pauseVM(this, vmId);
  }

  async resumeVM(vmId: string): Promise<void> {
    return impl_resumeVM(this, vmId);
  }

  // ==========================================================================
  // 快照管理（委托给 vmSnapshot.ts）
  // ==========================================================================

  async listSnapshots(vmId: string): Promise<VMSnapshot[]> {
    return impl_listSnapshots(this, vmId);
  }

  async createSnapshot(request: CreateSnapshotRequest): Promise<VMSnapshot> {
    return impl_createSnapshot(this, request);
  }

  async restoreSnapshot(request: RestoreSnapshotRequest): Promise<void> {
    return impl_restoreSnapshot(this, request);
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    return impl_deleteSnapshot(this, snapshotId);
  }

  // ==========================================================================
  // 模板管理（委托给 vmSnapshot.ts）
  // ==========================================================================

  async listTemplates(): Promise<VMTemplate[]> {
    return impl_listTemplates(this);
  }

  async createTemplate(vmId: string, name: string, description?: string): Promise<VMTemplate> {
    return impl_createTemplate(this, vmId, name, description);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return impl_deleteTemplate(this, templateId);
  }

  // ==========================================================================
  // 监控统计（委托给 vmMonitoring.ts）
  // ==========================================================================

  async getVMStats(vmId: string): Promise<VMStats> {
    return impl_getVMStats(this, vmId);
  }

  // ==========================================================================
  // 配置与迁移（委托给 vmMigration.ts）
  // ==========================================================================

  async reconfigureVM(request: ReconfigureVMRequest): Promise<VirtualMachine> {
    return impl_reconfigureVM(this, request);
  }

  async migrateVM(request: MigrateVMRequest): Promise<void> {
    return impl_migrateVM(this, request);
  }

  // ==========================================================================
  // 主机管理（委托给 vmMonitoring.ts）
  // ==========================================================================

  async listHosts(): Promise<HypervisorHost[]> {
    return impl_listHosts(this);
  }

  async getHost(hostId: string): Promise<HypervisorHost | null> {
    return impl_getHost(this, hostId);
  }

  // ==========================================================================
  // 数据存储（委托给 vmMonitoring.ts）
  // ==========================================================================

  async listDatastores(): Promise<Datastore[]> {
    return impl_listDatastores(this);
  }

  async getDatastore(datastoreId: string): Promise<Datastore | null> {
    return impl_getDatastore(this, datastoreId);
  }

  // ==========================================================================
  // 网络管理（委托给 vmMonitoring.ts）
  // ==========================================================================

  async listNetworks(): Promise<VirtualNetwork[]> {
    return impl_listNetworks(this);
  }

  // ==========================================================================
  // 资源池（委托给 vmMonitoring.ts）
  // ==========================================================================

  async listResourcePools(): Promise<ResourcePool[]> {
    return impl_listResourcePools(this);
  }

  // ==========================================================================
  // 辅助映射（包内可见，子文件调用）
  // ==========================================================================

  mapVM(vmId: string, vm: any): VirtualMachine {
    const ps = vm.power_state;
    let powerState: 'poweredOn' | 'poweredOff' | 'suspended' | 'unknown' = 'unknown';
    let status: 'running' | 'stopped' | 'paused' | 'suspended' | 'unknown' = 'unknown';
    switch (ps) {
      case 'POWERED_ON': powerState = 'poweredOn'; status = 'running'; break;
      case 'POWERED_OFF': powerState = 'poweredOff'; status = 'stopped'; break;
      case 'SUSPENDED': powerState = 'suspended'; status = 'suspended'; break;
    }
    return {
      id: vmId, name: vm.name || `vm-${vmId}`,
      hypervisorType: 'vmware', hypervisorId: this.platformId,
      status, powerState, guestOs: vm.guest_OS || undefined,
      memoryMB: vm.memory?.size_MiB || 0, numCPUs: vm.cpu?.count || 0,
      disks: [], networkInterfaces: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }
}