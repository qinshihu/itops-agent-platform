import { v4 as uuidv4 } from 'uuid';
import db from '../models/database';
import { executeWorkflow } from './workflowExecutor';
import { notificationService } from './notificationService';
import { executeCommand } from './sshService';
import { rootCauseAnalysisService } from './rootCauseAnalysisService';
import { logger } from '../utils/logger';
import type { RemediationPolicy, RemediationExecution, PolicyStats, WorkflowNode, WorkflowEdge, WorkflowParsed } from '../types';

interface CreateAuditInput {
  rca_id: string;
  policy_id?: string;
  server_id: string;
  risk_level: string;
  recommendations?: string;
}

class RemediationService {
  private initialized = false;

  private readonly COMMAND_WHITELIST = new Set([
    'systemctl', 'service', 'docker', 'restart', 'stop', 'start', 'kill',
    'sed', 'awk', 'chmod', 'chown', 'grep', 'cat', 'df', 'free',
    'uptime', 'top', 'ps', 'netstat', 'ss', 'ping', 'wget', 'curl',
    'tar', 'rm', 'mv', 'cp', 'mkdir'
  ]);

  private readonly DANGEROUS_PATTERNS = [
    /\|/, /;/, /`/, /\$\(/, /&&/, /\|\|/, />/, /</, /\.\./
  ];

  private readonly DANGEROUS_COMMANDS = [
    'rm -rf /', 'chmod 777 /', 'mkfs', 'fdisk', 'dd if=',
    'rm -rf /*', 'chmod -R 777 /', 'mkfs.', 'fdisk '
  ];

  private validateCommand(command: string): { valid: boolean; error?: string } {
    if (!command || command.trim().length === 0) {
      return { valid: false, error: 'Empty command' };
    }

    const trimmed = command.trim();
    const cmdBase = trimmed.split(/\s+/)[0].toLowerCase();

    if (!this.COMMAND_WHITELIST.has(cmdBase)) {
      return { valid: false, error: `Command '${cmdBase}' not in whitelist` };
    }

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { valid: false, error: `Command contains dangerous character: ${pattern.source}` };
      }
    }

    for (const dangerous of this.DANGEROUS_COMMANDS) {
      if (trimmed.toLowerCase().includes(dangerous.toLowerCase())) {
        return { valid: false, error: `Command contains dangerous pattern: ${dangerous}` };
      }
    }

    return { valid: true };
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    logger.info('Auto-remediation engine initialized');
  }

  createPolicy(policy: Omit<RemediationPolicy, 'id' | 'created_at' | 'updated_at'>): RemediationPolicy {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO remediation_policies (
        id, name, description, alert_source, alert_severity,
        alert_keywords, alert_tags, execution_mode, workflow_id,
        workflow_params, max_executions_per_hour, cooldown_seconds,
        require_confirmation, enable_verification, verification_workflow_id,
        verification_params, verification_timeout_seconds, enable_rollback,
        rollback_workflow_id, rollback_on_failure, enabled, created_by,
        created_at, updated_at
      ) VALUES (
        @id, @name, @description, @alert_source, @alert_severity,
        @alert_keywords, @alert_tags, @execution_mode, @workflow_id,
        @workflow_params, @max_executions_per_hour, @cooldown_seconds,
        @require_confirmation, @enable_verification, @verification_workflow_id,
        @verification_params, @verification_timeout_seconds, @enable_rollback,
        @rollback_workflow_id, @rollback_on_failure, @enabled, @created_by,
        @created_at, @updated_at
      )
    `).run({
      id,
      name: policy.name,
      description: policy.description || null,
      alert_source: policy.alert_source,
      alert_severity: policy.alert_severity || null,
      alert_keywords: policy.alert_keywords || null,
      alert_tags: policy.alert_tags || null,
      execution_mode: policy.execution_mode,
      workflow_id: policy.workflow_id || null,
      workflow_params: policy.workflow_params || null,
      max_executions_per_hour: policy.max_executions_per_hour,
      cooldown_seconds: policy.cooldown_seconds,
      require_confirmation: policy.require_confirmation || null,
      enable_verification: policy.enable_verification ? 1 : 0,
      verification_workflow_id: policy.verification_workflow_id || null,
      verification_params: policy.verification_params || null,
      verification_timeout_seconds: policy.verification_timeout_seconds,
      enable_rollback: policy.enable_rollback ? 1 : 0,
      rollback_workflow_id: policy.rollback_workflow_id || null,
      rollback_on_failure: policy.rollback_on_failure ? 1 : 0,
      enabled: policy.enabled ? 1 : 0,
      created_by: policy.created_by || null,
      created_at: now,
      updated_at: now
    });

    return this.getPolicy(id);
  }

  updatePolicy(id: string, updates: Partial<Pick<RemediationPolicy, 'name' | 'description' | 'alert_source' | 'alert_severity' | 'alert_keywords' | 'alert_tags' | 'execution_mode' | 'workflow_id' | 'workflow_params' | 'max_executions_per_hour' | 'cooldown_seconds' | 'require_confirmation' | 'enable_verification' | 'verification_workflow_id' | 'verification_params' | 'verification_timeout_seconds' | 'enable_rollback' | 'rollback_workflow_id' | 'rollback_on_failure' | 'enabled'>>): RemediationPolicy {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: Record<string, unknown> = { id, updated_at: now };

    const fieldMap: Record<string, keyof typeof updates> = {
      'name': 'name',
      'description': 'description',
      'alert_source': 'alert_source',
      'alert_severity': 'alert_severity',
      'alert_keywords': 'alert_keywords',
      'alert_tags': 'alert_tags',
      'execution_mode': 'execution_mode',
      'workflow_id': 'workflow_id',
      'workflow_params': 'workflow_params',
      'max_executions_per_hour': 'max_executions_per_hour',
      'cooldown_seconds': 'cooldown_seconds',
      'require_confirmation': 'require_confirmation',
      'enable_verification': 'enable_verification',
      'verification_workflow_id': 'verification_workflow_id',
      'verification_params': 'verification_params',
      'verification_timeout_seconds': 'verification_timeout_seconds',
      'enable_rollback': 'enable_rollback',
      'rollback_workflow_id': 'rollback_workflow_id',
      'rollback_on_failure': 'rollback_on_failure',
      'enabled': 'enabled'
    };

    for (const [dbField, key] of Object.entries(fieldMap)) {
      const value = updates[key];
      if (value !== undefined) {
        fields.push(`${dbField} = @${key}`);
        if (typeof value === 'boolean') {
          params[key] = value ? 1 : 0;
        } else {
          params[key] = value;
        }
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = @updated_at');
    const sql = `UPDATE remediation_policies SET ${fields.join(', ')} WHERE id = @id`;

    db.prepare(sql).run(params);
    return this.getPolicy(id);
  }

  deletePolicy(id: string): void {
    db.prepare('DELETE FROM remediation_policies WHERE id = ?').run(id);
    logger.info(`Deleted remediation policy: ${id}`);
  }

  getPolicy(id: string): RemediationPolicy {
    const policy = db.prepare('SELECT * FROM remediation_policies WHERE id = ?').get(id) as RemediationPolicy | undefined;
    if (!policy) {
      throw new Error(`Policy not found: ${id}`);
    }
    return policy;
  }

  listPolicies(filters: { enabled?: boolean; alert_source?: string; page?: number; limit?: number }): { policies: RemediationPolicy[]; total: number } {
    let sql = 'SELECT * FROM remediation_policies WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM remediation_policies WHERE 1=1';
    const params: unknown[] = [];

    if (filters.enabled !== undefined) {
      sql += ' AND enabled = ?';
      countSql += ' AND enabled = ?';
      params.push(filters.enabled ? 1 : 0);
    }

    if (filters.alert_source) {
      sql += ' AND alert_source = ?';
      countSql += ' AND alert_source = ?';
      params.push(filters.alert_source);
    }

    sql += ' ORDER BY created_at DESC';

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const policies = db.prepare(sql).all(...params) as RemediationPolicy[];
    const totalResult = db.prepare(countSql).get(...params) as { count: number };

    return { policies, total: totalResult.count };
  }

  togglePolicy(id: string): RemediationPolicy {
    const policy = this.getPolicy(id);
    const newEnabled = policy.enabled ? 0 : 1;
    db.prepare('UPDATE remediation_policies SET enabled = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newEnabled, id);
    return this.getPolicy(id);
  }

  /**
   * 归一化严重级别为统一数字等级，解决不同监控系统的 severity 命名差异：
   *   Zabbix:   disaster / critical / high / warning / medium / info
   *   Prometheus:critical / warning / info
   *   ES:        critical / high / medium / low
   *
   * 5=disaster  4=critical  3=high  2=warning/medium/average  1=info/low
   */
  private severityRank = new Map<string, number>([
    ['disaster', 5],
    ['critical', 4],
    ['high', 3],
    ['warning', 2],
    ['medium', 2],
    ['average', 2],
    ['info', 1],
    ['low', 1],
  ]);

  private severityMatches(policySeverity: string | null, alertSeverity: string | undefined): boolean {
    if (!policySeverity) return true;
    const pr = this.severityRank.get(policySeverity) ?? 0;
    const ar = this.severityRank.get(alertSeverity ?? '') ?? 0;
    // 策略要求 severity >= X，告警的 severity 也要 >= X
    // 例: policy=warning(2) 匹配 alert=high(3) 或 warning(2) 或 medium(2)
    //     policy=high(3) 只匹配 alert=critical(4)/high(3)
    //     policy=medium(2) 不匹配 alert=info(1)
    return ar >= pr;
  }

  async matchAlertToPolicies(alert: { id: string; source: string; severity?: string; title?: string; content?: string; tags?: string[] }): Promise<RemediationPolicy[]> {
    // 1. 先精确匹配 source（zabbix/prometheus/...）
    const specificPolicies = this._matchBySource(alert);
    if (specificPolicies.length > 0) return specificPolicies;

    // 2. 没有匹配 → 降级到 source=null 的通用策略
    const fallbackPolicies = this._matchBySource({ ...alert, source: '__any__' });
    return fallbackPolicies;
  }

  private _matchBySource(alert: { id: string; source: string; severity?: string; title?: string; content?: string; tags?: string[] }): RemediationPolicy[] {
    const policies = db.prepare(`
      SELECT * FROM remediation_policies
      WHERE enabled = 1 AND (alert_source = ? OR alert_source = '*')
      ORDER BY
        CASE
          WHEN alert_source = ? THEN 0 ELSE 1
        END,
        CASE alert_severity
          WHEN 'disaster' THEN 1
          WHEN 'critical' THEN 2
          WHEN 'high' THEN 3
          WHEN 'warning' THEN 4
          WHEN 'medium' THEN 4
          WHEN 'average' THEN 4
          ELSE 5
        END
    `).all(alert.source === '__any__' ? '*' : alert.source, alert.source) as RemediationPolicy[];

    return policies.filter(policy => {
      // 通配符匹配：策略的 alert_source 为 '*' 时匹配任意告警 source
      if (!policy.alert_source || policy.alert_source === '*') {
        // 通配符，不按 source 过滤
      } else if (policy.alert_source !== alert.source) {
        return false;
      }

      // severity 范围匹配
      if (policy.alert_severity && !this.severityMatches(policy.alert_severity, alert.severity)) {
        return false;
      }

      // 关键词匹配
      if (policy.alert_keywords) {
        try {
          const keywords = JSON.parse(policy.alert_keywords) as string[];
          // __catch_all__ 特殊标记：跳过关键词检查，无条件匹配
          if (keywords.length === 1 && keywords[0] === '__catch_all__') {
            return true;
          }
          const alertText = `${alert.title || ''} ${alert.content || ''}`.toLowerCase();
          if (!keywords.some(kw => alertText.includes(kw.toLowerCase()))) {
            return false;
          }
        } catch {
          logger.warn(`Invalid alert_keywords JSON in policy ${policy.id}`);
          return false;
        }
      }

      // 标签匹配
      if (policy.alert_tags) {
        try {
          const tags = JSON.parse(policy.alert_tags) as string[];
          if (tags.length === 1 && tags[0] === '__catch_all__') {
            return true;
          }
          const alertTags = alert.tags || [];
          if (!tags.some(t => alertTags.includes(t))) {
            return false;
          }
        } catch {
          logger.warn(`Invalid alert_tags JSON in policy ${policy.id}`);
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 获取所有可用的 catch-all 兜底策略
   */
  getCatchAllPolicies(source: string): RemediationPolicy[] {
    return db.prepare(`
      SELECT * FROM remediation_policies
      WHERE enabled = 1 AND alert_source = '*'
      ORDER BY
        CASE alert_severity
          WHEN 'disaster' THEN 1
          WHEN 'critical' THEN 2
          WHEN 'high' THEN 3
          WHEN 'warning' THEN 4
          WHEN 'medium' THEN 4
          WHEN 'average' THEN 4
          ELSE 5
        END
    `).all() as RemediationPolicy[];
  }

  private isInCooldown(policy: RemediationPolicy, alert: { id: string }): boolean {
    const result = db.prepare(`
      SELECT cooldown_until FROM remediation_cooldowns
      WHERE policy_id = ? AND alert_id = ?
    `).get(policy.id, alert.id) as { cooldown_until: string } | undefined;

    if (!result) return false;

    const now = new Date().toISOString();
    return now < result.cooldown_until;
  }

  private isRateLimited(policy: RemediationPolicy): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND created_at > ?
    `).get(policy.id, oneHourAgo) as { count: number };

    return result.count >= policy.max_executions_per_hour;
  }

  private async createSkippedExecution(policy: RemediationPolicy, alert: { id: string; source: string; severity?: string; title?: string; content?: string }, reason: string): Promise<RemediationExecution> {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO remediation_executions (
        id, policy_id, alert_id, alert_snapshot, status, status_reason, created_at
      ) VALUES (?, ?, ?, ?, 'skipped', ?, ?)
    `).run(
      id,
      policy.id,
      alert.id,
      JSON.stringify(alert),
      reason,
      now
    );

    return this.getExecution(id);
  }

  async triggerRemediation(policy: RemediationPolicy, alert: { id: string; source: string; severity?: string; title?: string; content?: string; tags?: string[] }): Promise<RemediationExecution> {
    if (this.isInCooldown(policy, alert)) {
      logger.info(`Policy ${policy.id} in cooldown for alert ${alert.id}`);
      return this.createSkippedExecution(policy, alert, 'cooldown');
    }

    if (this.isRateLimited(policy)) {
      logger.warn(`Policy ${policy.id} rate limited`);
      return this.createSkippedExecution(policy, alert, 'rate_limited');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const approvalRequired = policy.execution_mode === 'approval' ? 1 : 0;

    db.prepare(`
      INSERT INTO remediation_executions (
        id, policy_id, alert_id, alert_snapshot, status, approval_required, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      policy.id,
      alert.id,
      JSON.stringify(alert),
      approvalRequired,
      now
    );

    const execution = this.getExecution(id);

    switch (policy.execution_mode) {
      case 'auto':
        this.executeWorkflowAsync(execution.id);
        break;
      case 'approval':
        await this.requestApproval(execution);
        break;
      case 'suggestion':
        await this.sendSuggestion(execution);
        break;
    }

    return execution;
  }

  private async executeWorkflowAsync(executionId: string): Promise<void> {
    try {
      await this.executeWorkflow(executionId);
    } catch (error) {
      logger.error(`Async workflow execution failed for ${executionId}:`, error);
    }
  }

  async executeWorkflow(executionId: string): Promise<void> {
    const execution = this.getExecution(executionId);
    const policy = this.getPolicy(execution.policy_id);
    const alert = JSON.parse(execution.alert_snapshot || '{}');

    if (!policy.workflow_id) {
      this.updateExecutionStatus(executionId, 'failed', 'No workflow configured');
      return;
    }

    this.updateExecution(executionId, { status: 'running', started_at: new Date().toISOString() });
    const startTime = Date.now();

    try {
      const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(policy.workflow_id) as {
        id: string; name: string; description: string; nodes: string; edges: string; agent_configs: string; is_template: number; created_at: string; updated_at: string;
      } | undefined;

      if (!workflow) {
        this.updateExecutionStatus(executionId, 'failed', 'Workflow not found');
        return;
      }

      const taskId = uuidv4();
      const params = this.resolveParams(policy.workflow_params, alert);

      db.prepare(`
        INSERT INTO tasks (id, workflow_id, name, status, context, created_at)
        VALUES (?, ?, ?, 'pending', ?, datetime('now','localtime'))
      `).run(taskId, workflow.id, `自动修复: ${workflow.name}`, JSON.stringify(params));

      let nodes: WorkflowNode[] = [];
      let edges: WorkflowEdge[] = [];
      let agentConfigs = {};

      try {
        nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes;
        edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges;
        agentConfigs = workflow.agent_configs
          ? (typeof workflow.agent_configs === 'string' ? JSON.parse(workflow.agent_configs) : workflow.agent_configs)
          : {};
      } catch (error) {
        this.updateExecutionStatus(executionId, 'failed', 'Invalid workflow format');
        logger.error(`Failed to parse workflow ${workflow.id}:`, error);
        return;
      }

      const parsedWorkflow: WorkflowParsed = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        nodes,
        edges,
        agent_configs: agentConfigs,
        is_template: workflow.is_template,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at
      };

      await executeWorkflow(taskId, parsedWorkflow, undefined, params);

      this.updateExecution(executionId, {
        workflow_execution_id: taskId,
        execution_result: JSON.stringify({ taskId }),
        completed_at: new Date().toISOString(),
        execution_duration_ms: Date.now() - startTime
      });

      if (policy.enable_verification && policy.verification_workflow_id) {
        await this.verifyResult(executionId);
      } else {
        this.updateExecutionStatus(executionId, 'success');
        this.resolveAlert(execution.alert_id);
        this.notifySelfHeal(execution.alert_id, alert?.title);
        this.updateCooldown(policy, alert);
        this.recordHistory(execution, policy, 'success');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Remediation execution ${executionId} failed:`, error);

      this.updateExecution(executionId, {
        status: 'failed',
        status_reason: errorMsg,
        completed_at: new Date().toISOString(),
        execution_duration_ms: Date.now() - startTime
      });

      this.recordHistory(execution, policy, 'failed', errorMsg);

      if (policy.enable_rollback && policy.rollback_on_failure && policy.rollback_workflow_id) {
        await this.rollbackExecution(executionId);
      }
    }
  }

  async verifyResult(executionId: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const execution = this.getExecution(executionId);
    const policy = this.getPolicy(execution.policy_id);
    const alert = JSON.parse(execution.alert_snapshot || '{}');

    this.updateExecution(executionId, { verification_status: 'pending' });

    try {
      const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(policy.verification_workflow_id!) as {
        id: string; name: string; description: string; nodes: string; edges: string; agent_configs: string; is_template: number; created_at: string; updated_at: string;
      } | undefined;

      if (!workflow) {
        throw new Error('Verification workflow not found');
      }

      const params = this.resolveParams(policy.verification_params, alert);
      const timeout = policy.verification_timeout_seconds * 1000;
      const taskId = uuidv4();

      db.prepare(`
        INSERT INTO tasks (id, workflow_id, name, status, context, created_at)
        VALUES (?, ?, ?, 'pending', ?, datetime('now','localtime'))
      `).run(taskId, workflow.id, `修复验证: ${workflow.name}`, JSON.stringify(params));

      let nodes: WorkflowNode[] = [];
      let edges: WorkflowEdge[] = [];
      let agentConfigs = {};

      try {
        nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes;
        edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges;
        agentConfigs = workflow.agent_configs
          ? (typeof workflow.agent_configs === 'string' ? JSON.parse(workflow.agent_configs) : workflow.agent_configs)
          : {};
      } catch {
        throw new Error('Invalid verification workflow format');
      }

      const parsedWorkflow: WorkflowParsed = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        nodes,
        edges,
        agent_configs: agentConfigs,
        is_template: workflow.is_template,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at
      };

      const result = await Promise.race([
        executeWorkflow(taskId, parsedWorkflow, undefined, params),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), timeout)
        )
      ]);

      this.updateExecution(executionId, {
        verification_status: 'success',
        verification_result: JSON.stringify(result),
        verification_completed_at: new Date().toISOString(),
        status: 'success'
      });

      this.resolveAlert(execution.alert_id);
      this.notifySelfHeal(execution.alert_id, alert?.title);
      this.updateCooldown(policy, alert);
      this.recordHistory(execution, policy, 'success');

      return { success: true, result };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Verification failed for execution ${executionId}:`, error);

      this.updateExecution(executionId, {
        verification_status: 'failed',
        verification_result: JSON.stringify({ error: errorMsg }),
        verification_completed_at: new Date().toISOString()
      });

      this.recordHistory(execution, policy, 'failed', errorMsg);

      if (policy.enable_rollback && policy.rollback_workflow_id) {
        await this.rollbackExecution(executionId);
      }

      return { success: false, error: errorMsg };
    }
  }

  async rollbackExecution(executionId: string): Promise<void> {
    const execution = this.getExecution(executionId);
    const policy = this.getPolicy(execution.policy_id);

    if (!policy.rollback_workflow_id) {
      logger.warn(`No rollback workflow configured for policy ${policy.id}`);
      return;
    }

    logger.warn(`Rolling back execution ${executionId}`);

    try {
      const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(policy.rollback_workflow_id) as {
        id: string; name: string; description: string; nodes: string; edges: string; agent_configs: string; is_template: number; created_at: string; updated_at: string;
      } | undefined;

      if (!workflow) {
        throw new Error('Rollback workflow not found');
      }

      const taskId = uuidv4();
      db.prepare(`
        INSERT INTO tasks (id, workflow_id, name, status, context, created_at)
        VALUES (?, ?, ?, 'pending', ?, datetime('now','localtime'))
      `).run(taskId, workflow.id, `回滚: ${workflow.name}`, JSON.stringify({ execution_id: executionId }));

      const parsedWorkflow: WorkflowParsed = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        nodes: typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) as WorkflowNode[] : workflow.nodes,
        edges: typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) as WorkflowEdge[] : workflow.edges,
        agent_configs: workflow.agent_configs ? (typeof workflow.agent_configs === 'string' ? JSON.parse(workflow.agent_configs) : workflow.agent_configs) : {},
        is_template: workflow.is_template,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at
      };

      const result = await executeWorkflow(taskId, parsedWorkflow);

      this.updateExecution(executionId, {
        rollback_triggered: 1,
        rollback_execution_id: taskId,
        rollback_result: JSON.stringify(result),
        rollback_completed_at: new Date().toISOString(),
        status: 'rolled_back'
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Rollback failed for execution ${executionId}:`, error);

      this.updateExecution(executionId, {
        rollback_triggered: 1,
        rollback_result: JSON.stringify({ error: errorMsg }),
        rollback_completed_at: new Date().toISOString()
      });
    }
  }

  async approveExecution(executionId: string, action: 'approve' | 'reject', userId: string, comment?: string): Promise<void> {
    const execution = this.getExecution(executionId);

    if (execution.status !== 'waiting_approval') {
      throw new Error('Execution is not waiting for approval');
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      this.updateExecution(executionId, {
        status: 'approved',
        approved_by: userId,
        approved_at: now,
        approval_comment: comment
      });

      this.executeWorkflowAsync(executionId);
    } else {
      this.updateExecution(executionId, {
        status: 'rejected',
        approved_by: userId,
        approved_at: now,
        approval_comment: comment,
        completed_at: now
      });
    }
  }

  async retryExecution(executionId: string): Promise<void> {
    const execution = this.getExecution(executionId);

    if (execution.status !== 'failed' && execution.status !== 'rejected') {
      throw new Error('Only failed or rejected executions can be retried');
    }

    this.updateExecution(executionId, {
      status: 'pending' as any,
      workflow_execution_id: undefined,
      started_at: undefined,
      completed_at: undefined,
      execution_result: undefined,
      verification_status: undefined,
      verification_result: undefined,
      verification_completed_at: undefined,
      rollback_triggered: 0,
      rollback_execution_id: undefined,
      rollback_completed_at: undefined,
      rollback_result: undefined,
      execution_duration_ms: undefined
    });

    this.executeWorkflowAsync(executionId);
  }

  getExecution(id: string): RemediationExecution {
    const execution = db.prepare('SELECT * FROM remediation_executions WHERE id = ?').get(id) as RemediationExecution | undefined;
    if (!execution) {
      throw new Error(`Execution not found: ${id}`);
    }
    return execution;
  }

  listExecutions(filters: { policy_id?: string; alert_id?: string; status?: string; page?: number; limit?: number }): { executions: RemediationExecution[]; total: number } {
    let sql = 'SELECT * FROM remediation_executions WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM remediation_executions WHERE 1=1';
    const params: unknown[] = [];

    if (filters.policy_id) {
      sql += ' AND policy_id = ?';
      countSql += ' AND policy_id = ?';
      params.push(filters.policy_id);
    }

    if (filters.alert_id) {
      sql += ' AND alert_id = ?';
      countSql += ' AND alert_id = ?';
      params.push(filters.alert_id);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const executions = db.prepare(sql).all(...params) as RemediationExecution[];
    const totalResult = db.prepare(countSql).get(...params) as { count: number };

    return { executions, total: totalResult.count };
  }

  async getPolicyStats(policyId: string, days: number): Promise<PolicyStats> {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };

    const successResult = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND status = 'success' AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };

    const failedResult = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND status = 'failed' AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };

    const rolledBackResult = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND status = 'rolled_back' AND created_at > ?
    `).get(policyId, sinceDate) as { count: number };

    const avgDurationResult = db.prepare(`
      SELECT AVG(execution_duration_ms) as avg_duration FROM remediation_executions
      WHERE policy_id = ? AND execution_duration_ms IS NOT NULL AND created_at > ?
    `).get(policyId, sinceDate) as { avg_duration: number | null };

    const total = totalResult.count;
    const successRate = total > 0 ? (successResult.count / total) * 100 : 0;

    const dailyStats = db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as triggers,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM remediation_executions
      WHERE policy_id = ? AND created_at > ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(policyId, sinceDate) as Array<{ date: string; triggers: number; success: number; failed: number }>;

    return {
      total_triggers: total,
      success_count: successResult.count,
      failed_count: failedResult.count,
      rolled_back_count: rolledBackResult.count,
      success_rate: Math.round(successRate * 100) / 100,
      avg_duration_ms: avgDurationResult.avg_duration ? Math.round(avgDurationResult.avg_duration) : 0,
      top_root_causes: [],
      daily_stats: dailyStats
    };
  }

  private resolveParams(paramsJson: string | undefined, alert: Record<string, unknown>): Record<string, unknown> {
    if (!paramsJson) return {};

    let params: Record<string, unknown>;
    try {
      params = JSON.parse(paramsJson);
    } catch {
      return {};
    }

    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = value.replace(/\{\{alert\.(\w+)\}\}/g, (_match, prop) => {
          const val = alert[prop];
          return val !== undefined && val !== null ? String(val) : '';
        });
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private async requestApproval(execution: RemediationExecution): Promise<void> {
    this.updateExecution(execution.id, { status: 'waiting_approval' });

    const policy = this.getPolicy(execution.policy_id);
    const alert = JSON.parse(execution.alert_snapshot || '{}');

    try {
      await notificationService.sendNotification({
        type: 'remediation_approval',
        title: '修复审批请求',
        content: `策略: ${policy.name}\n告警: ${alert.title || alert.content || 'Unknown'}\n请审批执行`,
        related_alert_id: execution.alert_id
      });
    } catch (error) {
      logger.error('Failed to send approval notification:', error);
    }
  }

  private async sendSuggestion(execution: RemediationExecution): Promise<void> {
    this.updateExecution(execution.id, { status: 'success', status_reason: 'suggestion_sent' });

    const policy = this.getPolicy(execution.policy_id);
    const alert = JSON.parse(execution.alert_snapshot || '{}');

    try {
      await notificationService.sendNotification({
        type: 'remediation_suggestion',
        title: '修复建议',
        content: `策略: ${policy.name}\n告警: ${alert.title || alert.content || 'Unknown'}\n建议执行修复操作`,
        related_alert_id: execution.alert_id
      });
    } catch (error) {
      logger.error('Failed to send suggestion notification:', error);
    }
  }

  private updateExecutionStatus(id: string, status: RemediationExecution['status'], reason?: string): void {
    const fields: string[] = ['status = ?'];
    const params: unknown[] = [status];

    if (reason) {
      fields.push('status_reason = ?');
      params.push(reason);
    }

    if (['success', 'failed', 'rolled_back', 'rejected', 'skipped'].includes(status)) {
      fields.push('completed_at = ?');
      params.push(new Date().toISOString());
    }

    if (status === 'running') {
      fields.push('started_at = ?');
      params.push(new Date().toISOString());
    }

    params.push(id);
    db.prepare(`UPDATE remediation_executions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }

  private updateExecution(id: string, updates: Partial<RemediationExecution>): void {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = @${key}`);
        params[key] = value;
      }
    }

    if (fields.length === 0) return;

    const sql = `UPDATE remediation_executions SET ${fields.join(', ')} WHERE id = @id`;
    db.prepare(sql).run(params);
  }

  private resolveAlert(alertId: string): void {
    try {
      const result = db.prepare(`
        UPDATE alerts SET status = 'resolved', updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(alertId);
      if (result.changes > 0) {
        logger.info(`Alert ${alertId} marked as resolved by auto-remediation`);
      }
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
    }
  }

  private updateCooldown(policy: RemediationPolicy, alert: Record<string, unknown>): void {
    if (alert.id && typeof alert.id === 'string') {
      const cooldownUntil = new Date(Date.now() + policy.cooldown_seconds * 1000).toISOString();
      db.prepare(`
        INSERT INTO remediation_cooldowns (policy_id, alert_id, cooldown_until)
        VALUES (?, ?, ?)
        ON CONFLICT (policy_id, alert_id) DO UPDATE SET cooldown_until = excluded.cooldown_until, created_at = datetime('now','localtime')
      `).run(policy.id, alert.id, cooldownUntil);
    }
  }

  private recordHistory(execution: RemediationExecution, policy: RemediationPolicy, status: string, reason?: string): void {
    try {
      const alert = JSON.parse(execution.alert_snapshot || '{}');
      db.prepare(`
        INSERT INTO remediation_history (
          id, policy_id, alert_source, alert_severity, execution_status, resolution, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        policy.id,
        alert.source,
        alert.severity,
        status,
        reason || 'Auto-remediated',
        execution.execution_duration_ms || null
      );
    } catch (error) {
      logger.error('Failed to record remediation history:', error);
    }
  }

  async cleanupOldExecutions(days: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      DELETE FROM remediation_executions WHERE created_at < ?
    `).run(cutoffDate);
    logger.info(`Cleaned up ${result.changes} old remediation executions`);
  }

  createAudit(input: CreateAuditInput): Record<string, unknown> {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO remediation_audits (
        id, rca_id, policy_id, server_id, risk_level,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.rca_id,
      input.policy_id || null,
      input.server_id,
      input.risk_level,
      'pending',
      now
    );

    const audit = db.prepare(`
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      WHERE a.id = ?
    `).get(id) as Record<string, unknown>;

    return audit || {};
  }

  approveAudit(id: string, userId: string, action?: string, comment?: string): Record<string, unknown> {
    const audit = db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    if ((audit.status as string) !== 'pending') {
      throw new Error('Audit is not in pending state');
    }

    const now = new Date().toISOString();
    const newStatus = action === 'reject' ? 'rejected' : 'approved';

    db.prepare(`
      UPDATE remediation_audits
      SET status = ?, approved_by = ?, approved_at = ?, completed_at = ?
      WHERE id = ?
    `).run(newStatus, userId, now, now, id);

    const updated = db.prepare(`
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      WHERE a.id = ?
    `).get(id) as Record<string, unknown>;

    return updated || {};
  }

  async executeAudit(id: string): Promise<Record<string, unknown>> {
    const audit = db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    const status = audit.status as string;
    if (status !== 'approved' && status !== 'pending') {
      throw new Error('Audit must be approved or pending before execution');
    }

    db.prepare(`
      UPDATE remediation_audits SET status = 'executing' WHERE id = ?
    `).run(id);

    const startTime = Date.now();
    const serverId = audit.server_id as string;
    const rca = audit.rca_id ? rootCauseAnalysisService.get(audit.rca_id as string) : null;
    const recommendations = rca?.recommendations ? JSON.parse(rca.recommendations) : [];

    let executionLog = '';
    let success = true;

    try {
      for (const rec of recommendations) {
        let commandToExecute = '';

        // 解析 recommendation 对象或字符串
        if (typeof rec === 'object' && rec !== null) {
          // 结构化 recommendation 对象
          const steps = rec.steps as string[] | undefined;
          const autoExecutable = rec.auto_executable as boolean | undefined;

          if (autoExecutable && steps && steps.length > 0) {
            // 提取第一个可执行命令步骤
            commandToExecute = steps.find(s =>
              s.includes('restart') || s.includes('stop') || s.includes('start') ||
              s.includes('kill') || s.includes('chmod') || s.includes('chown') ||
              s.includes('systemctl') || s.includes('service') || s.includes('docker')
            ) || '';
          }
        } else if (typeof rec === 'string') {
          // 字符串形式的 recommendation
          if (rec.includes('restart') || rec.includes('stop') || rec.includes('kill')) {
            commandToExecute = rec;
          }
        }

        if (commandToExecute) {
          const validation = this.validateCommand(commandToExecute);
          if (!validation.valid) {
            logger.warn(`🚫 Blocked dangerous command in audit ${id}: ${commandToExecute} - ${validation.error}`);
            executionLog += `[${new Date().toISOString()}] BLOCKED: ${commandToExecute} - ${validation.error}\n\n`;
            success = false;
            continue;
          }
          logger.info(`🔧 Executing remediation command on server ${serverId}: ${commandToExecute}`);
          const result = await executeCommand(serverId, commandToExecute, { logHistory: false });
          executionLog += `[${new Date().toISOString()}] ${result.success ? 'OK' : 'FAIL'}: ${commandToExecute}\n${result.stdout || result.error || ''}\n\n`;
          if (!result.success) {
            success = false;
          }
        } else {
          executionLog += `[${new Date().toISOString()}] SKIP: No executable command found in recommendation\n`;
        }
      }

      const now = new Date().toISOString();
      const finalStatus = success ? 'success' : 'failed';

      db.prepare(`
        UPDATE remediation_audits
        SET status = ?, execution_log = ?, result = ?, completed_at = ?
        WHERE id = ?
      `).run(finalStatus, executionLog, JSON.stringify({ success, recommendations }), now, id);

      if (success) {
        this.persistToKnowledge(id).catch(err => {
          logger.warn('Failed to persist to knowledge:', err);
        });
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Audit execution ${id} failed:`, error);

      db.prepare(`
        UPDATE remediation_audits
        SET status = 'failed', execution_log = ?, result = ?, completed_at = ?
        WHERE id = ?
      `).run(executionLog + `\nError: ${errorMsg}`, JSON.stringify({ success: false, error: errorMsg }), new Date().toISOString(), id);
    }

    const updated = db.prepare(`
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      WHERE a.id = ?
    `).get(id) as Record<string, unknown>;

    return updated || {};
  }

  async verifyAudit(id: string): Promise<Record<string, unknown>> {
    const audit = db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    if ((audit.status as string) !== 'success') {
      throw new Error('Audit must be successfully executed before verification');
    }

    const serverId = audit.server_id as string;
    const rca = audit.rca_id ? rootCauseAnalysisService.get(audit.rca_id as string) : null;

    let verificationResult: Record<string, unknown> = {};

    try {
      const checks = [
        { name: 'system_load', command: 'uptime' },
        { name: 'memory', command: 'free -m' },
        { name: 'disk', command: 'df -h /' }
      ];

      const checkResults: Array<{ name: string; success: boolean; output: string }> = [];

      for (const check of checks) {
        const result = await executeCommand(serverId, check.command, { logHistory: false });
        checkResults.push({
          name: check.name,
          success: result.success,
          output: result.stdout.substring(0, 500)
        });
      }

      const allPassed = checkResults.every(r => r.success);
      verificationResult = { allPassed, checks: checkResults };

      db.prepare(`
        UPDATE remediation_audits SET result = ? WHERE id = ?
      `).run(JSON.stringify({ ...(audit.result ? JSON.parse(audit.result as string) : {}), verification: verificationResult }), id);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Audit verification ${id} failed:`, error);
      verificationResult = { success: false, error: errorMsg };
    }

    const updated = db.prepare(`
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      WHERE a.id = ?
    `).get(id) as Record<string, unknown>;

    return updated || {};
  }

  async rollbackAudit(id: string): Promise<Record<string, unknown>> {
    const audit = db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    if ((audit.status as string) !== 'success' && (audit.status as string) !== 'failed') {
      throw new Error('Audit must be completed before rollback');
    }

    if ((audit.is_rollback as number) === 1) {
      throw new Error('Audit has already been rolled back');
    }

    const serverId = audit.server_id as string;
    const rca = audit.rca_id ? rootCauseAnalysisService.get(audit.rca_id as string) : null;
    const recommendations = rca?.recommendations ? JSON.parse(rca.recommendations) : [];
    const now = new Date().toISOString();

    let rollbackLog = '';
    let success = true;

    try {
      for (const rec of recommendations) {
        let rollbackCommand = '';

        if (typeof rec === 'object' && rec !== null) {
          const rc = rec.rollback_command as string | undefined;
          if (rc) {
            rollbackCommand = rc;
          }
        }

        if (rollbackCommand) {
          const validation = this.validateCommand(rollbackCommand);
          if (!validation.valid) {
            logger.warn(`🚫 Blocked dangerous rollback command in audit ${id}: ${rollbackCommand} - ${validation.error}`);
            rollbackLog += `[${new Date().toISOString()}] BLOCKED: ${rollbackCommand} - ${validation.error}\n\n`;
            success = false;
            continue;
          }
          logger.info(`🔄 Executing rollback command on server ${serverId}: ${rollbackCommand}`);
          const result = await executeCommand(serverId, rollbackCommand, { logHistory: false });
          rollbackLog += `[${new Date().toISOString()}] ${result.success ? 'OK' : 'FAIL'}: ${rollbackCommand}\n${result.stdout || result.error || ''}\n\n`;
          if (!result.success) {
            success = false;
          }
        } else {
          rollbackLog += `[${new Date().toISOString()}] SKIP: No rollback_command found in recommendation\n`;
        }
      }

      if (!rollbackLog) {
        rollbackLog = `[${now}] No automatic rollback commands available. Manual intervention required.\n`;
      }

      db.prepare(`
        UPDATE remediation_audits
        SET status = ?, execution_log = ?, result = ?, is_rollback = 1, completed_at = ?
        WHERE id = ?
      `).run(success ? 'rolled_back' : 'failed', rollbackLog, JSON.stringify({ success, rollback: true }), now, id);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Audit rollback ${id} failed:`, error);

      db.prepare(`
        UPDATE remediation_audits
        SET status = 'failed', execution_log = ?, result = ?, is_rollback = 1, completed_at = ?
        WHERE id = ?
      `).run(rollbackLog + `\nError: ${errorMsg}`, JSON.stringify({ success: false, rollback: true, error: errorMsg }), now, id);
    }

    const updated = db.prepare(`
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      WHERE a.id = ?
    `).get(id) as Record<string, unknown>;

    return updated || {};
  }

  async persistToKnowledge(auditId: string): Promise<void> {
    const audit = db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(auditId) as Record<string, unknown> | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${auditId}`);
    }

    if ((audit.status as string) !== 'success') {
      throw new Error('Only successful audits can be persisted to knowledge');
    }

    const rca = audit.rca_id ? rootCauseAnalysisService.get(audit.rca_id as string) : null;
    if (!rca || !rca.root_cause) {
      return;
    }

    const title = `自动修复知识: ${rca.title}`;
    const content = `根因: ${rca.root_cause}\n\n执行结果: ${audit.execution_log || 'N/A'}`;

    db.prepare(`
      INSERT INTO knowledge_base (id, title, category, content, tags, solutions, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(
      uuidv4(),
      title,
      'auto_remediation',
      content,
      JSON.stringify(['auto_generated', 'remediation']),
      JSON.stringify(rca.recommendations ? JSON.parse(rca.recommendations) : []),
    );

    logger.info(`Persisted audit ${auditId} to knowledge base`);
  }

  listAudits(filters: { status?: string; risk_level?: string; page?: number; limit?: number }): { audits: Array<Record<string, unknown>>; total: number } {
    let sql = `
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as count FROM remediation_audits WHERE 1=1';
    const params: unknown[] = [];

    if (filters.status) {
      sql += ' AND a.status = ?';
      countSql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.risk_level) {
      sql += ' AND a.risk_level = ?';
      countSql += ' AND risk_level = ?';
      params.push(filters.risk_level);
    }

    sql += ' ORDER BY a.created_at DESC';

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const audits = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    const totalResult = db.prepare(countSql).get(...params) as { count: number };

    return { audits, total: totalResult.count };
  }

  getAudit(id: string): Record<string, unknown> {
    const audit = db.prepare(`
      SELECT a.*, r.title as rca_title, p.name as policy_name
      FROM remediation_audits a
      LEFT JOIN root_cause_analyses r ON a.rca_id = r.id
      LEFT JOIN remediation_policies p ON a.policy_id = p.id
      WHERE a.id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    return audit;
  }

  /** 自愈成功后通知降噪系统 */
  private notifySelfHeal(alertId: string | undefined, alertTitle: string | undefined): void {
    if (!alertId) return;
    try {
      const alert = db.prepare('SELECT source, title FROM alerts WHERE id = ?').get(alertId) as { source: string; title: string } | undefined;
      if (!alert) return;

      // 标记该告警为「已自愈」，降噪系统据此降低同类告警优先级
      db.prepare(`
        INSERT OR REPLACE INTO settings (key, value)
        VALUES (?, ?)
      `).run(
        `self_healed:${alert.source}:${alert.title}`,
        new Date().toISOString()
      );
      logger.info(`🔄 [SelfHeal] Alert ${alertId} self-healed, noise reduction updated`);
    } catch (e) {
      logger.warn('Failed to update noise reduction after self-heal:', e);
    }
  }
}

export const remediationService = new RemediationService();
