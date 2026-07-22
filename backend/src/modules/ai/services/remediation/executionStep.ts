/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * AI 修复服务 - 执行步骤：创建修复记录、执行工作流、持久化操作
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import { aiRemediationRepository, tasksRepo, workflowsRepo } from '../../../../repositories';
import type { AiRemediationCreateInput } from '../../../../repositories';
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
  let record: AiRemediationRecord | undefined;

  try {
    // 1. 创建修复记录（由 repository 生成 id）
    const created = aiRemediationRepository.create({
      alert_id: input.alertId,
      device_id: input.deviceId,
      device_name: input.deviceName,
      device_ip: input.deviceIp,
      diagnosis: input.diagnosis,
      remediation_commands: input.remediationCommands,
      risk_level: input.riskLevel,
    });

    record = created as unknown as AiRemediationRecord;
    logger.info(`🔧 [AI Remediation] Created record ${record.id} for alert ${input.alertId}`);

    // 2. 生成修复工作流
    const { workflow, workflowParsed } = service.generateRemediationWorkflow(input, record.id);

    // 3. 保存工作流到数据库
    const workflowId = impl_saveWorkflow(workflow);
    record.workflow_id = workflowId;
    record.workflow_id = workflowId;

    // 4. 创建任务
    const taskId = randomUUID();
    tasksRepo.createPendingWithContext({
      id: taskId,
      workflow_id: workflowId,
      name: `AI 修复: ${input.alertTitle}`,
      context: JSON.stringify({
        alert_id: input.alertId,
        device_id: input.deviceId,
        device_ip: input.deviceIp,
        remediation_id: record.id,
        risk_level: input.riskLevel,
      }),
    });
    record.task_id = taskId;

    // 5. 更新记录状态
    record.status = 'waiting_approval';
    aiRemediationRepository.update(record as any);

    // 6. 异步执行工作流（会在审批节点暂停）
    setImmediate(async () => {
      try {
        await executeWorkflow(taskId, workflowParsed, undefined, {
          alert_id: input.alertId,
          device_id: input.deviceId,
          device_ip: input.deviceIp,
          remediation_id: record!.id,
          risk_level: input.riskLevel,
        });
      } catch (err) {
        logger.error(`[AI Remediation] Workflow execution failed:`, err);
        record!.status = 'failed';
        record!.error_message = err instanceof Error ? err.message : String(err);
        aiRemediationRepository.update(record! as any);
      }
    });

    logger.info(`✅ [AI Remediation] Workflow created and executing: taskId=${taskId}, workflowId=${workflowId}`);
    return record;

  } catch (err) {
    logger.error(`[AI Remediation] Failed to create remediation:`, err);
    if (record) {
      record.status = 'failed';
      record.error_message = err instanceof Error ? err.message : String(err);
      aiRemediationRepository.update(record as any);
    }
    return record ?? null;
  }
}

/** 保存工作流到数据库 */
export function impl_saveWorkflow(workflow: Record<string, unknown>): string {
  workflowsRepo.createWithTimestamps(workflow as any);
  return workflow.id as string;
}

/** 保存修复记录 */
export function impl_saveRecord(record: AiRemediationRecord): void {
  const input: AiRemediationCreateInput = {
    alert_id: record.alert_id,
    device_id: record.device_id,
    device_name: record.device_name,
    device_ip: record.device_ip,
    diagnosis: record.diagnosis,
    remediation_commands: record.remediation_commands,
    risk_level: record.risk_level,
  };
  aiRemediationRepository.create(input);
}

/** 更新修复记录 */
export function impl_updateRecord(record: AiRemediationRecord): void {
  aiRemediationRepository.update(record as any);
}

/** 获取修复记录 */
export function impl_getRecord(id: string): AiRemediationRecord | null {
  const result = aiRemediationRepository.getById(id);
  return result as unknown as AiRemediationRecord | null;
}

/** 根据告警 ID 获取修复记录 */
export function impl_getByAlertId(alertId: string): AiRemediationRecord | null {
  const result = aiRemediationRepository.getByAlertId(alertId);
  return result as unknown as AiRemediationRecord | null;
}

/** 获取所有修复记录 */
export function impl_listRecords(limit = 50): AiRemediationRecord[] {
  const results = aiRemediationRepository.list(limit);
  return results as unknown as AiRemediationRecord[];
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
  aiRemediationRepository.update(record as any);
}