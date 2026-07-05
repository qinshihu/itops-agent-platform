import { getIOInstance } from '../../../../shared/websocket/io';
import { logger } from '../../../../utils/logger';
import { tasksRepo, workflowsRepo, approvalsRepo } from '../../../../repositories';
import type {
  WorkflowNode,
  WorkflowEdge,
  NodeResult,
  ExecutionContext,
  WorkflowParsed,
} from '../../../../types';
import { topologicalSort, addTaskLog } from './helpers';
import { finalizeWorkflow, generateWorkflowExecutionReport } from './finalizeWorkflow';
import {
  handleApprovalNode,
  handleAgentNode,
} from './basicNodeHandlers';
import {
  handleVerificationNode,
  handleRiskAssessNode,
  handleDecisionNode,
  handleKnowledgeNode,
  handleRollbackNode,
} from './enhancedNodeHandlers';
import type { PersistedExecutionState, NodeHandlerCtx } from './types';

// Re-export public API
export { finalizeWorkflow, generateWorkflowExecutionReport } from './finalizeWorkflow';
export {
  handleApprovalNode,
  handleAgentNode,
} from './basicNodeHandlers';
export {
  handleVerificationNode,
  handleRiskAssessNode,
  handleDecisionNode,
  handleKnowledgeNode,
  handleRollbackNode,
} from './enhancedNodeHandlers';
export { topologicalSort, addTaskLog, isDuplicateKnowledgeBase } from './helpers';
export type { PersistedExecutionState, NodeHandlerCtx, NodeHandlerResult } from './types';

export async function executeWorkflow(
  taskId: string,
  workflow: WorkflowParsed,
  initialInput?: string,
  context?: Record<string, string | number | boolean>
) {
  const io = getIOInstance();
  const MAX_EXECUTION_DEPTH = 50;
  const executionDepth = 0;
  const nodeResults: Record<string, NodeResult> = {};
  let nodes: WorkflowNode[] = [];
  let edges: WorkflowEdge[] = [];
  let executionOrder: string[] = [];
  const startTime = new Date().toISOString();
  const executionContext: ExecutionContext = {
    variables: context ? { ...context } : {},
    previousResults: [],
    metadata: {
      taskId,
      workflowName: workflow.name,
      executionDepth: 0,
      startTime
    }
  };

  try {
    logger.info('🔄 Starting workflow execution:', { taskId, workflowName: workflow.name, context });

    nodes = Array.isArray(workflow.nodes) ? workflow.nodes : JSON.parse(workflow.nodes as unknown as string || '[]') as WorkflowNode[];
    edges = Array.isArray(workflow.edges) ? workflow.edges : JSON.parse(workflow.edges as unknown as string || '[]') as WorkflowEdge[];
    executionOrder = topologicalSort(nodes, edges);

    if (executionOrder.length === 0) {
      logger.error(`❌ Workflow ${workflow.name} has circular dependencies, aborting execution`);
      tasksRepo.updateStatusWithEndTime(taskId, 'failed');
      io?.to(`task:${taskId}`).emit('task:failed', { taskId, error: 'Circular dependency detected in workflow' });
      return;
    }

    logger.info('📊 Parsed workflow nodes:', nodes);
    logger.info('📊 Execution order:', executionOrder);

    tasksRepo.updateStatusWithStart(taskId, 'running', JSON.stringify(executionOrder));

    io?.to(`task:${taskId}`).emit('task:started', { taskId, executionOrder });

    await executeFromIndex(
      taskId, workflow, nodes, edges, executionOrder, nodeResults,
      executionContext, 0, initialInput, executionDepth, MAX_EXECUTION_DEPTH
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    tasksRepo.updateStatusFailureFinalize(taskId, 'failed');

    try {
      await generateWorkflowExecutionReport(taskId, workflow, nodes, nodeResults, executionOrder, 'failed', errorMessage);
    } catch (reportError) {
      logger.error('Failed to generate workflow report (failed case):', reportError);
    }

    io?.to(`task:${taskId}`).emit('task:failed', {
      taskId,
      error: errorMessage
    });
  }
}

/**
 * 从指定索引开始执行工作流节点。
 * 遇到审批节点时暂停并保存状态，返回 'paused'。
 * 全部执行完返回 'completed'。
 */
async function executeFromIndex(
  taskId: string,
  workflow: WorkflowParsed,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  executionOrder: string[],
  nodeResults: Record<string, NodeResult>,
  executionContext: ExecutionContext,
  startIndex: number,
  initialInput: string | undefined,
  executionDepth: number,
  MAX_EXECUTION_DEPTH: number
): Promise<'completed' | 'paused'> {
  const _io = getIOInstance();

  for (let i = startIndex; i < executionOrder.length; i++) {
    if (executionDepth++ >= MAX_EXECUTION_DEPTH) {
      logger.error(`❌ Workflow ${workflow.name} exceeded maximum execution depth`);
      break;
    }

    const taskStatus = tasksRepo.getStatus(taskId);
    if (taskStatus === 'cancelled') {
      break;
    }

    const nodeId = executionOrder[i];
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const ctx: NodeHandlerCtx = {
      taskId, nodeId, node, nodeResults, executionContext, workflow,
      initialInput, index: i, executionOrder, nodes, edges,
      executionDepth, maxExecutionDepth: MAX_EXECUTION_DEPTH,
    };

    let result: 'continue' | 'paused' | 'completed';

    switch (node.type) {
      case 'approval':
        result = await handleApprovalNode(ctx);
        break;
      case 'verification':
        result = await handleVerificationNode(ctx);
        break;
      case 'risk_assess':
        result = await handleRiskAssessNode(ctx);
        break;
      case 'decision':
        result = await handleDecisionNode(ctx);
        break;
      case 'knowledge':
        result = await handleKnowledgeNode(ctx);
        break;
      case 'rollback':
        result = await handleRollbackNode(ctx);
        break;
      case 'agent':
        result = await handleAgentNode(ctx);
        break;
      default:
        continue;
    }

    if (result === 'paused') return 'paused';
    if (result === 'completed') return 'completed';
  }

  await finalizeWorkflow(taskId, workflow, nodes, nodeResults, executionOrder, 'completed');
  return 'completed';
}

/**
 * 审批通过后恢复工作流执行
 */
export async function resumeWorkflow(
  taskId: string,
  approvalId: string,
  approvedBy: string,
  comment?: string
): Promise<void> {
  const io = getIOInstance();

  const task = tasksRepo.getById(taskId);
  if (task?.status !== 'waiting_approval') {
    throw new Error(`Task ${taskId} is not waiting for approval`);
  }

  const persistedState = JSON.parse(task.context || '{}') as PersistedExecutionState;
  if (!persistedState.executionOrder || persistedState.pausedAtIndex === undefined) {
    throw new Error(`Task ${taskId} has no saved execution context`);
  }

  approvalsRepo.approve(approvalId, approvedBy);

  io?.to(`task:${taskId}`).emit('task:approval:resolved', {
    taskId, approvalId, status: 'approved', approvedBy, comment
  });

  addTaskLog(taskId, { type: 'output', content: `✅ 审批通过 by ${approvedBy}${comment ? `: ${comment}` : ''}`, nodeId: persistedState.executionOrder[persistedState.pausedAtIndex] });

  tasksRepo.updateStatusClearNode(taskId, 'running');

  const workflow = workflowsRepo.getById(persistedState.workflowId) as { id: string; name: string; description: string; agent_configs: string; is_template: number; created_at: string; updated_at: string } | undefined;
  const workflowParsed: WorkflowParsed = workflow ? {
    id: workflow.id as string,
    name: workflow.name as string,
    description: workflow.description as string,
    nodes: persistedState.nodes,
    edges: persistedState.edges,
    agent_configs: JSON.parse((workflow.agent_configs as string) || '{}'),
    is_template: workflow.is_template as number,
    created_at: workflow.created_at as string,
    updated_at: workflow.updated_at as string,
  } : {
    id: persistedState.workflowId,
    name: persistedState.workflowName,
    nodes: persistedState.nodes,
    edges: persistedState.edges,
    agent_configs: {},
    is_template: 0,
    created_at: '',
    updated_at: '',
  };

  try {
    await executeFromIndex(
      taskId, workflowParsed,
      persistedState.nodes, persistedState.edges,
      persistedState.executionOrder,
      persistedState.nodeResults,
      persistedState.executionContext,
      persistedState.pausedAtIndex + 1,
      persistedState.initialInput,
      persistedState.executionContext.metadata.executionDepth,
      50
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await finalizeWorkflow(taskId, workflowParsed, persistedState.nodes, persistedState.nodeResults, persistedState.executionOrder, 'failed', errorMessage);
    io?.to(`task:${taskId}`).emit('task:failed', { taskId, error: errorMessage });
  }
}

/**
 * 审批拒绝，终止工作流
 */
export async function rejectWorkflow(
  taskId: string,
  approvalId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  const io = getIOInstance();

  approvalsRepo.reject(approvalId, rejectedBy, reason);

  tasksRepo.updateStatusFailureFinalize(taskId, 'failed');

  io?.to(`task:${taskId}`).emit('task:approval:resolved', {
    taskId, approvalId, status: 'rejected', approvedBy: rejectedBy, comment: reason
  });

  addTaskLog(taskId, { type: 'error', content: `❌ 审批拒绝 by ${rejectedBy}: ${reason}` });

  io?.to(`task:${taskId}`).emit('task:failed', {
    taskId, error: `审批被拒绝: ${reason}`
  });
}

/**
 * 审批超时处理
 */
export async function timeoutApproval(approvalId: string): Promise<void> {
  const approval = approvalsRepo.getById(approvalId);
  if (!approval) return;

  approvalsRepo.timeout(approvalId);

  if (approval.timeout_action === 'reject') {
    await rejectWorkflow(approval.task_id, approvalId, 'system', '审批超时自动拒绝');
  }
}
