// ── 主 repository 核心方法（alerts + alert_provider_configs + aars_config + probe_execution_stats）──

import db from '../../models/database';
import type { AarsConfig, ProbeExecutionStats } from '../types/alert';
import { parseMetadata, parseMetadataList, clampLimit } from './helpers';
import type { AlertFilters, AlertProviderConfigRecord, AlertRecord } from './types';

/**
 * 查询告警列表（支持 status/severity/limit 过滤）
 */
export function getAll(filters: AlertFilters = {}): AlertRecord[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.severity) {
    conditions.push('severity = ?');
    params.push(filters.severity);
  }

  let query = 'SELECT * FROM alerts';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC';

  const limit = clampLimit(filters.limit);
  if (limit !== undefined) {
    query += ' LIMIT ?';
    params.push(limit);
  }

  const alerts = db.prepare(query).all(...params) as AlertRecord[];
  return parseMetadataList(alerts);
}

/**
 * 按 ID 查询单条告警（自动反序列化 metadata）
 */
export function getById(id: string): AlertRecord | undefined {
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRecord | undefined;
  return parseMetadata(alert);
}

/**
 * 按 ID 查询告警（仅返回关键字段，不含 metadata 解析，供内部告警触发链路使用）
 */
export function getEssentialById(id: string): { id: string; title: string; content: string; severity: string; source: string; metadata?: string } | undefined {
  return db.prepare('SELECT id, title, content, severity, source, metadata FROM alerts WHERE id = ?').get(id) as
    | { id: string; title: string; content: string; severity: string; source: string; metadata?: string }
    | undefined;
}

/**
 * 按 ID 查询告警（轻量字段集，供 RCA/工作流使用）
 */
export function getSummaryById(id: string): { id: string; title: string; severity: string; content: string; source: string } | undefined {
  return db.prepare('SELECT id, title, content, severity, source FROM alerts WHERE id = ?').get(id) as
    | { id: string; title: string; severity: string; content: string; source: string }
    | undefined;
}

/**
 * 创建告警
 */
export function create(input: {
  id: string;
  source: string;
  severity: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown> | string;
  related_task_id?: string | null;
  alert_fingerprint?: string | null;
}): AlertRecord | undefined {
  const metadataStr = typeof input.metadata === 'string'
    ? input.metadata
    : JSON.stringify(input.metadata || {});

  if (input.alert_fingerprint !== undefined && input.alert_fingerprint !== null) {
    db.prepare(`
      INSERT INTO alerts (id, source, severity, title, content, metadata, related_task_id, alert_fingerprint, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.source,
      input.severity,
      input.title,
      input.content,
      metadataStr,
      input.related_task_id || null,
      input.alert_fingerprint
    );
  } else {
    db.prepare(`
      INSERT INTO alerts (id, source, severity, title, content, metadata, related_task_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.source,
      input.severity,
      input.title,
      input.content,
      metadataStr,
      input.related_task_id || null
    );
  }

  return getById(input.id);
}

/**
 * 简化创建告警（自定义 status，供工作流 Provider 等场景使用）
 */
export function createSimple(input: {
  id: string;
  title: string;
  severity: string;
  content: string;
  source: string;
  status: string;
}): void {
  db.prepare(`
    INSERT INTO alerts (id, title, severity, content, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `).run(input.id, input.title, input.severity, input.content, input.source, input.status);
}

/**
 * 查找是否存在活跃告警（source + title + 未关闭状态）
 * 对应 selfMonitorService.ts
 */
export function findActiveBySourceAndTitle(source: string, title: string): { id: string } | undefined {
  return db.prepare(`
    SELECT id FROM alerts
    WHERE source = ? AND title = ? AND status IN ('new', 'acknowledged')
  `).get(source, title) as { id: string } | undefined;
}

/**
 * 更新告警状态
 */
export function updateStatus(id: string, status: 'new' | 'acknowledged' | 'resolved'): AlertRecord | undefined {
  db.prepare(`UPDATE alerts SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(status, id);
  return getById(id);
}

/** 确认告警（acknowledged） */
export function acknowledge(id: string): AlertRecord | undefined {
  return updateStatus(id, 'acknowledged');
}

/** 解决告警（resolved） */
export function resolve(id: string): AlertRecord | undefined {
  return updateStatus(id, 'resolved');
}

/**
 * 按 external_id 自动解决告警（metadata LIKE 匹配）
 * 对应：webhookRoutes.processNormalizedAlert 的 resolved 分支
 * 返回受影响行数
 */
export function resolveAutoByExternalId(resolutionNotes: string, externalId: string): number {
  return db.prepare(
    `UPDATE alerts SET status = 'resolved_auto', resolved_at = local_now(),
     resolved_by = 'auto', resolution_notes = ?
     WHERE metadata LIKE ? AND status IN ('new', 'confirmed', 'in_progress')`
  ).run(resolutionNotes, `%${externalId}%`).changes;
}

/**
 * 按 host 自动解决告警（source + title LIKE 匹配，24h 内）
 * 对应：webhookRoutes.processNormalizedAlert 的 resolved 分支（fallback）
 * 返回受影响行数
 */
export function resolveAutoByHost(resolutionNotes: string, source: string, host: string): number {
  return db.prepare(
    `UPDATE alerts SET status = 'resolved_auto', resolved_at = local_now(),
     resolved_by = 'auto', resolution_notes = ?
     WHERE source = ? AND title LIKE ? AND status IN ('new', 'confirmed', 'in_progress')
     AND created_at >= datetime('now', '-24 hours')`
  ).run(resolutionNotes, source, `%${host}%`).changes;
}

/**
 * 按 status 和 severity 分组统计告警数量
 * 对应：alertRoutes.ts GET /stats/summary
 */
export function getStatsByStatusAndSeverity(): {
  byStatus: Array<{ status: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
} {
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM alerts GROUP BY status
  `).all() as Array<{ status: string; count: number }>;
  const bySeverity = db.prepare(`
    SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity
  `).all() as Array<{ severity: string; count: number }>;
  return { byStatus, bySeverity };
}

/**
 * 统计告警总数
 */
export function countAll(): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM alerts').get() as { count: number };
  return row.count;
}

/**
 * 查询最近告警（排除指定 ID，且时间在 since 之后）
 */
export function listRecentExcludingId(excludeId: string, since: string, limit: number): AlertRecord[] {
  const alerts = db.prepare(
    'SELECT * FROM alerts WHERE id != ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?'
  ).all(excludeId, since, limit) as AlertRecord[];
  return parseMetadataList(alerts);
}

/**
 * 删除告警
 */
export function deleteAlert(id: string): void {
  db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
}

/**
 * 按 ID 批量查询告警（用于手动关联组）
 * 对应：alertCorrelationService.createManualGroup
 */
export function getAlertsByIds(ids: string[]): AlertRecord[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const alerts = db.prepare(`SELECT * FROM alerts WHERE id IN (${placeholders})`).all(...ids) as AlertRecord[];
  return parseMetadataList(alerts);
}

/**
 * 查询待自动分析的告警（status=new, severity IN critical/high/medium, 未分析过）
 * 对应：alertFetcher.fetchPendingAlerts
 */
export function listPendingForAutoAnalysis(): Array<{ id: string; title: string; severity: string; source: string }> {
  return db.prepare(`
    SELECT a.id, a.title, a.severity, a.source
    FROM alerts a
    WHERE a.status = 'new'
      AND a.severity IN ('critical', 'high', 'medium')
      AND NOT EXISTS (
        SELECT 1 FROM alert_auto_analysis aa WHERE aa.alert_id = a.id
      )
    ORDER BY
      CASE a.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END ASC,
      a.created_at ASC
    LIMIT 3
  `).all() as Array<{ id: string; title: string; severity: string; source: string }>;
}

/**
 * 查询待 AARS 处理的告警（status=new, 未有 aars_response_logs）
 * 对应：alertAutoResponseService.fetchPendingAlerts
 */
export function listPendingForAARS(): Array<{ id: string; severity: string }> {
  return db.prepare(`
    SELECT a.id, a.severity
    FROM alerts a
    WHERE a.status = 'new'
      AND a.severity IN ('critical', 'high', 'medium', 'low')
      AND NOT EXISTS (SELECT 1 FROM aars_response_logs l WHERE l.alert_id = a.id)
    ORDER BY
      CASE a.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END ASC,
      a.created_at ASC
    LIMIT 10
  `).all() as Array<{ id: string; severity: string }>;
}

/**
 * 更新告警的 updated_at 时间戳（不改变状态，用于自动分析后 touch）
 * 对应：analysisEngine.analyzeAlert
 */
export function touchUpdated(id: string): void {
  db.prepare(`UPDATE alerts SET updated_at = datetime('now','localtime') WHERE id = ?`).run(id);
}

/**
 * 按 ID 获取告警来源（轻量查询）
 * 对应：remediationExecutor.notifyNoiseReduction
 */
export function getSourceById(id: string): string | undefined {
  const row = db.prepare('SELECT source FROM alerts WHERE id = ?').get(id) as { source: string } | undefined;
  return row?.source;
}

/**
 * 查询告警的自动化审计日志（audit_logs 表，非 aars_response_logs）
 */
export function getAutomationLogs(alertId: string, limit = 100): Array<Record<string, unknown>> {
  return db.prepare(`
    SELECT * FROM audit_logs
    WHERE resource_type = 'alert_automation' AND resource_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(alertId, limit) as Array<Record<string, unknown>>;
}
// ── alert_provider_configs 表 ──

/** 列出所有告警 provider 配置 */
export function listProviderConfigs(): AlertProviderConfigRecord[] {
  return db.prepare('SELECT * FROM alert_provider_configs ORDER BY created_at DESC').all() as AlertProviderConfigRecord[];
}

/** 按 ID 查询告警 provider 配置 */
export function getProviderConfigById(id: string): AlertProviderConfigRecord | undefined {
  return db.prepare('SELECT * FROM alert_provider_configs WHERE id = ?').get(id) as AlertProviderConfigRecord | undefined;
}

/** 创建告警 provider 配置，返回新建记录 */
export function createProviderConfig(input: {
  id: string;
  provider_id: string;
  name: string;
  config: string;
  enabled: number;
}): AlertProviderConfigRecord | undefined {
  db.prepare(`
    INSERT INTO alert_provider_configs (id, provider_id, name, config, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `).run(input.id, input.provider_id, input.name, input.config, input.enabled);
  return getProviderConfigById(input.id);
}

/** 更新告警 provider 配置 */
export function updateProviderConfig(id: string, input: {
  provider_id?: string;
  name?: string;
  config?: string;
  enabled?: number;
}): AlertProviderConfigRecord | undefined {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.provider_id !== undefined) { fields.push('provider_id = ?'); params.push(input.provider_id); }
  if (input.name !== undefined) { fields.push('name = ?'); params.push(input.name); }
  if (input.config !== undefined) { fields.push('config = ?'); params.push(input.config); }
  if (input.enabled !== undefined) { fields.push('enabled = ?'); params.push(input.enabled); }

  if (fields.length === 0) return getProviderConfigById(id);

  fields.push("updated_at = datetime('now','localtime')");
  params.push(id);

  db.prepare(`UPDATE alert_provider_configs SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getProviderConfigById(id);
}

/** 删除告警 provider 配置，返回受影响行数 */
export function deleteProviderConfig(id: string): number {
  return db.prepare('DELETE FROM alert_provider_configs WHERE id = ?').run(id).changes;
}

// ── aars_config 表（单行配置）──

/** 获取 AARS 配置（单行，LIMIT 1） */
export function getAarsConfig(): AarsConfig | undefined {
  return db.prepare('SELECT * FROM aars_config LIMIT 1').get() as AarsConfig | undefined;
}

/** 动态更新 AARS 配置（WHERE id = 1） */
export function updateAarsConfig(fields: Partial<AarsConfig>): AarsConfig | undefined {
  const entries = Object.entries(fields);
  if (entries.length === 0) return getAarsConfig();
  const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE aars_config SET ${sets}, updated_at = datetime('now','localtime') WHERE id = 1`).run(fields);
  return getAarsConfig();
}

// ── probe_execution_stats 表 ──

/** 列出探针执行统计（按 total_uses 倒序，LIMIT 50） */
export function listProbeStats(limit = 50): ProbeExecutionStats[] {
  return db.prepare('SELECT * FROM probe_execution_stats ORDER BY total_uses DESC LIMIT ?').all(limit) as ProbeExecutionStats[];
}

// ── 统计 ──

/** 统计告警总数 */
export function countAll(): number {
  return (db.prepare('SELECT COUNT(*) as count FROM alerts').get() as { count: number }).count;
}

/**
 * 导出告警列表（限 10000 条，供 importExportService 使用）
 */
export function listAllForExport(): Array<Record<string, unknown>> {
  return db.prepare(`
    SELECT id, source, severity, title, content, status, created_at, updated_at
    FROM alerts 
    ORDER BY created_at DESC
    LIMIT 10000
  `).all() as Array<Record<string, unknown>>;
}