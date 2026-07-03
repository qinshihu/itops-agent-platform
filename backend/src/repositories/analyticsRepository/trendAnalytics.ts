/**
 * trendAnalytics — 巡检/设备/告警趋势分析
 * 对应 linkageRoutes.ts GET /trends/*
 */

import db from '../../models/database';
import type {
  InspectionHistoryTrend,
  DeviceTrend,
  TrendSummary,
} from './types';

/** 巡检历史趋势：按天聚合巡检/告警/修复执行 */
export function getInspectionHistoryTrend(
  days: number,
  deviceId: string | undefined
): InspectionHistoryTrend {
  const limit = Math.min(days, 90);

  let whereClause = `nih.created_at >= datetime('now', '-${limit} days')`;
  const params: unknown[] = [];

  if (deviceId) {
    whereClause += ' AND nih.device_id = ?';
    params.push(deviceId);
  }

  // 按天聚合巡检结果
  const dailyStats = db
    .prepare(
      `SELECT
        date(nih.created_at) as day,
        COUNT(*) as total_inspections,
        SUM(CASE WHEN nih.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN nih.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN nih.status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        AVG(nih.duration_ms) as avg_duration_ms
      FROM network_inspection_history nih
      WHERE ${whereClause}
      GROUP BY date(nih.created_at)
      ORDER BY day ASC`
    )
    .all(...params) as Array<Record<string, unknown>>;

  // 按天聚合告警
  const alertTrends = db
    .prepare(
      `SELECT
        date(created_at) as day,
        COUNT(*) as total_alerts,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_count
      FROM alerts
      WHERE created_at >= datetime('now', '-${limit} days')
        ${deviceId ? 'AND source LIKE ?' : ''}
      GROUP BY date(created_at)
      ORDER BY day ASC`
    )
    .all(...(deviceId ? [...params, `%${deviceId}%`] : params)) as Array<
    Record<string, unknown>
  >;

  // 按天聚合修复执行
  const remediationTrends = db
    .prepare(
      `SELECT
        date(started_at) as day,
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM remediation_executions
      WHERE started_at >= datetime('now', '-${limit} days')
      GROUP BY date(started_at)
      ORDER BY day ASC`
    )
    .all() as Array<Record<string, unknown>>;

  return {
    days: limit,
    daily_inspections: dailyStats,
    alert_trends: alertTrends,
    remediation_trends: remediationTrends,
  };
}

/** 单台设备巡检指标趋势：从 snmp_interface_metrics 聚合接口时序数据 */
export function getDeviceTrend(deviceId: string, days: number, metric: string): DeviceTrend {
  const limit = Math.min(days, 90);

  const snapshots = db
    .prepare(
      `SELECT if_name, if_index, in_octets, out_octets,
             in_errors, out_errors, in_utilization, out_utilization, sampled_at
      FROM snmp_interface_metrics
      WHERE device_id = ? AND sampled_at >= datetime('now', '-${limit} days')
      ORDER BY sampled_at ASC`
    )
    .all(deviceId) as Array<Record<string, any>>;

  // 按采样时间点聚合
  const timeBuckets: Record<string, any> = {};
  for (const snap of snapshots) {
    const ts = (snap.sampled_at || '').slice(0, 16) || 'unknown';
    if (!timeBuckets[ts]) {
      timeBuckets[ts] = {
        timestamp: snap.sampled_at,
        interface_count: 0,
        avg_in_utilization: 0,
        avg_out_utilization: 0,
        total_in_octets: 0,
        total_out_octets: 0,
        total_in_errors: 0,
        total_out_errors: 0,
      };
    }
    const b = timeBuckets[ts];
    b.interface_count++;
    b.total_in_octets += snap.in_octets || 0;
    b.total_out_octets += snap.out_octets || 0;
    b.total_in_errors += snap.in_errors || 0;
    b.total_out_errors += snap.out_errors || 0;
    // 累积利用率用于取平均
    b.avg_in_utilization += snap.in_utilization || 0;
    b.avg_out_utilization += snap.out_utilization || 0;
  }

  // 计算平均值
  for (const b of Object.values(timeBuckets)) {
    b.avg_in_utilization =
      b.avg_in_utilization > 0
        ? Math.round((b.avg_in_utilization / b.interface_count) * 10) / 10
        : 0;
    b.avg_out_utilization =
      b.avg_out_utilization > 0
        ? Math.round((b.avg_out_utilization / b.interface_count) * 10) / 10
        : 0;
  }

  return {
    device_id: deviceId,
    days: limit,
    metric,
    points: Object.values(timeBuckets),
  };
}

/** 趋势总结：整体健康趋势 */
export function getTrendSummary(days: number): TrendSummary {
  const limit = Math.min(days, 90);

  const totalInspections = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM network_inspection_history WHERE created_at >= datetime('now', '-${limit} days')`
      )
      .get() as { c: number }
  ).c;
  const successInspections = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM network_inspection_history WHERE status = 'success' AND created_at >= datetime('now', '-${limit} days')`
      )
      .get() as { c: number }
  ).c;
  const failedInspections = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM network_inspection_history WHERE status = 'failed' AND created_at >= datetime('now', '-${limit} days')`
      )
      .get() as { c: number }
  ).c;

  const totalAlerts = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM alerts WHERE created_at >= datetime('now', '-${limit} days')`
      )
      .get() as { c: number }
  ).c;
  const criticalAlerts = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM alerts WHERE severity = 'critical' AND created_at >= datetime('now', '-${limit} days')`
      )
      .get() as { c: number }
  ).c;

  const healthRate =
    totalInspections > 0 ? Math.round((successInspections / totalInspections) * 100) : 100;

  return {
    days: limit,
    inspection_count: totalInspections,
    inspection_success_rate: healthRate,
    inspection_failed: failedInspections,
    alert_count: totalAlerts,
    alert_critical_count: criticalAlerts,
    avg_alerts_per_day:
      totalAlerts > 0 ? Math.round((totalAlerts / limit) * 10) / 10 : 0,
  };
}
