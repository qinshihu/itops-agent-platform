/**
 * networkDeviceRepository — 设备发现（扫描任务 + 扫描结果）
 *
 * 取代 networkDiscoveryService.ts 中散落的 db.prepare 调用。
 */

import db from '../../models/database';
import type { NetworkDiscoveryJob, NetworkDiscoveryResult } from '../types/network';

export const networkDeviceDiscoveryRepo = {
  // ── Discovery Jobs ──

  /** 创建扫描任务 */
  createDiscoveryJob(job: {
    id: string; name: string; start_ip: string; end_ip: string; status: string;
    progress: number; total_hosts: number; scanned_hosts: number; found_devices: number;
    credential_ids: string; created_at: string;
  }): void {
    db.prepare(`
      INSERT INTO network_discovery_jobs (id, name, start_ip, end_ip, status, progress, total_hosts, scanned_hosts, found_devices, credential_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(job.id, job.name, job.start_ip, job.end_ip, job.status, job.progress, job.total_hosts, job.scanned_hosts, job.found_devices, job.credential_ids, job.created_at);
  },

  /** 获取单个扫描任务 */
  getDiscoveryJob(id: string): NetworkDiscoveryJob | undefined {
    return db.prepare('SELECT * FROM network_discovery_jobs WHERE id = ?').get(id) as NetworkDiscoveryJob | undefined;
  },

  /** 列出全部扫描任务 */
  listDiscoveryJobs(): NetworkDiscoveryJob[] {
    return db.prepare('SELECT * FROM network_discovery_jobs ORDER BY created_at DESC').all() as NetworkDiscoveryJob[];
  },

  /** 更新扫描任务状态 */
  updateDiscoveryJobStatus(id: string, status: string): void {
    db.prepare("UPDATE network_discovery_jobs SET status = ?, started_at = datetime('now','localtime') WHERE id = ?").run(status, id);
  },

  /** 更新扫描任务进度 */
  updateDiscoveryJobProgress(id: string, progress: number, scanned: number, found: number): void {
    db.prepare('UPDATE network_discovery_jobs SET progress = ?, scanned_hosts = ?, found_devices = ? WHERE id = ?')
      .run(progress, scanned, found, id);
  },

  /** 完成/取消扫描任务 */
  finishDiscoveryJob(id: string, status: string): void {
    db.prepare("UPDATE network_discovery_jobs SET status = ?, progress = 100, completed_at = datetime('now','localtime') WHERE id = ?").run(status, id);
  },

  /** 取消正在运行的任务 */
  cancelDiscoveryJob(id: string): void {
    db.prepare("UPDATE network_discovery_jobs SET status = ?, completed_at = datetime('now','localtime') WHERE id = ? AND status = ?")
      .run('cancelled', id, 'running');
  },

  /** 删除扫描任务 */
  deleteDiscoveryJob(id: string): void {
    db.prepare('DELETE FROM network_discovery_results WHERE job_id = ?').run(id);
    db.prepare('DELETE FROM network_discovery_jobs WHERE id = ?').run(id);
  },

  // ── Discovery Results ──

  /** 删除任务关联的扫描结果 */
  deleteDiscoveryResultsByJob(jobId: string): void {
    db.prepare('DELETE FROM network_discovery_results WHERE job_id = ?').run(jobId);
  },

  /** 插入离线扫描结果 */
  insertDiscoveryResultOffline(id: string, jobId: string, ip: string, responseTimeMs: number): void {
    db.prepare(`
      INSERT OR IGNORE INTO network_discovery_results (id, job_id, ip_address, status, response_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(id, jobId, ip, 'offline', responseTimeMs);
  },

  /** 插入在线扫描结果 */
  insertDiscoveryResultOnline(result: {
    id: string; job_id: string; ip_address: string; status: string;
    sys_name?: string | null; sys_descr?: string | null; sys_location?: string | null;
    sys_object_id?: string | null; snmp_version?: string | null; community?: string | null;
    interface_count?: number | null; vendor?: string | null; model?: string | null;
    response_time_ms: number;
  }): void {
    db.prepare(`
      INSERT INTO network_discovery_results (id, job_id, ip_address, status, sys_name, sys_descr, sys_location, sys_object_id,
        snmp_version, community, interface_count, vendor, model, response_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      result.id, result.job_id, result.ip_address, result.status,
      result.sys_name ?? null, result.sys_descr ?? null, result.sys_location ?? null,
      result.sys_object_id ?? null, result.snmp_version ?? null, result.community ?? null,
      result.interface_count ?? null, result.vendor ?? null, result.model ?? null,
      result.response_time_ms,
    );
  },

  /** 查询扫描结果（分页+过滤） */
  listDiscoveryResults(options: { jobId?: string; limit?: number; offset?: number; status?: string }): { results: NetworkDiscoveryResult[]; total: number } {
    let sql = 'SELECT * FROM network_discovery_results WHERE 1=1';
    const params: unknown[] = [];

    if (options.jobId) {
      sql += ' AND job_id = ?';
      params.push(options.jobId);
    }
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    const countResult = db.prepare(sql.replace('*', 'COUNT(*) as total')).get(...params) as { total: number };
    const total = countResult?.total || 0;

    sql += ' ORDER BY status ASC, response_time_ms ASC';
    sql += ' LIMIT ? OFFSET ?';
    params.push(options.limit || 100, options.offset || 0);

    const results = db.prepare(sql).all(...params) as NetworkDiscoveryResult[];
    return { results, total };
  },

  /** 获取单个扫描结果 */
  getDiscoveryResult(id: string): NetworkDiscoveryResult | undefined {
    return db.prepare('SELECT * FROM network_discovery_results WHERE id = ?').get(id) as NetworkDiscoveryResult | undefined;
  },
};