/**
 * linkageAnalytics — 巡检中心 / 设备概览 / 仪表盘联动统计
 * 对应 linkageRoutes.ts
 */

import db from '../../models/database';
import type {
  AnalyticsRow,
  InspectionCenterResult,
  DeviceOverview,
  DashboardLinkageStats,
} from './types';

function safeJsonParse(str: string | null | undefined, fallback: unknown = null): unknown {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/** 巡检中心聚合查询：合并 SNMP 巡检 + SSH 巡检 + AI 分析结果 */
export function getInspectionCenter(
  deviceIdIn: string | undefined,
  alertId: string | undefined,
  type: string | undefined,
  limit: number
): InspectionCenterResult {
  let deviceId = deviceIdIn;

  // 如果传了 alertId 但没有 deviceId，从关联表查设备
  if (!deviceId && alertId) {
    const assoc = db
      .prepare('SELECT device_id FROM alert_device_associations WHERE alert_id = ?')
      .get(alertId) as { device_id: string } | undefined;
    if (assoc) deviceId = assoc.device_id;
  }

  const results: Array<AnalyticsRow> = [];

  // 1. SNMP 巡检 + SSH 巡检（来自 network_inspection_history）
  let historyFilter = '';
  const params: unknown[] = [];
  if (deviceId) {
    historyFilter = 'WHERE device_id = ?';
    params.push(deviceId);
  }
  if (type && ['snmp', 'ssh', 'compliance'].includes(type)) {
    historyFilter = historyFilter
      ? `${historyFilter} AND inspection_type = ?`
      : 'WHERE inspection_type = ?';
    params.push(type);
  }

  const inspectionHistory = db
    .prepare(
      `SELECT
        id,
        device_id,
        inspection_type,
        status,
        results,
        commands_executed,
        commands_failed,
        summary,
        duration_ms,
        created_at
      FROM network_inspection_history
      ${historyFilter}
      ORDER BY created_at DESC
      LIMIT ?`
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .all(...params, limit) as Array<Record<string, any>>;

  for (const h of inspectionHistory) {
    results.push({
      id: h.id,
      device_id: h.device_id,
      source: 'inspection',
      type: h.inspection_type,
      status: h.status,
      summary: h.summary || (h.inspection_type === 'snmp' ? 'SNMP 巡检' : 'SSH 巡检'),
      device_name: null,
      device_ip: null,
      duration_ms: h.duration_ms,
      created_at: h.created_at,
      raw: h.results ? safeJsonParse(h.results) : null,
    });
  }

  // 2. AI 自动分析结果（来自 alert_auto_analysis）
  let analysisFilter = '';
  const analysisParams: unknown[] = [];
  if (deviceId) {
    analysisFilter = 'WHERE aa.device_id = ?';
    analysisParams.push(deviceId);
  }
  const analysisTypeFilter = type === 'analysis' || !type || type === 'all';
  if (analysisTypeFilter) {
    const analysisResults = db
      .prepare(
        `SELECT
          aa.id,
          aa.alert_id,
          aa.device_id,
          aa.device_name,
          aa.device_ip,
          aa.device_type,
          aa.status,
          aa.summary,
          aa.diagnosis,
          aa.raw_output,
          aa.commands_executed,
          aa.duration_ms,
          aa.created_at
        FROM alert_auto_analysis aa
        ${analysisFilter}
        ORDER BY aa.created_at DESC
        LIMIT ?`
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .all(...analysisParams, limit) as Array<Record<string, any>>;

    for (const a of analysisResults) {
      if (!type || type === 'analysis' || type === a.device_type) {
        results.push({
          id: a.id,
          device_id: a.device_id,
          source: 'analysis',
          type: `ai_${a.device_type}`,
          status:
            a.status === 'completed' ? 'success' : a.status === 'failed' ? 'failed' : 'partial',
          summary: a.summary || 'AI 分析',
          device_name: a.device_name,
          device_ip: a.device_ip,
          duration_ms: a.duration_ms,
          created_at: a.created_at,
          raw: {
            diagnosis: a.diagnosis,
            commands_executed: a.commands_executed,
            alert_id: a.alert_id,
          },
        });
      }
    }
  }

  // 补充设备名称/IP
  for (const r of results) {
    if (!r.device_name || !r.device_ip) {
      const nd = db
        .prepare('SELECT name, ip_address FROM network_devices WHERE id = ?')
        .get(r.device_id as string) as { name: string; ip_address: string } | undefined;
      if (nd) {
        r.device_name = nd.name;
        r.device_ip = nd.ip_address;
      } else {
        const sv = db
          .prepare('SELECT name, hostname FROM servers WHERE id = ?')
          .get(r.device_id as string) as { name: string; hostname: string } | undefined;
        if (sv) {
          r.device_name = sv.name;
          r.device_ip = sv.hostname;
        }
      }
    }
  }

  // 按时间降序
  results.sort(
    (a, b) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  );

  const counts = {
    total: results.length,
    inspections: inspectionHistory.length,
    analyses: results.filter((r) => r.source === 'analysis').length,
    success: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };

  return { results: results.slice(0, limit), counts };
}

/** 设备概览聚合：单设备的告警/巡检/分析/修复执行 */
export function getDeviceOverview(deviceId: string): DeviceOverview | undefined {
  const nd = db.prepare('SELECT * FROM network_devices WHERE id = ?').get(deviceId) as
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Record<string, any>
    | undefined;
  const sv = !nd
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (db.prepare('SELECT * FROM servers WHERE id = ?').get(deviceId) as Record<string, any> | undefined)
    : null;

  const device = nd || sv;
  if (!device) return undefined;

  const deviceType = nd ? 'network_device' : 'server';
  const deviceName = device.name || device.hostname;
  const deviceIp = device.ip_address || device.hostname;

  // 最近告警
  const assocAlerts = db
    .prepare(
      `SELECT a.id, a.severity, a.title, a.status, a.created_at
       FROM alert_device_associations ada
       JOIN alerts a ON a.id = ada.alert_id
       WHERE ada.device_id = ?
       ORDER BY a.created_at DESC
       LIMIT 10`
    )
    .all(deviceId) as Array<AnalyticsRow>;

  // 最近巡检
  const inspections = db
    .prepare(
      `SELECT id, inspection_type, status, summary, duration_ms, created_at
       FROM network_inspection_history
       WHERE device_id = ?
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .all(deviceId) as Array<AnalyticsRow>;

  // 最近 AI 分析
  const analyses = db
    .prepare(
      `SELECT id, alert_id, status, summary, diagnosis, created_at
       FROM alert_auto_analysis
       WHERE device_id = ?
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .all(deviceId) as Array<AnalyticsRow>;

  // 最近修复执行
  const executions = db
    .prepare(
      `SELECT re.id, re.status, rp.name as policy_name, re.started_at as created_at
       FROM remediation_executions re
       LEFT JOIN remediation_policies rp ON rp.id = re.policy_id
       WHERE re.target_ids LIKE ?
       ORDER BY re.started_at DESC
       LIMIT 10`
    )
    .all(`%${deviceId}%`) as Array<AnalyticsRow>;

  return {
    device: {
      id: device.id,
      name: deviceName,
      ip: deviceIp,
      type: deviceType,
      vendor: nd?.vendor || null,
      username: device.username || null,
      ssh_port: device.ssh_port || 22,
      snmp_enabled: device.snmp_enabled || false,
      snmp_credential_id: device.snmp_credential_id || null,
    },
    alert_count: assocAlerts.length,
    open_alert_count: assocAlerts.filter(
      (a) => a.status !== 'resolved' && a.status !== 'resolved_auto'
    ).length,
    alerts: assocAlerts,
    inspection_count: inspections.length,
    inspections,
    analysis_count: analyses.length,
    analyses,
    execution_count: executions.length,
    executions,
  };
}

/** 仪表盘联动统计：各表总数 + 告警开闭数 */
export function getDashboardLinkage(): DashboardLinkageStats {
  const alertTotal = (db.prepare('SELECT COUNT(*) as c FROM alerts').get() as { c: number }).c;
  const openAlerts = (
    db
      .prepare("SELECT COUNT(*) as c FROM alerts WHERE status NOT IN ('resolved','resolved_auto')")
      .get() as { c: number }
  ).c;
  const analysisTotal = (
    db.prepare('SELECT COUNT(*) as c FROM alert_auto_analysis').get() as { c: number }
  ).c;
  const inspectionTotal = (
    db.prepare('SELECT COUNT(*) as c FROM network_inspection_history').get() as { c: number }
  ).c;
  const executionTotal = (
    db.prepare('SELECT COUNT(*) as c FROM remediation_executions').get() as { c: number }
  ).c;
  const deviceTotal = (
    db.prepare('SELECT COUNT(*) as c FROM network_devices').get() as { c: number }
  ).c;
  const serverTotal = (db.prepare('SELECT COUNT(*) as c FROM servers').get() as { c: number }).c;

  return {
    alerts: { total: alertTotal, open: openAlerts },
    analyses: { total: analysisTotal },
    inspections: { total: inspectionTotal },
    remediations: { total: executionTotal },
    devices: { network_devices: deviceTotal, servers: serverTotal },
  };
}
