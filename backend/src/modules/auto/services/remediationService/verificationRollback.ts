import { v4 as uuidv4 } from 'uuid';
import db from '../../../../models/database';
import { executeWorkflow } from '../../../workflow/services/workflowExecutor';
import { logger } from '../../../../utils/logger';
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
  const execution = (service as any).getExecution(executionId);
  const policy = service.getPolicy(execution.policy_id);
  const alert = JSON.parse(execution.alert_snapshot || '{}');

  (service as any).updateExecution(executionId, { verification_status: 'pending' });

  try {
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(policy.verification_workflow_id!) as {
      id: string; name: string; description: string; nodes: string; edges: string; agent_configs: string; is_template: number; created_at: string; updated_at: string;
    } | undefined;

    if (!workflow) {
      throw new Error('Verification workflow not found');
    }

    const params = resolveParams(policy.verification_params, alert);
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

    db.prepare(`
      INSERT INTO tasks (id, workflow_id, name, status, context, created_at)
      VALUES (?, ?, ?, 'pending', ?, datetime('now','localtime'))
    `).run(taskId, workflow.id, `修复验证: ${workflow.name}`, JSON.stringify(verifyContext));

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
      executeWorkflow(taskId, parsedWorkflow, undefined, verifyContext),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Verification timeout')), timeout)
      )
    ]);

    (service as any).updateExecution(executionId, {
      verification_status: 'success',
      verification_result: JSON.stringify(result),
      verification_completed_at: new Date().toISOString(),
      status: 'success'
    });

    (service as any).resolveAlert(execution.alert_id);
    (service as any).notifySelfHeal(execution.alert_id, alert?.title);
    (service as any).updateCooldown(policy, alert);
    (service as any).recordHistory(execution, policy, 'success');

    return { success: true, result };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Verification failed for execution ${executionId}:`, error);

    (service as any).updateExecution(executionId, {
      verification_status: 'failed',
      verification_result: JSON.stringify({ error: errorMsg }),
      verification_completed_at: new Date().toISOString()
    });

    (service as any).recordHistory(execution, policy, 'failed', errorMsg);

    if (policy.enable_rollback && policy.rollback_workflow_id) {
      await service.rollbackExecution(executionId);
    }

    return { success: false, error: errorMsg };
  }
}

export async function rollbackExecution(service: RemediationServiceLike, executionId: string): Promise<void> {
  const execution = (service as any).getExecution(executionId);
  const policy = service.getPolicy(execution.policy_id);

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

    (service as any).updateExecution(executionId, {
      rollback_triggered: 1,
      rollback_execution_id: taskId,
      rollback_result: JSON.stringify(result),
      rollback_completed_at: new Date().toISOString(),
      status: 'rolled_back'
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Rollback failed for execution ${executionId}:`, error);

    (service as any).updateExecution(executionId, {
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
  const execution = (service as any).getExecution(executionId);

  if (execution.status !== 'waiting_approval') {
    throw new Error('Execution is not waiting for approval');
  }

  const now = new Date().toISOString();

  if (action === 'approve') {
    (service as any).updateExecution(executionId, {
      status: 'approved',
      approved_by: userId,
      approved_at: now,
      approval_comment: comment
    });

    executeWorkflowAsync(service, executionId);
  } else {
    (service as any).updateExecution(executionId, {
      status: 'rejected',
      approved_by: userId,
      approved_at: now,
      approval_comment: comment,
      completed_at: now
    });
  }
}

export async function retryExecution(service: RemediationServiceLike, executionId: string): Promise<void> {
  const execution = (service as any).getExecution(executionId);

  if (execution.status !== 'failed' && execution.status !== 'rejected') {
    throw new Error('Only failed or rejected executions can be retried');
  }

  (service as any).updateExecution(executionId, {
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

  executeWorkflowAsync(service, executionId);
}
