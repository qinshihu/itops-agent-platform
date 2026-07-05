/**
 * operationalAnalytics — 修复/SLA/服务器指标/告警来源/报告分析
 * 对应 dashboardRoutes.ts + reportRoutes.ts
 */

import db from '../../models/database';
import type {
  AnalyticsRow,
  RemediationStats,
  SlaStats,
  ServerMetricsDashboard,
  ServerMetricLatest,
  AlertSourceStats,
  ReportAnalytics,
} from './types';

/** 修复策略统计 */
export function getRemediationStats(): RemediationStats {
  const policyCount = db.prepare('SELECT COUNT(*) as count FROM remediation_policies').get() as { count: number };
  const enabledPolicyCount = db.prepare('SELECT COUNT(*) as count FROM remediation_policies WHERE enabled = 1').get() as { count: number };

  const todayExecutions = db.prepare(`
    SELECT COUNT(*) as count FROM remediation_executions
    WHERE created_at >= datetime('now', 'start of day')
  `).get() as { count: number };

  const todaySuccess = db.prepare(`
    SELECT COUNT(*) as count FROM remediation_executions
    WHERE status = 'success' AND created_at >= datetime('now', 'start of day')
  `).get() as { count: number };

  const todayFailed = db.prepare(`
    SELECT COUNT(*) as count FROM remediation_executions
    WHERE status = 'failed' AND created_at >= datetime('now', 'start of day')
  `).get() as { count: number };

  const waitingApproval = db.prepare(`
    SELECT COUNT(*) as count FROM remediation_executions
    WHERE status = 'waiting_approval'
  `).get() as { count: number };

  const rolledBack = db.prepare(`
    SELECT COUNT(*) as count FROM remediation_executions
    WHERE status = 'rolled_back' AND created_at >= datetime('now', 'start of day')
  `).get() as { count: number };

  const avgDuration = db.prepare(`
    SELECT AVG(execution_duration_ms) as avg_ms FROM remediation_executions
    WHERE execution_duration_ms IS NOT NULL AND created_at >= datetime('now', 'start of day')
  `).get() as { avg_ms: number | null };

  const total = todayExecutions?.count || 0;
  const successCount = todaySuccess?.count || 0;
  const successRate = total > 0 ? parseFloat(((successCount / total) * 100).toFixed(1)) : 0;

  const recentExecutions = db.prepare(`
    SELECT re.id, re.status, re.status_reason, re.created_at,
           rp.name as policy_name, rp.execution_mode,
           a.title as alert_title, a.severity as alert_severity
    FROM remediation_executions re
    JOIN remediation_policies rp ON re.policy_id = rp.id
    LEFT JOIN alerts a ON re.alert_id = a.id
    ORDER BY re.created_at DESC
    LIMIT 10
  `).all() as Array<AnalyticsRow>;

  return {
    total_policies: policyCount?.count || 0,
    enabled_policies: enabledPolicyCount?.count || 0,
    today: {
      total: total,
      success: successCount,
      failed: todayFailed?.count || 0,
      rolled_back: rolledBack?.count || 0,
      success_rate: successRate,
      avg_duration_ms: avgDuration?.avg_ms ? Math.round(avgDuration.avg_ms) : 0,
    },
    waiting_approval: waitingApproval?.count || 0,
    recent_executions: recentExecutions,
  };
}

/** SLA 统计 */
export function getSlaStats(): SlaStats {
  const completedTasks = db.prepare(`
    SELECT AVG(
      CAST(julianday(end_time) - julianday(created_at) AS REAL) * 24 * 60
    ) as avg_minutes
    FROM tasks
    WHERE status = 'completed' AND end_time IS NOT NULL
    AND created_at >= datetime('now', '-7 days')
  `).get() as { avg_minutes: number | null };

  const totalServers = db.prepare('SELECT COUNT(*) as count FROM servers WHERE enabled = 1').get() as { count: number };
  const activeServers = db.prepare(`
    SELECT COUNT(*) as count FROM servers
    WHERE enabled = 1 AND last_connected IS NOT NULL
    AND last_connected >= datetime('now', '-5 minutes')
  `).get() as { count: number };

  const avgResponseTime = db.prepare(`
    SELECT AVG(
      CAST(julianday(updated_at) - julianday(created_at) AS REAL) * 24 * 60 * 60
    ) as avg_seconds
    FROM alerts
    WHERE status IN ('confirmed', 'resolved', 'resolved_auto')
    AND updated_at IS NOT NULL
    AND created_at >= datetime('now', '-24 hours')
  `).get() as { avg_seconds: number | null };

  const todayAlerts = db.prepare(`
    SELECT COUNT(*) as count FROM alerts
    WHERE created_at >= datetime('now', 'start of day')
  `).get() as { count: number };

  const resolvedToday = db.prepare(`
    SELECT COUNT(*) as count FROM alerts
    WHERE status IN ('confirmed', 'resolved', 'resolved_auto')
    AND created_at >= datetime('now', 'start of day')
  `).get() as { count: number };

  const totalAlerts = todayAlerts?.count || 0;
  const resolvedCount = resolvedToday?.count || 0;
  const alertResolutionRate = totalAlerts > 0
    ? parseFloat(((resolvedCount / totalAlerts) * 100).toFixed(1))
    : 100;

  const uptime = totalServers.count > 0
    ? parseFloat((((activeServers?.count || 0) / totalServers.count) * 100).toFixed(2))
    : 100;

  const mttr = completedTasks?.avg_minutes
    ? parseFloat(completedTasks.avg_minutes.toFixed(1))
    : 0;

  const avgResponseSeconds = avgResponseTime?.avg_seconds
    ? parseFloat(avgResponseTime.avg_seconds.toFixed(1))
    : 0;

  return {
    mttr_minutes: mttr,
    uptime_percentage: uptime,
    avg_response_seconds: avgResponseSeconds,
    alert_resolution_rate: alertResolutionRate,
    total_alerts_today: totalAlerts,
    resolved_today: resolvedCount,
  };
}

/** 服务器指标（最新值 + 30 分钟历史） */
export function getServerMetricsDashboard(): ServerMetricsDashboard {
  const enabledServers = db.prepare('SELECT id, name, hostname FROM servers WHERE enabled = 1 ORDER BY name LIMIT 10').all() as Array<{ id: string; name: string; hostname: string }>;

  if (enabledServers.length === 0) {
    return {
      servers: [],
      has_real_data: false,
      cpu_history: [],
      memory_history: [],
      network_history: [],
      disk_history: [],
    };
  }

  const serverIds = enabledServers.map(s => s.id);
  const idPlaceholders = serverIds.map(() => '?').join(',');

  const latestMetricsRaw = db.prepare(`
    SELECT sm.server_id, s.name as server_name,
           sm.cpu_usage, sm.memory_usage, sm.disk_usage,
           sm.network_in_mbps, sm.network_out_mbps, sm.load_1min, sm.collected_at
    FROM server_metrics sm
    JOIN servers s ON sm.server_id = s.id
    WHERE sm.server_id IN (${idPlaceholders})
      AND sm.collected_at = (
        SELECT MAX(sm2.collected_at) FROM server_metrics sm2 WHERE sm2.server_id = sm.server_id
      )
  `).all(...serverIds) as Array<{
    server_id: string;
    server_name: string;
    cpu_usage: number | null;
    memory_usage: number | null;
    disk_usage: number | null;
    network_in_mbps: number | null;
    network_out_mbps: number | null;
    load_1min: number | null;
    collected_at: string | null;
  }>;

  const latestMetricsMap = new Map<string, typeof latestMetricsRaw[0]>();
  latestMetricsRaw.forEach(m => latestMetricsMap.set(m.server_id, m));

  const latestMetrics: ServerMetricLatest[] = enabledServers.map(server => {
    const metric = latestMetricsMap.get(server.id);
    return {
      server_id: server.id,
      server_name: server.name,
      cpu_usage: metric?.cpu_usage ?? null,
      memory_usage: metric?.memory_usage ?? null,
      disk_usage: metric?.disk_usage ?? null,
      network_in_mbps: metric?.network_in_mbps ?? null,
      network_out_mbps: metric?.network_out_mbps ?? null,
      load_1min: metric?.load_1min ?? null,
      collected_at: metric?.collected_at ?? null,
    };
  });

  const allHistory = db.prepare(`
    SELECT server_id, cpu_usage, memory_usage, disk_usage,
           COALESCE(network_in_mbps, 0) + COALESCE(network_out_mbps, 0) as network_value,
           collected_at as timestamp
    FROM server_metrics
    WHERE server_id IN (${idPlaceholders})
      AND collected_at >= datetime('now', '-30 minutes')
    ORDER BY server_id, collected_at ASC
  `).all(...serverIds) as Array<{
    server_id: string;
    cpu_usage: number | null;
    memory_usage: number | null;
    disk_usage: number | null;
    network_value: number;
    timestamp: string;
  }>;

  const cpuHistory: Array<{ server_id: string; value: number; timestamp: string }> = [];
  const memoryHistory: Array<{ server_id: string; value: number; timestamp: string }> = [];
  const networkHistory: Array<{ server_id: string; value: number; timestamp: string }> = [];
  const diskHistory: Array<{ server_id: string; value: number; timestamp: string }> = [];

  allHistory.forEach(h => {
    if (h.cpu_usage !== null) cpuHistory.push({ server_id: h.server_id, value: h.cpu_usage, timestamp: h.timestamp });
    if (h.memory_usage !== null) memoryHistory.push({ server_id: h.server_id, value: h.memory_usage, timestamp: h.timestamp });
    diskHistory.push({ server_id: h.server_id, value: h.disk_usage ?? 0, timestamp: h.timestamp });
    networkHistory.push({ server_id: h.server_id, value: h.network_value, timestamp: h.timestamp });
  });

  return {
    servers: latestMetrics,
    has_real_data: latestMetrics.some(m => m.cpu_usage !== null),
    cpu_history: cpuHistory,
    memory_history: memoryHistory,
    network_history: networkHistory,
    disk_history: diskHistory,
  };
}

/** 告警来源统计（按 source 聚合 + webhook 日志） */
export function getAlertSourceStats(): AlertSourceStats {
  const sourceStats = db.prepare(`
    SELECT
      source,
      COUNT(*) as total_alerts,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_alerts,
      SUM(CASE WHEN status IN ('confirmed', 'in_progress') THEN 1 ELSE 0 END) as active_alerts,
      SUM(CASE WHEN status = 'resolved' OR status = 'resolved_auto' THEN 1 ELSE 0 END) as resolved_alerts,
      SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
      SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
      SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_count,
      MIN(created_at) as first_alert,
      MAX(created_at) as last_alert
    FROM alerts
    GROUP BY source
    ORDER BY total_alerts DESC
  `).all() as Array<AnalyticsRow>;

  const webhookLogs = db.prepare(`
    SELECT
      source,
      COUNT(*) as total_webhooks,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      AVG(processing_time_ms) as avg_processing_ms,
      MAX(created_at) as last_webhook
    FROM alert_webhook_logs
    WHERE created_at >= datetime('now', '-24 hours')
    GROUP BY source
    ORDER BY total_webhooks DESC
  `).all() as Array<AnalyticsRow>;

  const last24h = db.prepare(`
    SELECT
      source,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
    FROM alerts
    WHERE created_at >= datetime('now', '-24 hours')
    GROUP BY source
  `).all() as Array<AnalyticsRow>;

  const totalAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts').get() as { count: number } | undefined;
  const activeAlerts = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status IN ('new', 'confirmed', 'in_progress')").get() as { count: number } | undefined;

  return {
    source_stats: sourceStats,
    webhook_logs_24h: webhookLogs,
    last_24h: last24h,
    total: totalAlerts?.count || 0,
    active: activeAlerts?.count || 0,
  };
}

/** 报告分析数据（告警趋势 + 分析统计 + 修复统计 + 热门诊断） */
export function getReportAnalytics(): ReportAnalytics {
  const alertTrends = db.prepare(`
    SELECT DATE(created_at) as date, severity, COUNT(*) as count
    FROM alerts
    WHERE created_at >= DATE('now', '-7 days', 'localtime')
    GROUP BY DATE(created_at), severity
    ORDER BY date
  `).all() as Array<AnalyticsRow>;

  const analysisStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM alert_auto_analysis
  `).get() as { total: number; completed: number; failed: number } | undefined;

  const remediationStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
      SUM(CASE WHEN status = 'rolled_back' THEN 1 ELSE 0 END) as rolled_back
    FROM remediation_executions
    WHERE created_at >= DATE('now', '-30 days', 'localtime')
  `).get() as { total: number; success_count: number; failed_count: number; rolled_back: number } | undefined;

  const topDiagnoses = db.prepare(`
    SELECT summary, COUNT(*) as count
    FROM alert_auto_analysis
    WHERE summary IS NOT NULL AND summary != ''
    GROUP BY summary
    ORDER BY count DESC
    LIMIT 10
  `).all() as Array<AnalyticsRow>;

  return {
    alertTrends,
    analysisStats: analysisStats || { total: 0, completed: 0, failed: 0 },
    remediationStats: remediationStats || { total: 0, success_count: 0, failed_count: 0, rolled_back: 0 },
    topDiagnoses,
  };
}
