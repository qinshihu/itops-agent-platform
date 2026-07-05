/**
 * remediationPolicyRepository — remediation_policies 表的统一数据访问层
 *
 * 包装 31 次 / 10 文件的直接 db.prepare 调用，涵盖：
 *   - 基本 CRUD（remediationService.ts）
 *   - 策略匹配（policyEngine.ts：按 alert_source 匹配 + catch-all）
 *   - 自动创建临时策略（AlertProcessor.ts）
 *   - 仪表盘统计（dashboardRoutes.ts）
 *   - MCP 工具查询（toolDefinitions.ts）
 *   - 预设绑定支持（linkRemediationWorkflows.ts / initRemediationPolicies.ts）
 *
 * 注意：remediationActions.ts 中的 JOIN 查询（remediation_audits ⇄ remediation_policies）
 * 主要属于 remediation_audits 域，留待后续 repository 覆盖。
 */

import db from '../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { RemediationPolicy, RemediationExecution, RemediationHistory } from './types/auto';

// ── 类型定义 ──

export interface RemediationPolicyRecord {
  id: string;
  name: string;
  description?: string | null;
  alert_source: string;
  alert_severity?: string | null;
  alert_keywords?: string | null;
  alert_tags?: string | null;
  execution_mode: string;
  workflow_id: string;
  workflow_params?: string | null;
  max_executions_per_hour: number;
  cooldown_seconds: number;
  require_confirmation: number;
  enable_verification: number;
  verification_workflow_id?: string | null;
  verification_params?: string | null;
  verification_timeout_seconds: number;
  enable_rollback: number;
  rollback_workflow_id?: string | null;
  rollback_on_failure: number;
  enabled: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemediationPolicyListFilters {
  enabled?: number;
  alert_source?: string;
  limit?: number;
  offset?: number;
}

export interface RemediationPolicyCreateInput {
  id: string;
  name: string;
  description?: string | null;
  alert_source: string;
  alert_severity?: string | null;
  alert_keywords?: string | null;
  alert_tags?: string | null;
  execution_mode: string;
  workflow_id: string;
  workflow_params?: string | null;
  max_executions_per_hour?: number;
  cooldown_seconds?: number;
  require_confirmation?: number;
  enable_verification?: number;
  verification_workflow_id?: string | null;
  verification_params?: string | null;
  verification_timeout_seconds?: number;
  enable_rollback?: number;
  rollback_workflow_id?: string | null;
  rollback_on_failure?: number;
  enabled?: number;
  created_by?: string | null;
}

/** AlertProcessor 自动创建临时策略的最小字段集 */
export interface RemediationPolicyMinimalInput {
  id: string;
  name: string;
  description: string;
  alert_source: string;
  alert_severity: string;
  execution_mode: string;
  workflow_id: string;
}

/** 预设种子 INSERT OR IGNORE 的完整字段集 */
export interface RemediationPolicySeedInput {
  id: string;
  name: string;
  description?: string | null;
  alert_source: string;
  alert_severity?: string | null;
  alert_keywords?: string | null;
  alert_tags?: string | null;
  execution_mode: string;
  workflow_id: string;
  workflow_params?: string | null;
  max_executions_per_hour?: number;
  cooldown_seconds?: number;
  enable_verification?: number;
  verification_workflow_id?: string | null;
  verification_params?: string | null;
  verification_timeout_seconds?: number;
  enable_rollback?: number;
  rollback_workflow_id?: string | null;
  rollback_on_failure?: number;
  enabled?: number;
  created_by?: string | null;
}

export interface RemediationPolicyUpdateInput {
  name?: string;
  description?: string | null;
  alert_source?: string;
  alert_severity?: string | null;
  alert_keywords?: string | null;
  alert_tags?: string | null;
  execution_mode?: string;
  workflow_id?: string;
  workflow_params?: string | null;
  max_executions_per_hour?: number;
  cooldown_seconds?: number;
  require_confirmation?: number;
  enable_verification?: number;
  verification_workflow_id?: string | null;
  verification_params?: string | null;
  verification_timeout_seconds?: number;
  enable_rollback?: number;
  rollback_workflow_id?: string | null;
  rollback_on_failure?: number;
  enabled?: number;
}

// ── repository 实现 ──

export const remediationPolicyRepository = {
  /**
   * 按 ID 查询策略
   * 对应：remediationService.getPolicy / AlertProcessor.getOrCreatePolicy 重查
   */
  getById(id: string): RemediationPolicyRecord | undefined {
    return db.prepare('SELECT * FROM remediation_policies WHERE id = ?').get(id) as RemediationPolicyRecord | undefined;
  },

  /**
   * 列表查询（支持 enabled / alert_source 过滤 + 分页）
   * 对应：remediationService.listPolicies
   */
  list(filters: RemediationPolicyListFilters = {}): RemediationPolicyRecord[] {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filters.enabled !== undefined) {
      conditions.push('enabled = ?');
      params.push(filters.enabled);
    }
    if (filters.alert_source !== undefined) {
      conditions.push('alert_source = ?');
      params.push(filters.alert_source);
    }

    let sql = `SELECT * FROM remediation_policies WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    if (filters.limit !== undefined) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, filters.offset || 0);
    }

    return db.prepare(sql).all(...params) as RemediationPolicyRecord[];
  },

  /**
   * 计数查询（与 list 使用相同过滤条件）
   * 对应：remediationService.listPolicies 的 COUNT
   */
  countAll(filters: RemediationPolicyListFilters = {}): number {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filters.enabled !== undefined) {
      conditions.push('enabled = ?');
      params.push(filters.enabled);
    }
    if (filters.alert_source !== undefined) {
      conditions.push('alert_source = ?');
      params.push(filters.alert_source);
    }

    const sql = `SELECT COUNT(*) as count FROM remediation_policies WHERE ${conditions.join(' AND ')}`;
    return (db.prepare(sql).get(...params) as { count: number }).count;
  },

  /**
   * 策略总数（无过滤）
   * 对应：dashboardRoutes / initRemediationPolicies / database.ts 的 COUNT
   */
  count(): number {
    return (db.prepare('SELECT COUNT(*) as count FROM remediation_policies').get() as { count: number }).count;
  },

  /**
   * 启用策略数
   * 对应：dashboardRoutes.remediation-stats
   */
  countEnabled(): number {
    return (db.prepare('SELECT COUNT(*) as count FROM remediation_policies WHERE enabled = 1').get() as { count: number }).count;
  },

  /**
   * 创建策略（完整 24 字段 INSERT）
   * 对应：remediationService.createPolicy
   */
  create(input: RemediationPolicyCreateInput): void {
    db.prepare(`
      INSERT INTO remediation_policies (
        id, name, description, alert_source, alert_severity, alert_keywords, alert_tags,
        execution_mode, workflow_id, workflow_params, max_executions_per_hour, cooldown_seconds,
        require_confirmation, enable_verification, verification_workflow_id, verification_params,
        verification_timeout_seconds, enable_rollback, rollback_workflow_id, rollback_on_failure,
        enabled, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id, input.name, input.description ?? null, input.alert_source,
      input.alert_severity ?? null, input.alert_keywords ?? null, input.alert_tags ?? null,
      input.execution_mode, input.workflow_id, input.workflow_params ?? null,
      input.max_executions_per_hour ?? 3, input.cooldown_seconds ?? 300,
      input.require_confirmation ?? 0, input.enable_verification ?? 0,
      input.verification_workflow_id ?? null, input.verification_params ?? null,
      input.verification_timeout_seconds ?? 300, input.enable_rollback ?? 0,
      input.rollback_workflow_id ?? null, input.rollback_on_failure ?? 0,
      input.enabled ?? 1, input.created_by ?? null
    );
  },

  /**
   * AlertProcessor 自动创建临时策略（最小 10 字段 INSERT）
   * 对应：AlertProcessor.getOrCreatePolicy INSERT
   */
  createMinimal(input: RemediationPolicyMinimalInput): void {
    db.prepare(`
      INSERT INTO remediation_policies (id, name, description, alert_source, alert_severity, execution_mode, workflow_id, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now','localtime'), datetime('now','localtime'))
    `).run(input.id, input.name, input.description, input.alert_source, input.alert_severity, input.execution_mode, input.workflow_id);
  },

  /**
   * 预设种子 INSERT OR IGNORE（支持完整字段集）
   * 对应：linkRemediationWorkflows / initRemediationPolicies 的批量插入
   */
  createOrIgnore(input: RemediationPolicySeedInput): void {
    db.prepare(`
      INSERT OR IGNORE INTO remediation_policies (
        id, name, description, alert_source, alert_severity, alert_keywords, alert_tags,
        execution_mode, workflow_id, workflow_params, max_executions_per_hour, cooldown_seconds,
        enable_verification, verification_workflow_id, verification_params, verification_timeout_seconds,
        enable_rollback, rollback_workflow_id, rollback_on_failure, enabled, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id, input.name, input.description ?? null, input.alert_source,
      input.alert_severity ?? null, input.alert_keywords ?? null, input.alert_tags ?? null,
      input.execution_mode, input.workflow_id, input.workflow_params ?? null,
      input.max_executions_per_hour ?? 3, input.cooldown_seconds ?? 300,
      input.enable_verification ?? 0, input.verification_workflow_id ?? null,
      input.verification_params ?? null, input.verification_timeout_seconds ?? 300,
      input.enable_rollback ?? 0, input.rollback_workflow_id ?? null,
      input.rollback_on_failure ?? 0, input.enabled ?? 1, input.created_by ?? null
    );
  },

  /**
   * 更新策略（动态 SET，仅更新提供的字段）
   * 对应：remediationService.updatePolicy
   */
  update(id: string, fields: RemediationPolicyUpdateInput): number {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (fields.name !== undefined) { sets.push('name = ?'); params.push(fields.name); }
    if (fields.description !== undefined) { sets.push('description = ?'); params.push(fields.description); }
    if (fields.alert_source !== undefined) { sets.push('alert_source = ?'); params.push(fields.alert_source); }
    if (fields.alert_severity !== undefined) { sets.push('alert_severity = ?'); params.push(fields.alert_severity); }
    if (fields.alert_keywords !== undefined) { sets.push('alert_keywords = ?'); params.push(fields.alert_keywords); }
    if (fields.alert_tags !== undefined) { sets.push('alert_tags = ?'); params.push(fields.alert_tags); }
    if (fields.execution_mode !== undefined) { sets.push('execution_mode = ?'); params.push(fields.execution_mode); }
    if (fields.workflow_id !== undefined) { sets.push('workflow_id = ?'); params.push(fields.workflow_id); }
    if (fields.workflow_params !== undefined) { sets.push('workflow_params = ?'); params.push(fields.workflow_params); }
    if (fields.max_executions_per_hour !== undefined) { sets.push('max_executions_per_hour = ?'); params.push(fields.max_executions_per_hour); }
    if (fields.cooldown_seconds !== undefined) { sets.push('cooldown_seconds = ?'); params.push(fields.cooldown_seconds); }
    if (fields.require_confirmation !== undefined) { sets.push('require_confirmation = ?'); params.push(fields.require_confirmation); }
    if (fields.enable_verification !== undefined) { sets.push('enable_verification = ?'); params.push(fields.enable_verification); }
    if (fields.verification_workflow_id !== undefined) { sets.push('verification_workflow_id = ?'); params.push(fields.verification_workflow_id); }
    if (fields.verification_params !== undefined) { sets.push('verification_params = ?'); params.push(fields.verification_params); }
    if (fields.verification_timeout_seconds !== undefined) { sets.push('verification_timeout_seconds = ?'); params.push(fields.verification_timeout_seconds); }
    if (fields.enable_rollback !== undefined) { sets.push('enable_rollback = ?'); params.push(fields.enable_rollback); }
    if (fields.rollback_workflow_id !== undefined) { sets.push('rollback_workflow_id = ?'); params.push(fields.rollback_workflow_id); }
    if (fields.rollback_on_failure !== undefined) { sets.push('rollback_on_failure = ?'); params.push(fields.rollback_on_failure); }
    if (fields.enabled !== undefined) { sets.push('enabled = ?'); params.push(fields.enabled); }

    if (sets.length === 0) return 0;

    sets.push("updated_at = datetime('now','localtime')");
    params.push(id);

    return db.prepare(`UPDATE remediation_policies SET ${sets.join(', ')} WHERE id = ?`).run(...params).changes;
  },

  /**
   * 切换启用状态
   * 对应：remediationService.togglePolicy
   */
  setEnabled(id: string, enabled: number): number {
    return db.prepare(`UPDATE remediation_policies SET enabled = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(enabled, id).changes;
  },

  /**
   * 更新工作流绑定（预设绑定用）
   * 对应：linkRemediationWorkflows
   */
  updateWorkflowBindings(id: string, workflowId: string, verificationWorkflowId: string | null, rollbackWorkflowId: string | null): void {
    db.prepare(`
      UPDATE remediation_policies SET workflow_id = ?, verification_workflow_id = ?, rollback_workflow_id = ?, updated_at = datetime('now','localtime') WHERE id = ?
    `).run(workflowId, verificationWorkflowId, rollbackWorkflowId, id);
  },

  /**
   * 删除策略
   * 对应：remediationService.deletePolicy
   */
  delete(id: string): number {
    return db.prepare('DELETE FROM remediation_policies WHERE id = ?').run(id).changes;
  },

  // ── 策略匹配（policyEngine）──

  /**
   * 按 alert_source 匹配启用策略（含通配 '*'），按 source 精确度 + severity 排序
   * 对应：policyEngine._matchBySource
   */
  findMatchingBySource(source: string, originalSource: string): RemediationPolicyRecord[] {
    return db.prepare(`
      SELECT * FROM remediation_policies WHERE enabled = 1 AND (LOWER(alert_source) = ? OR alert_source = '*')
      ORDER BY CASE WHEN alert_source = ? THEN 0 ELSE 1 END,
        CASE alert_severity WHEN 'disaster' THEN 1 WHEN 'critical' THEN 2 WHEN 'high' THEN 3 WHEN 'warning' THEN 4 WHEN 'medium' THEN 4 WHEN 'average' THEN 4 ELSE 5 END
    `).all(source, originalSource) as RemediationPolicyRecord[];
  },

  /**
   * 查询 catch-all 策略（alert_source = '*'）
   * 对应：policyEngine.getCatchAllPolicies
   */
  findCatchAll(): RemediationPolicyRecord[] {
    return db.prepare(`
      SELECT * FROM remediation_policies WHERE enabled = 1 AND alert_source = '*'
      ORDER BY CASE alert_severity WHEN 'disaster' THEN 1 WHEN 'critical' THEN 2 WHEN 'high' THEN 3 WHEN 'warning' THEN 4 WHEN 'medium' THEN 4 WHEN 'average' THEN 4 ELSE 5 END
    `).all() as RemediationPolicyRecord[];
  },

  // ── AlertProcessor 查找 ──

  /**
   * 按 source + severity + workflowId 查找已存在的自动策略
   * 对应：AlertProcessor.getOrCreatePolicy 查找阶段
   */
  findBySourceSeverityWorkflow(source: string, severity: string, workflowId: string): RemediationPolicyRecord | undefined {
    return db.prepare(`
      SELECT * FROM remediation_policies WHERE alert_source = ? AND (alert_severity = ? OR alert_severity IS NULL) AND enabled = 1 AND workflow_id = ? LIMIT 1
    `).get(source, severity, workflowId) as RemediationPolicyRecord | undefined;
  },

  // ── MCP 工具查询 ──

  /**
   * MCP 工具列表查询（支持 enabled 过滤 + limit）
   * 对应：toolDefinitions remediation.policy.list
   */
  listForMcp(enabled?: number, limit = 20): RemediationPolicyRecord[] {
    const params: unknown[] = [];
    let sql = 'SELECT * FROM remediation_policies WHERE 1=1';
    if (enabled !== undefined) {
      sql += ' AND enabled = ?';
      params.push(enabled);
    }
    sql += ' LIMIT ?';
    params.push(limit);
    return db.prepare(sql).all(...params) as RemediationPolicyRecord[];
  },

  // ── 预设种子支持 ──

  /**
   * 列出所有策略的 id/name/workflow_id（预设绑定用）
   * 对应：linkRemediationWorkflows 加载已有策略
   */
  listIdsNamesWorkflowIds(): Array<{ id: string; name: string; workflow_id: string }> {
    return db.prepare('SELECT id, name, workflow_id FROM remediation_policies').all() as Array<{ id: string; name: string; workflow_id: string }>;
  },

  /**
   * 列出所有策略名称（去重检查用）
   * 对应：linkRemediationWorkflows 名称去重
   */
  listNames(): Array<{ name: string }> {
    return db.prepare('SELECT name FROM remediation_policies').all() as Array<{ name: string }>;
  },
};
