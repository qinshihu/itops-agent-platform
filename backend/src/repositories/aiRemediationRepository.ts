import db from '../models/database';
import { randomUUID } from 'crypto';

export interface AiRemediationRecord {
  id: string;
  alert_id: string;
  device_id?: string;
  device_name?: string;
  device_ip?: string;
  task_id: string | null;
  workflow_id: string | null;
  diagnosis: string;
  remediation_commands: unknown;
  risk_level: string;
  status: string;
  execution_result?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface AiRemediationCreateInput {
  alert_id: string;
  device_id?: string;
  device_name?: string;
  device_ip?: string;
  diagnosis: string;
  remediation_commands: unknown;
  risk_level: string;
}

export const aiRemediationRepository = {
  create(input: AiRemediationCreateInput): AiRemediationRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO ai_remediations (
        id, alert_id, device_id, device_name, device_ip, task_id, workflow_id,
        diagnosis, remediation_commands, risk_level, status, execution_result,
        error_message, created_at, updated_at
      ) VALUES (
        @id, @alert_id, @device_id, @device_name, @device_ip, @task_id, @workflow_id,
        @diagnosis, @remediation_commands, @risk_level, @status, @execution_result,
        @error_message, @created_at, @updated_at
      )
    `).run({
      id,
      alert_id: input.alert_id,
      device_id: input.device_id ?? null,
      device_name: input.device_name ?? null,
      device_ip: input.device_ip ?? null,
      task_id: null,
      workflow_id: null,
      diagnosis: input.diagnosis,
      remediation_commands: JSON.stringify(input.remediation_commands),
      risk_level: input.risk_level,
      status: 'pending',
      execution_result: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    });

    return this.getById(id)!;
  },

  update(record: AiRemediationRecord): void {
    db.prepare(`
      UPDATE ai_remediations SET
        task_id = @task_id,
        workflow_id = @workflow_id,
        status = @status,
        execution_result = @execution_result,
        error_message = @error_message,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: record.id,
      task_id: record.task_id,
      workflow_id: record.workflow_id,
      status: record.status,
      execution_result: record.execution_result ?? null,
      error_message: record.error_message ?? null,
      updated_at: record.updated_at,
    });
  },

  getById(id: string): AiRemediationRecord | null {
    const row = db.prepare('SELECT * FROM ai_remediations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...row,
      remediation_commands: JSON.parse((row.remediation_commands as string) || '[]'),
    } as AiRemediationRecord;
  },

  getByAlertId(alertId: string): AiRemediationRecord | null {
    const row = db.prepare(
      'SELECT * FROM ai_remediations WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(alertId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...row,
      remediation_commands: JSON.parse((row.remediation_commands as string) || '[]'),
    } as AiRemediationRecord;
  },

  list(limit = 50): AiRemediationRecord[] {
    const rows = db.prepare(
      'SELECT * FROM ai_remediations ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as Record<string, unknown>[];
    return rows.map(row => ({
      ...row,
      remediation_commands: JSON.parse((row.remediation_commands as string) || '[]'),
    })) as AiRemediationRecord[];
  },

  /** 更新状态字段（用于 finalizeWorkflow 回滚等场景） */
  updateStatusFields(id: string, status: string, executionResult?: string, errorMessage?: string): void {
    db.prepare(`
      UPDATE ai_remediations SET status = ?, execution_result = ?, error_message = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(status, executionResult ?? null, errorMessage ?? null, id);
  },
};