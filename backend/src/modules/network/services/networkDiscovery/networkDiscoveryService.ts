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
 *
 * 委托给 icmpDiscovery / snmpDiscovery / jobManager 子模块
 */

import {
  createJob as createJobFn,
  startJob as startJobFn,
  getResults as getResultsFn,
  getJobs as getJobsFn,
  getJob as getJobFn,
  cancelJob as cancelJobFn,
  deleteJob as deleteJobFn,
  importToDevices as importToDevicesFn,
} from './jobManager';
import { buildPingCommand as _buildPingCommand, isPingSuccess as _isPingSuccess, calculateIpRange as _calculateIpRange, generateIpList as _generateIpList, ipToInt as _ipToInt, intToIp as _intToIp } from './icmpDiscovery';
import { trySnmpConnect as _trySnmpConnect, resolveVendor as _resolveVendor } from './snmpDiscovery';

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
    return createJobFn(name, startIp, endIp, credentialIds);
  }

  /**
   * 启动扫描任务
   */
  async startJob(jobId: string): Promise<void> {
    return startJobFn({ activeJobs: this.activeJobs }, jobId);
  }

  /**
   * 获取扫描结果（支持分页和按 job_id 过滤）
   */
  getResults(options: { jobId?: string; limit?: number; offset?: number; status?: string }): { results: DiscoveryResult[]; total: number } {
    return getResultsFn(options);
  }

  /**
   * 获取所有扫描任务
   */
  getJobs(): DiscoveryJob[] {
    return getJobsFn();
  }

  /**
   * 获取单个任务
   */
  getJob(jobId: string): DiscoveryJob | undefined {
    return getJobFn(jobId);
  }

  /**
   * 取消扫描任务
   */
  cancelJob(jobId: string): void {
    cancelJobFn({ activeJobs: this.activeJobs }, jobId);
  }

  /**
   * 删除扫描任务及其结果
   */
  deleteJob(jobId: string): void {
    deleteJobFn({ activeJobs: this.activeJobs }, jobId);
  }

  /**
   * 将发现结果导入设备库
   */
  importToDevices(resultIds: string[], sshUsername?: string, sshPassword?: string, sshPort?: number): { imported: number; errors: string[] } {
    return importToDevicesFn(resultIds, sshUsername, sshPassword, sshPort);
  }
}

export const networkDiscoveryService = new NetworkDiscoveryService();