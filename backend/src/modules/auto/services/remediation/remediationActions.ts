import { v4 as uuidv4 } from 'uuid';
import { remediationAuditRepository, knowledgeRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { executeCommand } from '../../../servers/services/sshService';
import { rootCauseAnalysisService } from '../../../ai/services/rca/rootCauseAnalysisService';
import type { RemediationAudit } from '../../../../repositories/types/auto';

interface CreateAuditInput {
  rca_id: string;
  policy_id?: string;
  server_id: string;
  risk_level: string;
  recommendations?: string;
}

/** remediation_audits + root_cause_analyses + remediation_policies JOIN 查询结果 */
interface RemediationAuditRow extends RemediationAudit {
  rca_title?: string;
  policy_name?: string;
}

interface VerificationResult {
  allPassed?: boolean;
  checks?: Array<{ name: string; success: boolean; output: string }>;
  success?: boolean;
  error?: string;
}

interface AuditListResult {
  audits: RemediationAuditRow[];
  total: number;
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

  createAudit(input: CreateAuditInput): RemediationAuditRow {
    const id = uuidv4();
    const now = new Date().toISOString();

    remediationAuditRepository.create({
      id,
      rca_id: input.rca_id,
      policy_id: input.policy_id || null,
      server_id: input.server_id,
      risk_level: input.risk_level,
      status: 'pending',
      created_at: now,
    });

    const audit = remediationAuditRepository.getByIdWithJoins(id);
    return (audit || {}) as RemediationAuditRow;
  },

  approveAudit(id: string, userId: string, action?: string, _comment?: string): RemediationAuditRow {
    const audit = remediationAuditRepository.getById(id);
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    if ((audit.status as string) !== 'pending') {
      throw new Error('Audit is not in pending state');
    }

    const now = new Date().toISOString();
    const newStatus = action === 'reject' ? 'rejected' : 'approved';

    remediationAuditRepository.update(id, {
      status: newStatus,
      approved_by: userId,
      approved_at: now,
      completed_at: now,
    });

    const updated = remediationAuditRepository.getByIdWithJoins(id);
    return (updated || {}) as RemediationAuditRow;
  },

  async executeAudit(id: string): Promise<RemediationAuditRow> {
    const audit = remediationAuditRepository.getById(id) as RemediationAuditRow | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    const status = audit.status as string;
    if (status !== 'approved' && status !== 'pending') {
      throw new Error('Audit must be approved or pending before execution');
    }

    remediationAuditRepository.update(id, { status: 'executing' });

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

      remediationAuditRepository.update(id, {
        status: finalStatus,
        execution_log: executionLog,
        result: JSON.stringify({ success, recommendations }),
        completed_at: now,
      });

      if (success) {
        this.persistToKnowledge(id).catch(err => {
          logger.warn('Failed to persist to knowledge:', err);
        });
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Audit execution ${id} failed:`, error);

      remediationAuditRepository.update(id, {
        status: 'failed',
        execution_log: executionLog + `\nError: ${errorMsg}`,
        result: JSON.stringify({ success: false, error: errorMsg }),
        completed_at: new Date().toISOString(),
      });
    }

    const updated = remediationAuditRepository.getByIdWithJoins(id);
    return (updated || {}) as RemediationAuditRow;
  },

  async verifyAudit(id: string): Promise<RemediationAuditRow> {
    const audit = remediationAuditRepository.getById(id) as RemediationAuditRow | undefined;
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }

    if ((audit.status as string) !== 'success') {
      throw new Error('Audit must be successfully executed before verification');
    }

    const serverId = audit.server_id as string;
    const _rca = audit.rca_id ? rootCauseAnalysisService.get(audit.rca_id as string) : null;

    let verificationResult: VerificationResult = {};

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

      remediationAuditRepository.update(id, {
        result: JSON.stringify({ ...(audit.result ? JSON.parse(audit.result as string) : {}), verification: verificationResult }),
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Audit verification ${id} failed:`, error);
      verificationResult = { success: false, error: errorMsg };
    }

    const updated = remediationAuditRepository.getByIdWithJoins(id);
    return (updated || {}) as RemediationAuditRow;
  },

  async rollbackAudit(id: string): Promise<RemediationAuditRow> {
    const audit = remediationAuditRepository.getById(id) as RemediationAuditRow | undefined;
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

      remediationAuditRepository.update(id, {
        status: success ? 'rolled_back' : 'failed',
        execution_log: rollbackLog,
        result: JSON.stringify({ success, rollback: true }),
        is_rollback: 1,
        completed_at: now,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Audit rollback ${id} failed:`, error);

      remediationAuditRepository.update(id, {
        status: 'failed',
        execution_log: rollbackLog + `\nError: ${errorMsg}`,
        result: JSON.stringify({ success: false, rollback: true, error: errorMsg }),
        is_rollback: 1,
        completed_at: now,
      });
    }

    const updated = remediationAuditRepository.getByIdWithJoins(id);
    return (updated || {}) as RemediationAuditRow;
  },

  async persistToKnowledge(auditId: string): Promise<void> {
    const audit = remediationAuditRepository.getById(auditId) as RemediationAuditRow | undefined;
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

    knowledgeRepository.create({
      id: uuidv4(),
      title,
      category: 'auto_remediation',
      content,
      tags: JSON.stringify(['auto_generated', 'remediation']),
      solutions: JSON.stringify(rca.recommendations ? JSON.parse(rca.recommendations) : []),
    });

    logger.info(`Persisted audit ${auditId} to knowledge base`);
  },

  listAudits(filters: { status?: string; risk_level?: string; page?: number; limit?: number }): AuditListResult {
    const result = remediationAuditRepository.listWithJoins({
      status: filters.status,
      risk_level: filters.risk_level,
      page: filters.page,
      limit: filters.limit,
    });
    return { audits: result.audits as RemediationAuditRow[], total: result.total };
  },

  getAudit(id: string): RemediationAuditRow {
    const audit = remediationAuditRepository.getByIdWithJoins(id);
    if (!audit) {
      throw new Error(`Audit not found: ${id}`);
    }
    return audit as RemediationAuditRow;
  },
};
