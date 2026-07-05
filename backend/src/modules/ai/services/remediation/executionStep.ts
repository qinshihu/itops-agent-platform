/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * AI 修复服务 - 执行步骤：创建修复记录、执行工作流、持久化操作
 * =============================================================================
 */

import { randomUUID } from 'crypto';
// eslint-disable-next-line no-restricted-imports
import db from '../../../../models/database';
import { logger } from '../../../../utils/logger';
import { executeWorkflow } from '../../../workflow/services/workflowExecutor';
import type { AiRemediationInput, AiRemediationRecord } from './aiRemediationService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { WorkflowParsed } from '../../../../types';

// 前向声明：由主类注入
let _service: unknown = null;

export function setServiceInstance(svc: unknown): void {
  _service = svc;
}

/**
 * 根据 AI 分析结果创建修复工作流并执行
 */
export async function impl_createAndExecute(
  service: any,
  input: AiRemediationInput
): Promise<AiRemediationRecord | null> {
  const id = randomUUID();
  const now = new Date().toISOString();

  const record: AiRemediationRecord = {
    id,
    alert_id: input.alertId,
    device_id: input.deviceId,
    device_name: input.deviceName,
    device_ip: input.deviceIp,
    task_id: null,
    workflow_id: null,
    diagnosis: input.diagnosis,
    remediation_commands: input.remediationCommands,
    risk_level: input.riskLevel,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  try {
    // 1. 保存修复记录
    impl_saveRecord(record);
    logger.info(`🔧 [AI Remediation] Created record ${id} for alert ${input.alertId}`);

    // 2. 生成修复工作流
    const { workflow, workflowParsed } = service.generateRemediationWorkflow(input, id);

    // 3. 保存工作流到数据库
    const workflowId = impl_saveWorkflow(workflow);
    record.workflow_id = workflowId;
    record.workflow_id = workflowId;

    // 4. 创建任务
    const taskId = randomUUID();
    db.prepare(`
      INSERT INTO tasks (id, workflow_id, name, status, context, created_at)
      VALUES (?, ?, ?, 'pending', ?, datetime('now','localtime'))
    `).run(
      taskId,
      workflowId,
      `AI 修复: ${input.alertTitle}`,
      JSON.stringify({
        alert_id: input.alertId,
        device_id: input.deviceId,
        device_ip: input.deviceIp,
        remediation_id: id,
        risk_level: input.riskLevel,
      })
    );
    record.task_id = taskId;

    // 5. 更新记录状态
    record.status = 'waiting_approval';
    impl_updateRecord(record);

    // 6. 异步执行工作流（会在审批节点暂停）
    setImmediate(async () => {
      try {
        await executeWorkflow(taskId, workflowParsed, undefined, {
          alert_id: input.alertId,
          device_id: input.deviceId,
          device_ip: input.deviceIp,
          remediation_id: id,
          risk_level: input.riskLevel,
        });
      } catch (err) {
        logger.error(`[AI Remediation] Workflow execution failed:`, err);
        record.status = 'failed';
        record.error_message = err instanceof Error ? err.message : String(err);
        impl_updateRecord(record);
      }
    });

    logger.info(`✅ [AI Remediation] Workflow created and executing: taskId=${taskId}, workflowId=${workflowId}`);
    return record;

  } catch (err) {
    logger.error(`[AI Remediation] Failed to create remediation:`, err);
    record.status = 'failed';
    record.error_message = err instanceof Error ? err.message : String(err);
    impl_updateRecord(record);
    return record;
  }
}

/** 保存工作流到数据库 */
export function impl_saveWorkflow(workflow: Record<string, unknown>): string {
  db.prepare(`
    INSERT INTO workflows (id, name, description, nodes, edges, agent_configs, is_template, created_at, updated_at)
    VALUES (@id, @name, @description, @nodes, @edges, @agent_configs, @is_template, @created_at, @updated_at)
  `).run(workflow);
  return workflow.id as string;
}

/** 保存修复记录 */
export function impl_saveRecord(record: AiRemediationRecord): void {
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
    ...record,
    remediation_commands: JSON.stringify(record.remediation_commands),
  });
}

/** 更新修复记录 */
export function impl_updateRecord(record: AiRemediationRecord): void {
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
    ...record,
    remediation_commands: JSON.stringify(record.remediation_commands),
  });
}

/** 获取修复记录 */
export function impl_getRecord(id: string): AiRemediationRecord | null {
  const row = db.prepare('SELECT * FROM ai_remediations WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    ...row,
    remediation_commands: JSON.parse(row.remediation_commands || '[]'),
  };
}

/** 根据告警 ID 获取修复记录 */
export function impl_getByAlertId(alertId: string): AiRemediationRecord | null {
  const row = db.prepare('SELECT * FROM ai_remediations WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1').get(alertId) as any;
  if (!row) return null;
  return {
    ...row,
    remediation_commands: JSON.parse(row.remediation_commands || '[]'),
  };
}

/** 获取所有修复记录 */
export function impl_listRecords(limit = 50): AiRemediationRecord[] {
  const rows = db.prepare('SELECT * FROM ai_remediations ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
  return rows.map(row => ({
    ...row,
    remediation_commands: JSON.parse(row.remediation_commands || '[]'),
  }));
}

/** 更新修复状态（由工作流执行器调用） */
export function impl_updateStatus(
  service: any,
  remediationId: string,
  status: AiRemediationRecord['status'],
  result?: string
): void {
  const record = impl_getRecord(remediationId);
  if (!record) return;
  record.status = status;
  if (result) record.execution_result = result;
  record.updated_at = new Date().toISOString();
  impl_updateRecord(record);
}