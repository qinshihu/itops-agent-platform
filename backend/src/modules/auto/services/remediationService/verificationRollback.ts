import { v4 as uuidv4 } from 'uuid';
import { executeWorkflow } from '../../../workflow/services/workflowExecutor';
import { logger } from '../../../../utils/logger';
import { workflowsRepo, tasksRepo } from '../../../../repositories';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowParsed,
  RemediationServiceLike
} from './types';
import { resolveParams, executeWorkflowAsync } from './executionOrchestration';

export async function verifyResult(
  service: RemediationServiceLike,
  executionId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const execution = service.getExecution(executionId);
  const policy = service.getPolicy(execution.policy_id);
  const alert = JSON.parse(execution.alert_snapshot || '{}');

  service.updateExecution(executionId, { verification_status: 'pending' });

  try {
    const workflow = workflowsRepo.getById(policy.verification_workflow_id!);

    if (!workflow) {
      throw new Error('Verification workflow not found');
    }

    const params = resolveParams(policy.verification_params ?? undefined, alert);
    // 同样注入告警数据到验证工作流 context
    const verifyContext = {
      alert_id: alert.id,
      alert_title: alert.title,
      alert_content: alert.content,
      alert_source: alert.source,
      alert_severity: alert.severity,
      ...params,
    };
    const timeout = policy.verification_timeout_seconds * 1000;
    const taskId = uuidv4();

    tasksRepo.createPendingWithContext({
      id: taskId,
      workflow_id: workflow.id,
      name: `修复验证: ${workflow.name}`,
      context: JSON.stringify(verifyContext),
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
    } catch {
      throw new Error('Invalid verification workflow format');
    }

    const parsedWorkflow: WorkflowParsed = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description ?? '',
      nodes: nodes ?? [],
      edges: edges ?? [],
      agent_configs: agentConfigs,
      is_template: workflow.is_template,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at
    };

    const result = await Promise.race([
      executeWorkflow(taskId, parsedWorkflow, undefined, verifyContext),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Verification timeout')), timeout)
      )
    ]);

    service.updateExecution(executionId, {
      verification_status: 'success',
      verification_result: JSON.stringify(result),
      verification_completed_at: new Date().toISOString(),
      status: 'success'
    });

    service.resolveAlert(execution.alert_id);
    service.notifySelfHeal(execution.alert_id, alert?.title);
    service.updateCooldown(policy, alert);
    service.recordHistory(execution, policy, 'success');

    return { success: true, result };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Verification failed for execution ${executionId}:`, error);

    service.updateExecution(executionId, {
      verification_status: 'failed',
      verification_result: JSON.stringify({ error: errorMsg }),
      verification_completed_at: new Date().toISOString()
    });

    service.recordHistory(execution, policy, 'failed', errorMsg);

    if (policy.enable_rollback && policy.rollback_workflow_id) {
      await service.rollbackExecution(executionId);
    }

    return { success: false, error: errorMsg };
  }
}

export async function rollbackExecution(service: RemediationServiceLike, executionId: string): Promise<void> {
  const execution = service.getExecution(executionId);
  const policy = service.getPolicy(execution.policy_id);

  if (!policy.rollback_workflow_id) {
    logger.warn(`No rollback workflow configured for policy ${policy.id}`);
    return;
  }

  logger.warn(`Rolling back execution ${executionId}`);

  try {
    const workflow = workflowsRepo.getById(policy.rollback_workflow_id);

    if (!workflow) {
      throw new Error('Rollback workflow not found');
    }

    const taskId = uuidv4();
    tasksRepo.createPendingWithContext({
      id: taskId,
      workflow_id: workflow.id,
      name: `回滚: ${workflow.name}`,
      context: JSON.stringify({ execution_id: executionId }),
    });

    const parsedWorkflow: WorkflowParsed = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description ?? '',
      nodes: typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) as WorkflowNode[] : (workflow.nodes ?? []),
      edges: typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) as WorkflowEdge[] : (workflow.edges ?? []),
      agent_configs: workflow.agent_configs ? (typeof workflow.agent_configs === 'string' ? JSON.parse(workflow.agent_configs) : workflow.agent_configs) : {},
      is_template: workflow.is_template,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at
    };

    const result = await executeWorkflow(taskId, parsedWorkflow);

    service.updateExecution(executionId, {
      rollback_triggered: 1,
      rollback_execution_id: taskId,
      rollback_result: JSON.stringify(result),
      rollback_completed_at: new Date().toISOString(),
      status: 'rolled_back'
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Rollback failed for execution ${executionId}:`, error);

    service.updateExecution(executionId, {
      rollback_triggered: 1,
      rollback_result: JSON.stringify({ error: errorMsg }),
      rollback_completed_at: new Date().toISOString()
    });
  }
}

export async function approveExecution(
  service: RemediationServiceLike,
  executionId: string,
  action: 'approve' | 'reject',
  userId: string,
  comment?: string
): Promise<void> {
  const execution = service.getExecution(executionId);

  if (execution.status !== 'waiting_approval') {
    throw new Error('Execution is not waiting for approval');
  }

  const now = new Date().toISOString();

  if (action === 'approve') {
    service.updateExecution(executionId, {
      status: 'approved',
      approved_by: userId,
      approved_at: now,
      approval_comment: comment
    });

    executeWorkflowAsync(service, executionId);
  } else {
    service.updateExecution(executionId, {
      status: 'rejected',
      approved_by: userId,
      approved_at: now,
      approval_comment: comment,
      completed_at: now
    });
  }
}

export async function retryExecution(service: RemediationServiceLike, executionId: string): Promise<void> {
  const execution = service.getExecution(executionId);

  if (execution.status !== 'failed' && execution.status !== 'rejected') {
    throw new Error('Only failed or rejected executions can be retried');
  }

  service.updateExecution(executionId, {
    status: 'pending',
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

  executeWorkflowAsync(service, executionId);
}