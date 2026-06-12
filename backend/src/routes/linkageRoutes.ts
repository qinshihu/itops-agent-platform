import { Router, Request, Response } from 'express';
import db from '../models/database';
import { logger } from '../utils/logger';

const router = Router();

// ================================================================
// 巡检中心 — 统一合并 SNMP 巡检 + SSH 巡检 + AI 分析结果
// ================================================================
router.get('/inspection-center', (req: Request, res: Response) => {
  try {
    let deviceId = req.query.deviceId as string | undefined;
    const alertId = req.query.alertId as string | undefined;
    const type = req.query.type as string | undefined;  // snmp | ssh | compliance | analysis
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 200);

    // 如果传了 alertId 但没有 deviceId，从关联表查设备
    if (!deviceId && alertId) {
      const assoc = db.prepare('SELECT device_id FROM alert_device_associations WHERE alert_id = ?').get(alertId) as any;
      if (assoc) deviceId = assoc.device_id;
    }

    let results: any[] = [];

    // 1. SNMP 巡检 + SSH 巡检（来自 network_inspection_history）
    let historyFilter = '';
    const params: any[] = [];
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

    const inspectionHistory = db.prepare(`
      SELECT
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
      LIMIT ?
    `).all(...params, limit) as any[];

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
    const analysisParams: any[] = [];
    if (deviceId) {
      analysisFilter = 'WHERE aa.device_id = ?';
      analysisParams.push(deviceId);
    }
    const analysisTypeFilter = type === 'analysis' || !type || type === 'all';
    if (analysisTypeFilter) {
      const analysisResults = db.prepare(`
        SELECT
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
        LIMIT ?
      `).all(...analysisParams, limit) as any[];

      for (const a of analysisResults) {
        if (!type || type === 'analysis' || type === a.device_type) {
          results.push({
            id: a.id,
            device_id: a.device_id,
            source: 'analysis',
            type: `ai_${a.device_type}`,
            status: a.status === 'completed' ? 'success' : a.status === 'failed' ? 'failed' : 'partial',
            summary: a.summary || 'AI 分析',
            device_name: a.device_name,
            device_ip: a.device_ip,
            duration_ms: a.duration_ms,
            created_at: a.created_at,
            raw: { diagnosis: a.diagnosis, commands_executed: a.commands_executed, alert_id: a.alert_id },
          });
        }
      }
    }

    // 补充设备名称/IP
    for (const r of results) {
      if (!r.device_name || !r.device_ip) {
        const nd = db.prepare('SELECT name, ip_address FROM network_devices WHERE id = ?').get(r.device_id) as any;
        if (nd) {
          r.device_name = nd.name;
          r.device_ip = nd.ip_address;
        } else {
          const sv = db.prepare('SELECT name, hostname FROM servers WHERE id = ?').get(r.device_id) as any;
          if (sv) {
            r.device_name = sv.name;
            r.device_ip = sv.hostname;
          }
        }
      }
    }

    // 按时间降序
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 统计
    const counts = {
      total: results.length,
      inspections: inspectionHistory.length,
      analyses: results.filter(r => r.source === 'analysis').length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
    };

    res.json({ success: true, data: results.slice(0, limit), counts });
  } catch (error: any) {
    logger.error('Inspection center query failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 设备概览 — 单设备聚合
// ================================================================
router.get('/device/:id/overview', (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;

    // 查 network_devices
    const nd = db.prepare('SELECT * FROM network_devices WHERE id = ?').get(deviceId) as any;
    const sv = !nd ? db.prepare('SELECT * FROM servers WHERE id = ?').get(deviceId) as any : null;

    const device = nd || sv;
    if (!device) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }

    const deviceType = nd ? 'network_device' : 'server';
    const deviceName = device.name || device.hostname;
    const deviceIp = device.ip_address || device.hostname;

    // 最近告警
    const assocAlerts = db.prepare(`
      SELECT a.id, a.severity, a.title, a.status, a.created_at
      FROM alert_device_associations ada
      JOIN alerts a ON a.id = ada.alert_id
      WHERE ada.device_id = ?
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all(deviceId) as any[];

    // 最近巡检
    const inspections = db.prepare(`
      SELECT id, inspection_type, status, summary, duration_ms, created_at
      FROM network_inspection_history
      WHERE device_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(deviceId) as any[];

    // 最近 AI 分析
    const analyses = db.prepare(`
      SELECT id, alert_id, status, summary, diagnosis, created_at
      FROM alert_auto_analysis
      WHERE device_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(deviceId) as any[];

    // 最近修复执行
    const executions = db.prepare(`
      SELECT re.id, re.status, rp.name as policy_name, re.started_at as created_at
      FROM remediation_executions re
      LEFT JOIN remediation_policies rp ON rp.id = re.policy_id
      WHERE re.target_ids LIKE ?
      ORDER BY re.started_at DESC
      LIMIT 10
    `).all(`%${deviceId}%`) as any[];

    // 简化的聚合数据
    const overview = {
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
      open_alert_count: assocAlerts.filter(a => a.status !== 'resolved' && a.status !== 'resolved_auto').length,
      alerts: assocAlerts,
      inspection_count: inspections.length,
      inspections: inspections,
      analysis_count: analyses.length,
      analyses: analyses,
      execution_count: executions.length,
      executions: executions,
    };

    res.json({ success: true, data: overview });
  } catch (error: any) {
    logger.error('Device overview query failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 仪表盘联动统计数据
// ================================================================
router.get('/dashboard/linkage', (_req: Request, res: Response) => {
  try {
    const alertTotal = (db.prepare('SELECT COUNT(*) as c FROM alerts').get() as any).c;
    const openAlerts = (db.prepare("SELECT COUNT(*) as c FROM alerts WHERE status NOT IN ('resolved','resolved_auto')").get() as any).c;
    const analysisTotal = (db.prepare('SELECT COUNT(*) as c FROM alert_auto_analysis').get() as any).c;
    const inspectionTotal = (db.prepare('SELECT COUNT(*) as c FROM network_inspection_history').get() as any).c;
    const executionTotal = (db.prepare('SELECT COUNT(*) as c FROM remediation_executions').get() as any).c;
    const deviceTotal = (db.prepare('SELECT COUNT(*) as c FROM network_devices').get() as any).c;
    const serverTotal = (db.prepare('SELECT COUNT(*) as c FROM servers').get() as any).c;

    res.json({
      success: true,
      data: {
        alerts: { total: alertTotal, open: openAlerts },
        analyses: { total: analysisTotal },
        inspections: { total: inspectionTotal },
        remediations: { total: executionTotal },
        devices: { network_devices: deviceTotal, servers: serverTotal },
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 历史巡检趋势数据
// ================================================================

/**
 * 获取巡检历史趋势（按天聚合）
 * GET /api/trends/inspection-history?days=30&deviceId=xxx
 */
router.get('/trends/inspection-history', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const deviceId = req.query.deviceId as string;
    const limit = Math.min(days, 90); // 最大 90 天

    let whereClause = `nih.created_at >= datetime('now', '-${limit} days')`;
    const params: any[] = [];

    if (deviceId) {
      whereClause += ' AND nih.device_id = ?';
      params.push(deviceId);
    }

    // 按天聚合巡检结果
    const dailyStats = db.prepare(`
      SELECT
        date(nih.created_at) as day,
        COUNT(*) as total_inspections,
        SUM(CASE WHEN nih.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN nih.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN nih.status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        AVG(nih.duration_ms) as avg_duration_ms
      FROM network_inspection_history nih
      WHERE ${whereClause}
      GROUP BY date(nih.created_at)
      ORDER BY day ASC
    `).all(...params) as any[];

    // 按天聚合告警
    const alertTrends = db.prepare(`
      SELECT
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
      ORDER BY day ASC
    `).all(...(deviceId ? [...params, `%${deviceId}%`] : params)) as any[];

    // 按天聚合修复执行
    const remediationTrends = db.prepare(`
      SELECT
        date(started_at) as day,
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM remediation_executions
      WHERE started_at >= datetime('now', '-${limit} days')
      GROUP BY date(started_at)
      ORDER BY day ASC
    `).all() as any[];

    res.json({
      success: true,
      data: {
        days: limit,
        daily_inspections: dailyStats,
        alert_trends: alertTrends,
        remediation_trends: remediationTrends,
      }
    });
  } catch (error: any) {
    logger.error('Failed to get trend data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取单台设备的巡检指标趋势
 * GET /api/trends/device/:deviceId?days=30&metric=cpu|memory|bandwidth
 */
router.get('/trends/device/:deviceId', (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const days = parseInt(req.query.days as string, 10) || 30;
    const metric = req.query.metric as string || 'all';
    const limit = Math.min(days, 90);

    // 从 snmp_interface_metrics 获取接口指标时序数据
    const snapshots = db.prepare(`
      SELECT if_name, if_index, in_octets, out_octets,
             in_errors, out_errors, in_utilization, out_utilization, sampled_at
      FROM snmp_interface_metrics
      WHERE device_id = ? AND sampled_at >= datetime('now', '-${limit} days')
      ORDER BY sampled_at ASC
    `).all(deviceId) as any[];

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
      (b as any).avg_in_utilization = (b as any).avg_in_utilization > 0
        ? Math.round(((b as any).avg_in_utilization / (b as any).interface_count) * 10) / 10
        : 0;
      (b as any).avg_out_utilization = (b as any).avg_out_utilization > 0
        ? Math.round(((b as any).avg_out_utilization / (b as any).interface_count) * 10) / 10
        : 0;
    }

    const trendPoints = Object.values(timeBuckets);

    res.json({
      success: true,
      data: {
        device_id: deviceId,
        days: limit,
        metric,
        points: trendPoints,
      }
    });
  } catch (error: any) {
    logger.error('Failed to get device trend:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取趋势总结
 * GET /api/trends/summary?days=30
 */
router.get('/trends/summary', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const limit = Math.min(days, 90);

    // 整体健康趋势
    const totalInspections = (db.prepare(`SELECT COUNT(*) as c FROM network_inspection_history WHERE created_at >= datetime('now', '-${limit} days')`).get() as any).c;
    const successInspections = (db.prepare(`SELECT COUNT(*) as c FROM network_inspection_history WHERE status = 'success' AND created_at >= datetime('now', '-${limit} days')`).get() as any).c;
    const failedInspections = (db.prepare(`SELECT COUNT(*) as c FROM network_inspection_history WHERE status = 'failed' AND created_at >= datetime('now', '-${limit} days')`).get() as any).c;

    const totalAlerts = (db.prepare(`SELECT COUNT(*) as c FROM alerts WHERE created_at >= datetime('now', '-${limit} days')`).get() as any).c;
    const criticalAlerts = (db.prepare(`SELECT COUNT(*) as c FROM alerts WHERE severity = 'critical' AND created_at >= datetime('now', '-${limit} days')`).get() as any).c;

    const healthRate = totalInspections > 0 ? Math.round((successInspections / totalInspections) * 100) : 100;

    res.json({
      success: true,
      data: {
        days: limit,
        inspection_count: totalInspections,
        inspection_success_rate: healthRate,
        inspection_failed: failedInspections,
        alert_count: totalAlerts,
        alert_critical_count: criticalAlerts,
        avg_alerts_per_day: totalAlerts > 0 ? Math.round((totalAlerts / limit) * 10) / 10 : 0,
      }
    });
  } catch (error: any) {
    logger.error('Failed to get trend summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function safeJsonParse(str: string | null | undefined, fallback: any = null): any {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export default router;
