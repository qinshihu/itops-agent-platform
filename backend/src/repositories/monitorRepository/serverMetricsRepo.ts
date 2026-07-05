/**
 * serverMetricsRepo — server_metrics 表的数据访问层
 *
 * 覆盖 server_metrics 表的查询操作，用于监控仪表盘和趋势分析。
 */

import db from '../../../models/database';

// ── 类型定义 ──

export interface ServerMetricRecord {
  id: string;
  server_id: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  memory_total_gb: number | null;
  memory_used_gb: number | null;
  disk_usage: number | null;
  disk_total_gb: number | null;
  disk_used_gb: number | null;
  network_in_mbps: number | null;
  network_out_mbps: number | null;
  load_1min: number | null;
  load_5min: number | null;
  load_15min: number | null;
  uptime_seconds: number | null;
  collected_at: string | null;
  created_at: string;
}

export interface ServerMetricInsertInput {
  id: string;
  server_id: string;
  cpu_usage?: number | null;
  memory_usage?: number | null;
  memory_total_gb?: number | null;
  memory_used_gb?: number | null;
  disk_usage?: number | null;
  disk_total_gb?: number | null;
  disk_used_gb?: number | null;
  network_in_mbps?: number | null;
  network_out_mbps?: number | null;
  load_1min?: number | null;
  load_5min?: number | null;
  load_15min?: number | null;
  uptime_seconds?: number | null;
  collected_at?: string | null;
}

// ── repository 实现 ──

export const serverMetricsRepo = {
  /** 按服务器 ID 查询最近指标 */
  getLatestByServer(serverId: string): ServerMetricRecord | undefined {
    return db.prepare(
      'SELECT * FROM server_metrics WHERE server_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(serverId) as ServerMetricRecord | undefined;
  },

  /** 按服务器 ID 查询时间范围内的指标 */
  listByServer(serverId: string, limit = 50): ServerMetricRecord[] {
    return db.prepare(
      'SELECT * FROM server_metrics WHERE server_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(serverId, limit) as ServerMetricRecord[];
  },

  /** 插入指标记录 */
  insert(input: ServerMetricInsertInput): void {
    db.prepare(`
      INSERT INTO server_metrics (id, server_id, cpu_usage, memory_usage, memory_total_gb, memory_used_gb,
        disk_usage, disk_total_gb, disk_used_gb, network_in_mbps, network_out_mbps,
        load_1min, load_5min, load_15min, uptime_seconds, collected_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      input.id, input.server_id,
      input.cpu_usage ?? null, input.memory_usage ?? null,
      input.memory_total_gb ?? null, input.memory_used_gb ?? null,
      input.disk_usage ?? null, input.disk_total_gb ?? null, input.disk_used_gb ?? null,
      input.network_in_mbps ?? null, input.network_out_mbps ?? null,
      input.load_1min ?? null, input.load_5min ?? null, input.load_15min ?? null,
      input.uptime_seconds ?? null, input.collected_at ?? null,
    );
  },

  /** 清理旧指标（保留最近 N 条） */
  cleanOld(serverId: string, keepCount: number): void {
    db.prepare(`
      DELETE FROM server_metrics WHERE server_id = ? AND id NOT IN (
        SELECT id FROM server_metrics WHERE server_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(serverId, serverId, keepCount);
  },
};