/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
import { executeWorkflow as runWorkflowExecutor } from '../../../workflow/services/workflowExecutor';
import { notificationService } from '../../../notification/services/notificationService';
import { logger } from '../../../../utils/logger';
import { workflowsRepo, tasksRepo, remediationAuditRepository } from '../../../../repositories';
import type {
  RemediationPolicy,
  RemediationExecution,
  WorkflowNode,
  WorkflowEdge,
  WorkflowParsed,
  RemediationAlert,
  RemediationServiceLike
} from './types';

export async function triggerRemediation(
  service: RemediationServiceLike,
  policy: RemediationPolicy,
  alert: RemediationAlert
): Promise<RemediationExecution> {
  if (service.isInCooldown(policy, alert)) {
    logger.info(`Policy ${policy.id} in cooldown for alert ${alert.id}`);
    return service.createSkippedExecution(policy, alert, 'cooldown');
  }

  if (service.isRateLimited(policy)) {
    logger.warn(`Policy ${policy.id} rate limited`);
    return service.createSkippedExecution(policy, alert, 'rate_limited');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  remediationAuditRepository.createExecution({
    id,
    policy_id: policy.id,
    alert_id: alert.id,
    alert_snapshot: JSON.stringify(alert),
    status: 'pending',
    approval_required: policy.execution_mode === 'approval' ? 1 : 0,
    created_at: now,
  });

  const execution = (service as any).getExecution(id);

  switch (policy.execution_mode) {
    case 'auto':
      executeWorkflowAsync(service, execution.id);
      break;
    case 'approval':
      await requestApproval(service, execution);
      break;
    case 'suggestion':
      await sendSuggestion(service, execution);
      break;
  }

  return execution;
}

export async function executeWorkflowAsync(service: RemediationServiceLike, executionId: string): Promise<void> {
  try {
    await executeWorkflow(service, executionId);
  } catch (error) {
    logger.error(`Async workflow execution failed for ${executionId}:`, error);
  }
}

export async function executeWorkflow(service: RemediationServiceLike, executionId: string): Promise<void> {
  const execution = (service as any).getExecution(executionId);
  const policy = service.getPolicy(execution.policy_id);
  const alert = JSON.parse(execution.alert_snapshot || '{}');

  if (!policy.workflow_id) {
    (service as any).updateExecutionStatus(executionId, 'failed', 'No workflow configured');
    return;
  }

  service.updateExecution(executionId, { status: 'running', started_at: new Date().toISOString() });
  const startTime = Date.now();

  try {
    const workflow = workflowsRepo.getById(policy.workflow_id);

    if (!workflow) {
      (service as any).updateExecutionStatus(executionId, 'failed', 'Workflow not found');
      return;
    }

    const taskId = uuidv4();
    const params = resolveParams(policy.workflow_params ?? undefined, alert);

    // 始终将告警关键字段注入 context，确保 Agent 节点能获取告警数据
    const alertContext = {
      alert_id: alert.id,
      alert_title: alert.title,
      alert_content: alert.content,
      alert_source: alert.source,
      alert_severity: alert.severity,
      alert_device_ip: alert.device_ip || alert.host,
      alert_service: alert.service,
      ...params,
    };

    tasksRepo.createPendingWithContext({
      id: taskId,
      workflow_id: workflow.id,
      name: `自动修复: ${workflow.name}`,
      context: JSON.stringify(alertContext),
    });

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
      (service as any).updateExecutionStatus(executionId, 'failed', 'Invalid workflow format');
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

    await runWorkflowExecutor(taskId, parsedWorkflow, undefined, alertContext);

    service.updateExecution(executionId, {
      workflow_execution_id: taskId,
      execution_result: JSON.stringify({ taskId }),
      completed_at: new Date().toISOString(),
      execution_duration_ms: Date.now() - startTime
    });

    if (policy.enable_verification && policy.verification_workflow_id) {
      await service.verifyResult(executionId);
    } else {
      service.updateExecutionStatus(executionId, 'success');
      service.resolveAlert(execution.alert_id);
      service.notifySelfHeal(execution.alert_id, alert?.title);
      service.updateCooldown(policy, alert);
      service.recordHistory(execution, policy, 'success');
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Remediation execution ${executionId} failed:`, error);

    (service as any).updateExecution(executionId, {
      status: 'failed',
      status_reason: errorMsg,
      completed_at: new Date().toISOString(),
      execution_duration_ms: Date.now() - startTime
    });

    (service as any).recordHistory(execution, policy, 'failed', errorMsg);

    if (policy.enable_rollback && policy.rollback_on_failure && policy.rollback_workflow_id) {
      await service.rollbackExecution(executionId);
    }
  }
}

export function resolveParams(paramsJson: string | undefined, alert: RemediationAlert): Record<string, unknown> {
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
        const val = (alert as unknown as Record<string, unknown>)[prop];
        return val !== undefined && val !== null ? String(val) : '';
      });
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

export async function requestApproval(service: RemediationServiceLike, execution: RemediationExecution): Promise<void> {
  (service as any).updateExecution(execution.id, { status: 'waiting_approval' });

  const policy = service.getPolicy(execution.policy_id);
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

export async function sendSuggestion(service: RemediationServiceLike, execution: RemediationExecution): Promise<void> {
  service.updateExecution(execution.id, { status: 'success', status_reason: 'suggestion_sent' });

  const policy = service.getPolicy(execution.policy_id);
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
