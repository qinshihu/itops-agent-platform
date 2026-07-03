/**
 * =============================================================================
 * ITOps Agent Platform - 网络设备主动发现服务
 * =============================================================================
 * IP 范围扫描 + SNMP 探测，自动发现网络设备
 *
 * 功能:
 * 1. ICMP Ping 扫描 IP 范围
 * 2. SNMP v1/v2c/v3 尝试连接已在线 IP
 * 3. 自动提取设备信息（sysName, sysDescr, sysLocation, 接口等）
 * 4. 扫描结果管理（保存/去重/一键导入设备库）
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { decrypt } from '../../auth/services/encryptionService';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { networkDeviceRepository, snmpCredentialsRepo } from '../../../repositories';

const execAsync = promisify(exec);
const isWindows = process.platform === 'win32';

/**
 * 跨平台 Ping 命令构建（Windows 和 Linux 语法不同）
 */
function buildPingCommand(ip: string): string {
  if (isWindows) {
    return `ping -n 1 -w 2000 ${ip}`;
  }
  return `ping -c 1 -W 2 ${ip}`;
}

/**
 * 跨平台 Ping 输出检测（中英文兼容）
 */
function isPingSuccess(stdout: string): boolean {
  // 通用检测：TTL 值（英文/中文输出都包含）
  if (/ttl=/i.test(stdout)) return true;
  // Linux 英文输出
  if (stdout.includes('1 received') || stdout.includes('1 packets received')) return true;
  // Windows 中文输出
  if (stdout.includes('TTL=')) return true;
  // 通用：收到 = 1
  if (stdout.includes('已接收 = 1') || stdout.includes('Received = 1')) return true;
  return false;
}

// ====================== 接口定义 ======================

export interface DiscoveryJob {
  id: string;
  name: string;
  start_ip: string;
  end_ip: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;          // 0-100
  total_hosts: number;
  scanned_hosts: number;
  found_devices: number;
  credential_ids: string;    // JSON 数组
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface DiscoveryResult {
  id: string;
  job_id: string;
  ip_address: string;
  status: 'online' | 'offline' | 'snmp_ok' | 'snmp_fail';
  sys_name?: string;
  sys_descr?: string;
  sys_location?: string;
  sys_object_id?: string;
  snmp_version?: string;
  community?: string;
  interface_count?: number;
  vendor?: string;
  model?: string;
  response_time_ms?: number;
  created_at: string;
}

// ====================== 服务实现 ======================

class NetworkDiscoveryService {
  private activeJobs: Map<string, AbortController> = new Map();

  /**
   * 创建扫描任务
   */
  createJob(name: string, startIp: string, endIp: string, credentialIds: string[]): DiscoveryJob {
    const totalHosts = this.calculateIpRange(startIp, endIp);
    const job: DiscoveryJob = {
      id: randomUUID(),
      name,
      start_ip: startIp,
      end_ip: endIp,
      status: 'pending',
      progress: 0,
      total_hosts: totalHosts,
      scanned_hosts: 0,
      found_devices: 0,
      credential_ids: JSON.stringify(credentialIds),
      created_at: new Date().toISOString(),
    };

    networkDeviceRepository.createDiscoveryJob({
      id: job.id,
      name: job.name,
      start_ip: job.start_ip,
      end_ip: job.end_ip,
      status: job.status,
      progress: job.progress,
      total_hosts: job.total_hosts,
      scanned_hosts: job.scanned_hosts,
      found_devices: job.found_devices,
      credential_ids: job.credential_ids,
      created_at: job.created_at,
    });

    logger.info(`📡 Discovery job created: ${name} (${startIp} - ${endIp}, ${totalHosts} hosts)`);
    return job;
  }

  /**
   * 启动扫描任务
   */
  async startJob(jobId: string): Promise<void> {
    const job = networkDeviceRepository.getDiscoveryJob(jobId) as DiscoveryJob | undefined;
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status !== 'pending' && job.status !== 'completed') throw new Error(`Job ${jobId} is ${job.status}, cannot start`);

    // 更新状态
    networkDeviceRepository.updateDiscoveryJobStatus(jobId, 'running');
    networkDeviceRepository.deleteDiscoveryResultsByJob(jobId);

    const abortController = new AbortController();
    this.activeJobs.set(jobId, abortController);

    const ips = this.generateIpList(job.start_ip, job.end_ip);
    const credentialIds: string[] = JSON.parse(job.credential_ids || '[]');
    const credentials = credentialIds.map(id => {
      const cred = snmpCredentialsRepo.getById(id);
      if (!cred) return null;
      // 解密凭证字段，否则 SNMP 认证会用密文必然失败
      return {
        ...cred,
        community: cred.community ? decrypt(cred.community) : null,
        snmp_auth_key: cred.snmp_auth_key ? decrypt(cred.snmp_auth_key) : null,
        snmp_priv_key: cred.snmp_priv_key ? decrypt(cred.snmp_priv_key) : null,
      };
    }).filter(Boolean);

    logger.info(`📡 Starting scan job ${jobId}: ${ips.length} hosts, ${credentials.length} credentials`);

    // 分批 Ping 扫描（每批 20 个 IP）
    const BATCH_SIZE = 20;
    let scanned = 0;
    let foundDevices = 0;

    for (let i = 0; i < ips.length; i += BATCH_SIZE) {
      if (abortController.signal.aborted) {
        networkDeviceRepository.finishDiscoveryJob(jobId, 'cancelled');
        logger.info(`📡 Scan job ${jobId} cancelled`);
        return;
      }

      const batch = ips.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(ip => this.pingAndDiscover(jobId, ip, credentials, abortController.signal))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          foundDevices++;
        }
      }

      scanned += batch.length;
      const progress = Math.round((scanned / ips.length) * 100);

      networkDeviceRepository.updateDiscoveryJobProgress(jobId, progress, scanned, foundDevices);

      // 小延迟防止扫描过快
      await new Promise(r => setTimeout(r, 100));
    }

    networkDeviceRepository.finishDiscoveryJob(jobId, 'completed');
    this.activeJobs.delete(jobId);
    logger.info(`📡 Scan job ${jobId} completed: ${foundDevices} devices found`);
  }

  /**
   * Ping IP 并尝试 SNMP 发现
   */
  private async pingAndDiscover(jobId: string, ip: string, credentials: any[], signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;

    const startTime = Date.now();
    let isOnline = false;

    try {
      // 跨平台 Ping 检测
      const { stdout } = await execAsync(buildPingCommand(ip), { timeout: 3000 });
      isOnline = isPingSuccess(stdout);
    } catch {
      isOnline = false;
    }

    const responseTimeMs = Date.now() - startTime;

    if (!isOnline) {
      networkDeviceRepository.insertDiscoveryResultOffline(randomUUID(), jobId, ip, responseTimeMs);
      return false;
    }

    // 在线 → 尝试 SNMP 连接
    let snmpResult: any = null;
    let usedCredential: any = null;

    for (const cred of credentials) {
      if (signal.aborted) return false;
      try {
        // Try direct SNMP connection (using snmpService's testing mechanism)
        const snmpInfo = await this.trySnmpConnect(ip, cred);
        if (snmpInfo) {
          snmpResult = snmpInfo;
          usedCredential = cred;
          break;
        }
      } catch {
        continue;
      }
    }

    // 保存结果
    const resultId = randomUUID();
    networkDeviceRepository.insertDiscoveryResultOnline({
      id: resultId,
      job_id: jobId,
      ip_address: ip,
      status: snmpResult ? 'snmp_ok' : 'online',
      sys_name: snmpResult?.sysName || null,
      sys_descr: snmpResult?.sysDescr || null,
      sys_location: snmpResult?.sysLocation || null,
      sys_object_id: snmpResult?.sysObjectID || null,
      snmp_version: usedCredential?.snmp_version || null,
      community: usedCredential?.community || null,
      interface_count: snmpResult?.interfaceCount || null,
      vendor: snmpResult?.vendor || null,
      model: snmpResult?.model || null,
      response_time_ms: responseTimeMs,
    });

    return !!snmpResult;
  }

  /**
   * 尝试 SNMP 连接并获取设备信息
   */
  private async trySnmpConnect(ip: string, cred: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    // 使用内置的 snmp 测试逻辑
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const snmp = require('net-snmp');

    const options: any = {
      port: cred.snmp_port || 161,
      timeout: 3000,
      retries: 1,
    };

    let session: any;
    try {
      if (cred.snmp_version === 'v3') {
        const user = {
          name: cred.snmp_user || '',
          level: cred.snmp_auth_protocol ? (cred.snmp_priv_protocol ? 'authPriv' : 'authNoPriv') : 'noAuthNoPriv',
          authProtocol: cred.snmp_auth_protocol?.toLowerCase() || undefined,
          authKey: cred.snmp_auth_key || undefined,
          privProtocol: cred.snmp_priv_protocol?.toLowerCase() || undefined,
          privKey: cred.snmp_priv_key || undefined,
        };
        session = snmp.createV3Session(ip, user, options);
      } else {
        session = snmp.createSession(ip, cred.community || 'public', options);
      }
    } catch {
      return null;
    }

    return new Promise(resolve => {
      const results: Record<string, any> = {};
      const _pending = 3;

      const oids = [
        '1.3.6.1.2.1.1.1.0',   // sysDescr
        '1.3.6.1.2.1.1.5.0',   // sysName
        '1.3.6.1.2.1.1.6.0',   // sysLocation
        '1.3.6.1.2.1.1.2.0',   // sysObjectID
        '1.3.6.1.2.1.2.1.0',   // ifNumber
      ];

      session.get(oids, (error: Error | null, varbinds: unknown[]) => {
        session.close();

        if (error) {
          resolve(null);
          return;
        }

        for (const v of varbinds) {
          if (v.value === undefined || v.value === null) continue;
          const val = typeof v.value === 'object' && v.value?.toString
            ? v.value.toString()
            : String(v.value);

          const oid = v.oid || '';
          if (oid.endsWith('.1.1.1.0')) results.sysDescr = val;
          else if (oid.endsWith('.1.1.5.0')) results.sysName = val;
          else if (oid.endsWith('.1.1.6.0')) results.sysLocation = val;
          else if (oid.endsWith('.1.1.2.0')) results.sysObjectID = val;
          else if (oid.endsWith('.1.2.1.0')) results.interfaceCount = parseInt(val) || 0;
        }

        // 解析厂商信息
        if (results.sysObjectID) {
          const vendorInfo = this.resolveVendor(results.sysObjectID);
          results.vendor = vendorInfo.vendor;
          results.model = vendorInfo.model || results.sysDescr;
        }

        if (results.sysName || results.sysDescr) {
          resolve(results);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * 根据 sysObjectID 识别厂商
   */
  private resolveVendor(sysObjectId: string): { vendor: string; model?: string } {
    const vendorMap: Record<string, string> = {
      '.1.3.6.1.4.1.9': 'Cisco',
      '.1.3.6.1.4.1.2011': 'Huawei',
      '.1.3.6.1.4.1.25506': 'H3C',
      '.1.3.6.1.4.1.2636': 'Juniper',
      '.1.3.6.1.4.1.4881': 'Ruijie',
      '.1.3.6.1.4.1.674': 'Dell',
      '.1.3.6.1.4.1.11': 'HP',
      '.1.3.6.1.4.1.14988': 'MikroTik',
      '.1.3.6.1.4.1.11863': 'TP-Link',
      '.1.3.6.1.4.1.41112': 'Ubiquiti',
      '.1.3.6.1.4.1.171': 'ZTE',
      '.1.3.6.1.4.1.6527': 'Nokia',
      '.1.3.6.1.4.1.890': 'Zyxel',
      '.1.3.6.1.4.1.12356': 'Fortinet',
      '.1.3.6.1.4.1.3224': 'Huawei (CSP)',
    };

    for (const [prefix, vendor] of Object.entries(vendorMap)) {
      if (sysObjectId.startsWith(prefix)) {
        return { vendor };
      }
    }
    if (sysObjectId.startsWith('.1.3.6.1.4.1')) {
      return { vendor: 'Other (Private Enterprise)' };
    }
    return { vendor: 'Unknown' };
  }

  /**
   * 获取扫描结果（支持分页和按 job_id 过滤）
   */
  getResults(options: { jobId?: string; limit?: number; offset?: number; status?: string }): { results: DiscoveryResult[]; total: number } {
    const result = networkDeviceRepository.listDiscoveryResults(options);
    return { results: result.results as DiscoveryResult[], total: result.total };
  }

  /**
   * 获取所有扫描任务
   */
  getJobs(): DiscoveryJob[] {
    return networkDeviceRepository.listDiscoveryJobs() as DiscoveryJob[];
  }

  /**
   * 获取单个任务
   */
  getJob(jobId: string): DiscoveryJob | undefined {
    return networkDeviceRepository.getDiscoveryJob(jobId) as DiscoveryJob | undefined;
  }

  /**
   * 取消扫描任务
   */
  cancelJob(jobId: string): void {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
    }
    networkDeviceRepository.cancelDiscoveryJob(jobId);
  }

  /**
   * 删除扫描任务及其结果
   */
  deleteJob(jobId: string): void {
    this.cancelJob(jobId);
    networkDeviceRepository.deleteDiscoveryJob(jobId);
  }

  /**
   * 将发现结果导入设备库
   */
  importToDevices(resultIds: string[], sshUsername?: string, sshPassword?: string, sshPort?: number): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    for (const resultId of resultIds) {
      try {
        const result = networkDeviceRepository.getDiscoveryResult(resultId) as DiscoveryResult | undefined;
        if (!result) {
          errors.push(`Result ${resultId} not found`);
          continue;
        }

        // 检查是否已存在（按 IP 去重）
        const existing = networkDeviceRepository.getIdByIp(result.ip_address);
        if (existing) {
          errors.push(`${result.ip_address} 已存在`);
          continue;
        }

        const deviceId = randomUUID();
        const vendor = result.vendor || 'Unknown';
        const model = result.model || '';

        networkDeviceRepository.createFromDiscovery({
          id: deviceId,
          name: result.sys_name || result.ip_address,
          ip_address: result.ip_address,
          vendor,
          model,
          username: sshUsername || 'admin',
          ssh_port: sshPort || 22,
          status: 'unknown',
          os_version: result.sys_descr || null,
        });

        imported++;
      } catch (err: unknown) {
        errors.push(`${resultId}: ${getErrorMessage(err)}`);
      }
    }

    return { imported, errors };
  }

  /**
   * 计算 IP 范围大小
   */
  private calculateIpRange(startIp: string, endIp: string): number {
    const start = this.ipToInt(startIp);
    const end = this.ipToInt(endIp);
    return Math.max(0, end - start + 1);
  }

  /**
   * 生成 IP 列表
   */
  private generateIpList(startIp: string, endIp: string): string[] {
    const start = this.ipToInt(startIp);
    const end = this.ipToInt(endIp);
    const ips: string[] = [];
    for (let i = start; i <= end; i++) {
      ips.push(this.intToIp(i));
    }
    return ips;
  }

  private ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  private intToIp(int: number): string {
    return [(int >>> 24), (int >>> 16) & 0xFF, (int >>> 8) & 0xFF, int & 0xFF].join('.');
  }
}

export const networkDiscoveryService = new NetworkDiscoveryService();
