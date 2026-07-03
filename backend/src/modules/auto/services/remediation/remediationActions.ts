import { v4 as uuidv4 } from 'uuid';
import db from '../../../../models/database';
import { logger } from '../../../../utils/logger';
import { executeCommand } from '../../../servers/services/sshService';
import { rootCauseAnalysisService } from '../../../ai/services/rca/rootCauseAnalysisService';

interface CreateAuditInput {
  rca_id: string;
  policy_id?: string;
  server_id: string;
  risk_level: string;
  recommendations?: string;
}

export const remediationActionsMixin = {
  COMMAND_WHITELIST: new Set([
    'systemctl', 'service', 'docker', 'restart', 'stop', 'start', 'kill',
    'sed', 'awk', 'chmod', 'chown', 'grep', 'cat', 'df', 'free',
    'uptime', 'top', 'ps', 'netstat', 'ss', 'ping', 'wget', 'curl',
    'tar', 'rm', 'mv', 'cp', 'mkdir'
  ]),

  DANGEROUS_PATTERNS: [
    /\|/, /;/, /`/, /\$\(/, /&&/, /\|\|/, />/, /</, /\.\./
  ],

  DANGEROUS_COMMANDS: [
    'rm -rf /', 'chmod 777 /', 'mkfs', 'fdisk', 'dd if=',
    'rm -rf /*', 'chmod -R 777 /', 'mkfs.', 'fdisk '
  ],

  validateCommand(command: string): { valid: boolean; error?: string } {
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
  },

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
  },

  approveAudit(id: string, userId: string, action?: string, _comment?: string): Record<string, unknown> {
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
  },

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

    const _startTime = Date.now();
    const serverId = audit.server_id as string;
    const rca = audit.rca_id ? rootCauseAnalysisService.get(audit.rca_id as string) : null;
    const recommendations = rca?.recommendations ? JSON.parse(rca.recommendations) : [];

    let executionLog = '';
    let success = true;

    try {
      for (const rec of recommendations) {
        let commandToExecute = '';

        if (typeof rec === 'object' && rec !== null) {
          const steps = rec.steps as string[] | undefined;
          const autoExecutable = rec.auto_executable as boolean | undefined;

          if (autoExecutable && steps && steps.length > 0) {
            commandToExecute = steps.find(s =>
              s.includes('restart') || s.includes('stop') || s.includes('start') ||
              s.includes('kill') || s.includes('chmod') || s.includes('chown') ||
              s.includes('systemctl') || s.includes('service') || s.includes('docker')
            ) || '';
          }
        } else if (typeof rec === 'string') {
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
  },

  async verifyAudit(id: string): Promise<Record<string, unknown>> {
    const audit = db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    if ((audit.status as string) !== 'success') {
      throw new Error('Audit must be successfully executed before verification');
    }

    const serverId = audit.server_id as string;
    const _rca = audit.rca_id ? rootCauseAnalysisService.get(audit.rca_id as string) : null;

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
  },

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
  },

  async persistToKnowledge(auditId: string): Promise<void> {
    const audit = db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(auditId) as Record<string, unknown> | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${auditId}`);
    }

    if ((audit.status as string) !== 'success') {
      throw new Error('Only successful audits can be persisted to knowledge');
    }

    const rca = audit.rca_id ? rootCauseAnalysisService.get(audit.rca_id as string) : null;
    if (!rca?.root_cause) {
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
  },

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
  },

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
  },
};
