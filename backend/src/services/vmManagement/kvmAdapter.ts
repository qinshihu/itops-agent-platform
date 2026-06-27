/**
 * =============================================================================
 * 虚拟机管理 - KVM/libvirt SSH 适配器
 * =============================================================================
 * 通过 SSH 远程执行 virsh 命令管理 KVM/QEMU 虚拟机
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseVMAdapter } from './vmAdapter';
import {
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
} from '../../types/vmManagement';
import { logger } from '../../utils/logger';

const execAsync = promisify(exec);

export class KVMAdapter extends BaseVMAdapter {
  private host: string;
  private port: number;
  private username: string;
  private password?: string;
  private privateKey?: string;
  private sshCommand: string;

  constructor(platformId: string, config: any) {
    super(platformId, config);
    this.host = config.host || '';
    this.port = config.port || 22;
    this.username = config.username || 'root';
    this.password = config.password;
    this.privateKey = config.privateKey || config.private_key;

    // 构建基础 SSH 命令
    this.sshCommand = this.buildSSHCommand();
  }

  private buildSSHCommand(): string {
    const args: string[] = [
      'ssh',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', `ConnectTimeout=10`,
      '-p', String(this.port),
    ];

    if (this.password) {
      // 使用 sshpass 传递密码
      args.unshift('sshpass', '-p', `"${this.password}"`);
    } else if (this.privateKey) {
      args.push('-i', `"${this.privateKey}"`);
    }

    args.push(`"${this.username}@${this.host}"`);

    return args.join(' ');
  }

  // ==========================================================================
  // 连接管理
  // ==========================================================================

  async connect(): Promise<void> {
    try {
      logger.info(`🔌 正在连接 KVM/libvirt 主机: ${this.host}`);

      if (!this.host) {
        throw new Error('KVM 主机地址未配置');
      }

      // 先测试 SSH 连接
      const { stdout } = await this.execSSH('virsh version');
      logger.info(`✅ KVM/libvirt 连接成功 (${this.host}), 版本: ${stdout.trim()}`);
      this.connected = true;
    } catch (error) {
      logger.error('❌ KVM/libvirt 连接失败:', error);
      this.connected = false;
      throw new Error(error instanceof Error ? error.message : 'KVM SSH 连接失败');
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.info('🔌 KVM/libvirt 已断开连接');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    } finally {
      await this.disconnect();
    }
  }

  // ==========================================================================
  // SSH 命令执行
  // ==========================================================================

  private async execSSH(command: string): Promise<{ stdout: string; stderr: string }> {
    const fullCommand = `${this.sshCommand} "${command.replace(/"/g, '\\"')}"`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error) {
      if (error && typeof error === 'object') {
        const err = error as any;
        if (err.killed) {
          throw new Error('SSH 命令执行超时 (30s)');
        }
        // virsh 某些命令会输出到 stderr，即使成功
        if (err.stdout) {
          return { stdout: err.stdout.trim(), stderr: (err.stderr || '').trim() };
        }
        throw new Error(`SSH 命令失败: ${err.stderr || err.message || 'Unknown'}`);
      }
      throw error;
    }
  }

  private parseVirshList(output: string): Array<{ id: string; name: string; state: string }> {
    const lines = output.split('\n');
    const results: Array<{ id: string; name: string; state: string }> = [];

    // virsh list --all 输出格式:
    //  Id   Name              State
    // --------------------------------
    //  1    vm-name           running
    //  -    vm-name2          shut off

    let headerFound = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('Id') || trimmed.startsWith('---')) {
        headerFound = true;
        continue;
      }
      if (!headerFound) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        const id = parts[0];
        const state = parts.slice(2).join('_').toLowerCase().replace(/\s+/g, '_');
        results.push({
          id: id === '-' ? parts[1] : id,
          name: id === '-' ? parts[1] : parts[1],
          state,
        });
      }
    }
    return results;
  }

  private parseStats(output: string): { cpuPercent: number; memKB: number; diskAllocKB: number; diskUsedKB: number; netRxBytes: number; netTxBytes: number } {
    const result = {
      cpuPercent: 0, memKB: 0, diskAllocKB: 0, diskUsedKB: 0, netRxBytes: 0, netTxBytes: 0,
    };

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex);
      const value = trimmed.substring(eqIndex + 1);

      switch (key) {
        case 'cpu.time':
          // cpu.time 是累加值 (ns)，不做百分比计算
          break;
        case 'balloon.current':
          result.memKB = parseInt(value) || 0;
          break;
        case 'balloon.maximum':
          break;
        case 'block.0.allocation':
          result.diskAllocKB = parseInt(value) || 0;
          break;
        case 'block.0.capacity':
          break;
        case 'net.0.rx.bytes':
          result.netRxBytes = parseInt(value) || 0;
          break;
        case 'net.0.tx.bytes':
          result.netTxBytes = parseInt(value) || 0;
          break;
      }
    }

    return result;
  }

  // ==========================================================================
  // 虚拟机管理
  // ==========================================================================

  async listVMs(): Promise<VirtualMachine[]> {
    if (!this.connected) await this.connect();
    logger.info('📋 获取 KVM 虚拟机列表');

    try {
      const { stdout } = await this.execSSH('virsh list --all');
      const vms = this.parseVirshList(stdout);

      const result: VirtualMachine[] = [];
      for (const vm of vms) {
        try {
          const detail = await this.getVMDetail(vm.name);
          result.push({
            id: vm.name,
            name: vm.name,
            hypervisorType: 'kvm',
            hypervisorId: this.platformId,
            status: this.mapVirshStatus(vm.state),
            powerState: this.mapVirshPowerState(vm.state),
            memoryMB: detail.maxMem ? Math.round(detail.maxMem / 1024) : 0,
            numCPUs: detail.vcpus || 0,
            disks: [],
            networkInterfaces: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch {
          result.push({
            id: vm.name,
            name: vm.name,
            hypervisorType: 'kvm',
            hypervisorId: this.platformId,
            status: this.mapVirshStatus(vm.state),
            powerState: this.mapVirshPowerState(vm.state),
            memoryMB: 0,
            numCPUs: 0,
            disks: [],
            networkInterfaces: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return result;
    } catch (error) {
      logger.error('❌ 获取 KVM 虚拟机列表失败:', error);
      throw error;
    }
  }

  async getVM(vmId: string): Promise<VirtualMachine | null> {
    if (!this.connected) await this.connect();
    logger.info(`📋 获取 KVM 虚拟机详情: ${vmId}`);

    try {
      const { stdout: stateOutput } = await this.execSSH(`virsh domstate "${vmId}"`);
      const state = stateOutput.trim().toLowerCase();

      const detail = await this.getVMDetail(vmId);

      return {
        id: vmId,
        name: vmId,
        hypervisorType: 'kvm',
        hypervisorId: this.platformId,
        status: this.mapVirshStatus(state),
        powerState: this.mapVirshPowerState(state),
        memoryMB: detail.maxMem ? Math.round(detail.maxMem / 1024) : 0,
        numCPUs: detail.vcpus || 0,
        disks: [],
        networkInterfaces: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`❌ 获取 KVM 虚拟机 ${vmId} 详情失败:`, error);
      return null;
    }
  }

  async createVM(request: CreateVMRequest): Promise<VirtualMachine> {
    if (!this.connected) await this.connect();
    logger.info(`🚀 创建 KVM 虚拟机: ${request.name}`);

    // KVM 虚拟机创建需要预配置 XML 定义文件
    // 这里提供一个基本的 virt-install 命令路径
    const vcpus = request.config.numCPUs;
    const memory = request.config.memoryMB;
    const diskSize = request.config.disks?.[0]?.sizeGB || 10;
    const diskPath = `/var/lib/libvirt/images/${request.name}.qcow2`;

    const cmd = [
      'virt-install',
      '--name', `"${request.name}"`,
      '--vcpus', String(vcpus),
      '--memory', String(memory),
      '--disk', `path="${diskPath}",size=${diskSize},format=qcow2`,
      '--network', 'network=default',
      '--graphics', 'none',
      '--noautoconsole',
      '--import',
    ];

    if (!request.powerOn) {
      cmd.push('--noautoconsole');
    }

    throw new Error(
      'KVM 虚拟机创建需要预配置的镜像文件。请使用：' +
      cmd.join(' ') +
      ' 或提供自定义 XML 定义文件。建议通过 virsh define 命令从 XML 定义创建虚拟机。'
    );
  }

  async cloneVM(request: CloneVMRequest): Promise<VirtualMachine> {
    if (!this.connected) await this.connect();
    logger.info(`📋 克隆 KVM 虚拟机: ${request.vmId} -> ${request.name}`);

    const sourceVM = await this.getVM(request.vmId);
    if (!sourceVM) {
      throw new Error('源虚拟机不存在');
    }

    try {
      // 1. 导出源虚拟机 XML
      const { stdout: xml } = await this.execSSH(`virsh dumpxml "${request.vmId}"`);

      // 2. 创建临时 XML 文件并修改名称/UUID
      const tempFile = `/tmp/${request.name}.xml`;
      // 用 sed 替换名称
      const escapedName = request.name.replace(/"/g, '\\"');
      const escapedVmId = request.vmId.replace(/"/g, '\\"');

      const escapedXml = xml.replace(/'/g, "'\\''");
      await this.execSSH(
        `echo '${escapedXml}' | sed 's/<name>${escapedVmId}<\\/name>/<name>${escapedName}<\\/name>/' | sed '/<uuid>/d' > ${tempFile}`
      );

      // 3. 定义新虚拟机
      await this.execSSH(`virsh define ${tempFile}`);
      await this.execSSH(`rm -f ${tempFile}`);

      if (request.powerOn) {
        await this.powerOnVM(request.name);
      }

      return {
        ...sourceVM,
        id: request.name,
        name: request.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        powerState: request.powerOn ? 'poweredOn' : 'poweredOff',
        status: request.powerOn ? 'running' : 'stopped',
      };
    } catch (error) {
      logger.error('❌ 克隆 KVM 虚拟机失败:', error);
      throw error;
    }
  }

  async deleteVM(vmId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`🗑️ 删除 KVM 虚拟机: ${vmId}`);

    try {
      // 先检查并关闭虚拟机
      const { stdout: state } = await this.execSSH(`virsh domstate "${vmId}"`);
      if (state.trim().toLowerCase() === 'running') {
        await this.execSSH(`virsh destroy "${vmId}"`);
      }

      // 删除定义和存储
      await this.execSSH(`virsh undefine --remove-all-storage "${vmId}"`);
      logger.info(`✅ KVM 虚拟机 ${vmId} 已删除`);
    } catch (error) {
      logger.error(`❌ 删除 KVM 虚拟机 ${vmId} 失败:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // 电源操作
  // ==========================================================================

  async powerOnVM(vmId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`🔌 启动 KVM 虚拟机: ${vmId}`);

    try {
      await this.execSSH(`virsh start "${vmId}"`);
      logger.info(`✅ KVM 虚拟机 ${vmId} 已启动`);
    } catch (error) {
      logger.error(`❌ 启动 KVM 虚拟机 ${vmId} 失败:`, error);
      throw error;
    }
  }

  async powerOffVM(vmId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`🔌 关闭 KVM 虚拟机: ${vmId}`);

    try {
      // 先尝试优雅关机
      const { stdout: state } = await this.execSSH(`virsh domstate "${vmId}"`);
      if (state.trim().toLowerCase() !== 'running') {
        logger.info(`KVM 虚拟机 ${vmId} 未运行，无需关机`);
        return;
      }

      try {
        await this.execSSH(`virsh shutdown "${vmId}"`);
        // 等待关机完成
        await this.waitForState(vmId, 'shut off', 60000);
      } catch {
        // 优雅关机失败，强制关闭
        logger.warn(`⚠️ KVM 虚拟机 ${vmId} 优雅关机失败，执行强制关闭`);
        await this.execSSH(`virsh destroy "${vmId}"`);
      }

      logger.info(`✅ KVM 虚拟机 ${vmId} 已关闭`);
    } catch (error) {
      logger.error(`❌ 关闭 KVM 虚拟机 ${vmId} 失败:`, error);
      throw error;
    }
  }

  async restartVM(vmId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`🔄 重启 KVM 虚拟机: ${vmId}`);

    try {
      const { stdout: state } = await this.execSSH(`virsh domstate "${vmId}"`);

      if (state.trim().toLowerCase() === 'running') {
        await this.execSSH(`virsh reboot "${vmId}"`);
        await this.waitForState(vmId, 'running', 60000);
      } else {
        await this.execSSH(`virsh start "${vmId}"`);
      }

      logger.info(`✅ KVM 虚拟机 ${vmId} 已重启`);
    } catch (error) {
      logger.error(`❌ 重启 KVM 虚拟机 ${vmId} 失败:`, error);
      throw error;
    }
  }

  async suspendVM(vmId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`⏸️ 挂起 KVM 虚拟机: ${vmId}`);

    try {
      await this.execSSH(`virsh suspend "${vmId}"`);
      logger.info(`✅ KVM 虚拟机 ${vmId} 已挂起`);
    } catch (error) {
      logger.error(`❌ 挂起 KVM 虚拟机 ${vmId} 失败:`, error);
      throw error;
    }
  }

  async pauseVM(vmId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`⏸️ 暂停 KVM 虚拟机: ${vmId}`);

    try {
      await this.execSSH(`virsh suspend "${vmId}"`);
      logger.info(`✅ KVM 虚拟机 ${vmId} 已暂停`);
    } catch (error) {
      logger.error(`❌ 暂停 KVM 虚拟机 ${vmId} 失败:`, error);
      throw error;
    }
  }

  async resumeVM(vmId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`▶️ 恢复 KVM 虚拟机: ${vmId}`);

    try {
      await this.execSSH(`virsh resume "${vmId}"`);
      logger.info(`✅ KVM 虚拟机 ${vmId} 已恢复`);
    } catch (error) {
      logger.error(`❌ 恢复 KVM 虚拟机 ${vmId} 失败:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // 快照管理
  // ==========================================================================

  async listSnapshots(vmId: string): Promise<VMSnapshot[]> {
    if (!this.connected) await this.connect();
    logger.info(`📋 获取 KVM 虚拟机快照列表: ${vmId}`);

    try {
      const { stdout } = await this.execSSH(`virsh snapshot-list "${vmId}"`);

      // virsh snapshot-list 输出格式:
      //  Name                 Creation Time             State
      // -----------------------------------------------------------
      //  snap1                2024-06-15 10:00:00 +0800 running

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

  async createSnapshot(request: CreateSnapshotRequest): Promise<VMSnapshot> {
    if (!this.connected) await this.connect();
    logger.info(`📸 创建 KVM 虚拟机快照: ${request.vmId} - ${request.name}`);

    try {
      await this.execSSH(`virsh snapshot-create-as "${request.vmId}" "${request.name}" "${request.description || ''}"`);
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

  async restoreSnapshot(request: RestoreSnapshotRequest): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`⏮️ 恢复 KVM 虚拟机快照: ${request.vmId} -> ${request.snapshotId}`);

    try {
      await this.execSSH(`virsh snapshot-revert "${request.vmId}" "${request.snapshotId}"`);
      logger.info(`✅ KVM 虚拟机 ${request.vmId} 快照 ${request.snapshotId} 已恢复`);
    } catch (error) {
      logger.error(`❌ 恢复 KVM 虚拟机 ${request.vmId} 快照 ${request.snapshotId} 失败:`, error);
      throw error;
    }
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`🗑️ 删除 KVM 快照: ${snapshotId}`);

    // 快照 ID 在 KVM 中通常是名称，需要和 vmId 配合使用
    // 接口只传了 snapshotId，遍历所有虚拟机查找
    try {
      const vms = await this.listVMs();
      let deleted = false;

      for (const vm of vms) {
        try {
          const snapshots = await this.listSnapshots(vm.id);
          if (snapshots.some((s) => s.id === snapshotId)) {
            await this.execSSH(`virsh snapshot-delete "${vm.id}" "${snapshotId}"`);
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

  async listTemplates(): Promise<VMTemplate[]> {
    if (!this.connected) await this.connect();
    logger.info('📋 获取 KVM 模板列表');

    // KVM/libvirt 没有原生模板概念，通过快照或存储卷模拟
    return [];
  }

  async createTemplate(vmId: string, name: string, description?: string): Promise<VMTemplate> {
    if (!this.connected) await this.connect();
    logger.info(`📋 创建 KVM 模板: ${vmId} -> ${name}`);

    const sourceVM = await this.getVM(vmId);
    if (!sourceVM) {
      throw new Error('源虚拟机不存在');
    }

    // KVM 模板通过创建快照 + 克隆磁盘实现，这里返回基本结构
    // 实际场景中建议通过 snapshot + 磁盘镜像模板方式处理
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

  async deleteTemplate(templateId: string): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`🗑️ 删除 KVM 模板: ${templateId}`);

    // KVM 删除模板逻辑 — 通常模板是磁盘文件
    try {
      await this.execSSH(`virsh vol-delete --pool default "${templateId}.qcow2"`);
    } catch (error) {
      logger.warn(`⚠️ KVM 模板 ${templateId} 删除警告:`, error);
    }
  }

  // ==========================================================================
  // 监控统计
  // ==========================================================================

  async getVMStats(vmId: string): Promise<VMStats> {
    if (!this.connected) await this.connect();
    logger.info(`📊 获取 KVM 虚拟机状态: ${vmId}`);

    try {
      // 获取内存信息
      const { stdout: dominfo } = await this.execSSH(`virsh dominfo "${vmId}"`);

      let maxMemKB = 0;
      let usedMemKB = 0;
      let vcpus = 0;
      for (const line of dominfo.split('\n')) {
        if (line.includes('Max memory:')) {
          maxMemKB = parseInt(line.replace(/\D/g, '')) || 0;
        }
        if (line.includes('Used memory:')) {
          usedMemKB = parseInt(line.replace(/\D/g, '')) || 0;
        }
      }

      // 获取 CPU 时间统计
      let cpuInfo: ReturnType<KVMAdapter['parseStats']>['cpuPercent'] = 0;
      let memInfo: ReturnType<KVMAdapter['parseStats']>['memKB'] = 0;
      let netRx = 0;
      let netTx = 0;

      try {
        const { stdout: stats } = await this.execSSH(`virsh domstats "${vmId}"`);
        const parsed = this.parseStats(stats);
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

  async reconfigureVM(request: ReconfigureVMRequest): Promise<VirtualMachine> {
    if (!this.connected) await this.connect();
    logger.info(`⚙️ 重新配置 KVM 虚拟机: ${request.vmId}`);

    // KVM 配置修改需要先关机再修改
    const { stdout: state } = await this.execSSH(`virsh domstate "${request.vmId}"`);
    const wasRunning = state.trim().toLowerCase() === 'running';

    if (wasRunning) {
      logger.warn('⚠️ KVM 虚拟机正在运行，配置修改将在下次启动时生效');
    }

    if (request.memoryMB !== undefined) {
      // 设置最大内存 (需关机生效)
      if (!wasRunning) {
        await this.execSSH(`virsh setmaxmem "${request.vmId}" ${request.memoryMB * 1024} --config`);
      }
    }

    if (request.numCPUs !== undefined) {
      if (!wasRunning) {
        await this.execSSH(`virsh setvcpus "${request.vmId}" ${request.numCPUs} --config --maximum`);
        await this.execSSH(`virsh setvcpus "${request.vmId}" ${request.numCPUs} --config`);
      }
    }

    // 返回更新后的虚拟机信息
    const vm = {
      id: request.vmId,
      name: request.vmId,
      hypervisorType: 'kvm' as const,
      hypervisorId: this.platformId,
      status: wasRunning ? ('running' as const) : ('stopped' as const),
      powerState: wasRunning ? ('poweredOn' as const) : ('poweredOff' as const),
      memoryMB: request.memoryMB || 0,
      numCPUs: request.numCPUs || 0,
      disks: [],
      networkInterfaces: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return vm;
  }

  async migrateVM(request: MigrateVMRequest): Promise<void> {
    if (!this.connected) await this.connect();
    logger.info(`🚚 迁移 KVM 虚拟机: ${request.vmId} -> ${request.targetHostId || 'auto'}`);

    if (!request.targetHostId) {
      throw new Error('KVM 迁移需要指定目标主机');
    }

    try {
      const cmd = `virsh migrate --live "${request.vmId}" qemu+tcp://${request.targetHostId}/system`;
      await this.execSSH(cmd);
      logger.info(`✅ KVM 虚拟机 ${request.vmId} 迁移完成`);
    } catch (error) {
      logger.error(`❌ 迁移 KVM 虚拟机 ${request.vmId} 失败:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // 主机管理
  // ==========================================================================

  async listHosts(): Promise<HypervisorHost[]> {
    if (!this.connected) await this.connect();
    logger.info('📋 获取 KVM 主机列表');

    try {
      // 获取主机 CPU 信息
      const { stdout: cpuInfo } = await this.execSSH('nproc');
      const { stdout: memInfo } = await this.execSSH('free -m | grep Mem');
      const { stdout: hostname } = await this.execSSH('hostname');
      const { stdout: version } = await this.execSSH('virsh version --short');

      const numCpus = parseInt(cpuInfo.trim()) || 0;
      const memParts = memInfo.trim().split(/\s+/);
      const memTotalMB = memParts[1] ? parseInt(memParts[1]) : 0;
      const memUsedMB = memParts[2] ? parseInt(memParts[2]) : 0;

      return [{
        id: this.host,
        name: hostname.trim() || this.host,
        hypervisorType: 'kvm',
        status: 'connected',
        ipAddress: this.host,
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

  async getHost(hostId: string): Promise<HypervisorHost | null> {
    if (!this.connected) await this.connect();

    try {
      const hosts = await this.listHosts();
      return hosts.find((h) => h.id === hostId) || null;
    } catch (error) {
      logger.error(`❌ 获取 KVM 主机 ${hostId} 失败:`, error);
      return null;
    }
  }

  // ==========================================================================
  // 数据存储
  // ==========================================================================

  async listDatastores(): Promise<Datastore[]> {
    if (!this.connected) await this.connect();
    logger.info('📋 获取 KVM 数据存储列表');

    try {
      const { stdout } = await this.execSSH('virsh pool-list --all');
      // 解析存储池列表
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
            // 获取存储池详情
            const { stdout: poolInfo } = await this.execSSH(`virsh pool-info "${parts[0]}"`);
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
              hypervisorId: this.platformId,
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
              hypervisorId: this.platformId,
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

  async getDatastore(datastoreId: string): Promise<Datastore | null> {
    if (!this.connected) await this.connect();

    try {
      const datastores = await this.listDatastores();
      return datastores.find((d) => d.id === datastoreId) || null;
    } catch (error) {
      logger.error(`❌ 获取 KVM 数据存储 ${datastoreId} 失败:`, error);
      return null;
    }
  }

  // ==========================================================================
  // 网络管理
  // ==========================================================================

  async listNetworks(): Promise<VirtualNetwork[]> {
    if (!this.connected) await this.connect();
    logger.info('📋 获取 KVM 网络列表');

    try {
      const { stdout } = await this.execSSH('virsh net-list --all');
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
            hypervisorId: this.platformId,
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

  async listResourcePools(): Promise<ResourcePool[]> {
    if (!this.connected) await this.connect();
    logger.info('📋 获取 KVM 资源池列表');

    // KVM 的资源池等同于存储池
    try {
      const { stdout } = await this.execSSH('virsh pool-list --all');
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
            hypervisorId: this.platformId,
          });
        }
      }

      return pools;
    } catch (error) {
      logger.error('❌ 获取 KVM 资源池列表失败:', error);
      return [];
    }
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  private async getVMDetail(name: string): Promise<{ maxMem: number; vcpus: number }> {
    try {
      const { stdout } = await this.execSSH(`virsh dominfo "${name}"`);
      let maxMem = 0;
      let vcpus = 0;

      for (const line of stdout.split('\n')) {
        if (line.includes('Max memory:')) {
          maxMem = parseInt(line.replace(/\D/g, '')) || 0;
        }
        if (line.includes('CPU(s):')) {
          vcpus = parseInt(line.replace(/\D/g, '')) || 0;
        }
      }

      return { maxMem, vcpus };
    } catch {
      return { maxMem: 0, vcpus: 0 };
    }
  }

  private async waitForState(vmId: string, expectedState: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await this.execSSH(`virsh domstate "${vmId}"`);
        if (stdout.trim().toLowerCase() === expectedState.toLowerCase()) {
          return;
        }
      } catch {
        // 查询失败忽略
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    logger.warn(`⚠️ KVM 虚拟机 ${vmId} 等待状态 ${expectedState} 超时`);
  }

  private mapVirshStatus(state: string): 'running' | 'stopped' | 'paused' | 'suspended' | 'unknown' {
    switch (state.toLowerCase().replace(/\s+/g, '_')) {
      case 'running':
        return 'running';
      case 'shut_off':
      case 'shutoff':
        return 'stopped';
      case 'paused':
        return 'paused';
      case 'suspended':
      case 'pmsuspended':
        return 'suspended';
      default:
        return 'unknown';
    }
  }

  private mapVirshPowerState(state: string): 'poweredOn' | 'poweredOff' | 'suspended' | 'unknown' {
    switch (state.toLowerCase().replace(/\s+/g, '_')) {
      case 'running':
        return 'poweredOn';
      case 'shut_off':
      case 'shutoff':
        return 'poweredOff';
      case 'suspended':
      case 'pmsuspended':
        return 'suspended';
      case 'paused':
        return 'poweredOn';
      default:
        return 'unknown';
    }
  }
}
