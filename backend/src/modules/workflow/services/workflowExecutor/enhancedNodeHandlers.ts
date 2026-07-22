import { randomUUID } from 'crypto';
import { getIOInstance } from '../../../../shared/websocket/io';
import { logger } from '../../../../utils/logger';
import { approvalsRepo, tasksRepo } from '../../../../repositories';
import { notificationService } from '../../../notification/services/notificationService';
import {
  executeVerificationNode,
  executeRiskAssessNode,
  executeDecisionNode,
  executeKnowledgeNode,
  executeRollbackNode,
} from '../enhancedNodeExecutor/index';
import type {
  VerificationNodeConfig,
  RiskAssessNodeConfig,
  DecisionNodeConfig,
  KnowledgeNodeConfig,
  RollbackNodeConfig,
} from '../enhancedNodeTypes';
import { addTaskLog } from './helpers';
import type { NodeHandlerCtx, NodeHandlerResult, PersistedExecutionState } from './types';
import { finalizeWorkflow } from './finalizeWorkflow';

// ---------------------------------------------------------------------------
// verification 节点：5级验证门禁链
// ---------------------------------------------------------------------------
export async function handleVerificationNode(ctx: NodeHandlerCtx): Promise<NodeHandlerResult> {
  const { taskId, nodeId, node, nodeResults, executionContext } = ctx;
  const io = getIOInstance();

  const vConfig = (node.data as unknown) as VerificationNodeConfig;
  const serverId = vConfig.server_id || executionContext.variables.server_id as string | undefined;
  logger.info(`🔍 Processing verification node ${nodeId}`);

  io?.to(`task:${taskId}`).emit('task:node:started', { nodeId, nodeName: node.data.label });
  addTaskLog(taskId, { type: 'output', content: '🔍 开始验证...', nodeId });

  try {
    const result = await executeVerificationNode(vConfig, serverId);
    nodeResults[nodeId] = result;
    io?.to(`task:${taskId}`).emit('task:node:output', { taskId, nodeId, output: result.output });
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: result.status, output: result.output });
    addTaskLog(taskId, { type: 'output', content: result.output ?? '', nodeId });

    if (result.status === 'failed' && !node.data.allowFailure) {
      throw new Error(`验证失败: ${result.error || '未知错误'}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    nodeResults[nodeId] = { status: 'failed', error: errorMessage };
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'failed', error: errorMessage });
    addTaskLog(taskId, { type: 'error', content: errorMessage, nodeId });
    if (!node.data.allowFailure) throw error;
  }
  return 'continue';
}

// ---------------------------------------------------------------------------
// risk_assess 节点：三维风险量化评分
// ---------------------------------------------------------------------------
export async function handleRiskAssessNode(ctx: NodeHandlerCtx): Promise<NodeHandlerResult> {
  const { taskId, nodeId, node, nodeResults, executionContext } = ctx;
  const io = getIOInstance();

  const rConfig = (node.data as unknown) as RiskAssessNodeConfig;
  logger.info(`📊 Processing risk_assess node ${nodeId}`);

  io?.to(`task:${taskId}`).emit('task:node:started', { nodeId, nodeName: node.data.label });
  addTaskLog(taskId, { type: 'output', content: '📊 正在评估风险...', nodeId });

  try {
    const previousOutputs = Object.values(nodeResults).map(r => r.output).filter(Boolean) as string[];
    const result = executeRiskAssessNode(rConfig, executionContext, previousOutputs);
    nodeResults[nodeId] = result;
    executionContext.variables.risk_assessment = result.metadata;

    io?.to(`task:${taskId}`).emit('task:node:output', { taskId, nodeId, output: result.output });
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'success', output: result.output });
    addTaskLog(taskId, { type: 'output', content: result.output ?? '', nodeId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    nodeResults[nodeId] = { status: 'failed', error: errorMessage };
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'failed', error: errorMessage });
    addTaskLog(taskId, { type: 'error', content: errorMessage, nodeId });
    if (!node.data.allowFailure) throw error;
  }
  return 'continue';
}

// ---------------------------------------------------------------------------
// decision 节点：自适应决策引擎
// ---------------------------------------------------------------------------
export async function handleDecisionNode(ctx: NodeHandlerCtx): Promise<NodeHandlerResult> {
  const { taskId, nodeId, node, nodeResults, workflow, executionContext, initialInput, index, executionOrder, nodes, edges } = ctx;
  const io = getIOInstance();

  const dConfig = (node.data as unknown) as DecisionNodeConfig;
  logger.info(`🎯 Processing decision node ${nodeId}`);

  io?.to(`task:${taskId}`).emit('task:node:started', { nodeId, nodeName: node.data.label });
  addTaskLog(taskId, { type: 'output', content: '🎯 正在决策...', nodeId });

  try {
    const decision = executeDecisionNode(dConfig, nodeResults);
    nodeResults[nodeId] = {
      status: 'success',
      output: decision.output,
      metadata: { action: decision.action, reason: decision.reason },
    };

    io?.to(`task:${taskId}`).emit('task:node:output', { taskId, nodeId, output: decision.output });
    addTaskLog(taskId, { type: 'output', content: decision.output, nodeId });

    // 如果决策结果要求审批，动态插入审批暂停
    if (decision.action === 'request_approval') {
      logger.info(`🛑 Decision node requested approval, pausing workflow`);

      const approvalId = randomUUID();
      approvalsRepo.create({
        id: approvalId,
        task_id: taskId,
        node_id: nodeId,
        node_label: node.data.label,
        description: decision.reason || '决策引擎要求审批',
        timeout_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        timeout_action: 'reject',
      });

      const persistedState: PersistedExecutionState = {
        workflowId: workflow.id,
        workflowName: workflow.name,
        initialInput,
        executionOrder,
        nodes,
        edges,
        nodeResults: { ...nodeResults },
        executionContext: {
          ...executionContext,
          previousResults: [...executionContext.previousResults],
          metadata: { ...executionContext.metadata }
        },
        pausedAtIndex: index
      };
      tasksRepo.updateStatusWithNodeContext(taskId, 'waiting_approval', nodeId, JSON.stringify(persistedState));

      io?.to(`task:${taskId}`).emit('task:approval:requested', {
        taskId, approvalId, nodeId, nodeLabel: node.data.label,
        description: decision.reason, timeout: 3600,
      });
      io?.emit('approval:new', { approvalId, taskId, nodeLabel: node.data.label, description: decision.reason });

      addTaskLog(taskId, { type: 'output', content: `⏸️ 决策要求审批: ${decision.reason}`, nodeId });

      try {
        await notificationService.sendNotification({
          type: 'approval_request',
          title: `⏸️ 工作流决策审批: ${node.data.label}`,
          content: `**工作流**: ${workflow.name}\n**决策**: ${decision.reason}\n**任务ID**: ${taskId}`,
          related_task_id: taskId,
        });
      } catch (notifyError) {
        logger.warn('⚠️ 决策审批通知发送失败:', notifyError);
      }
      return 'paused';
    }

    // 如果决策结果是 block，终止流程
    if (decision.action === 'block') {
      nodeResults[nodeId] = { ...nodeResults[nodeId], status: 'failed', error: `决策引擎阻止执行: ${decision.reason}` };
      await finalizeWorkflow(taskId, workflow, nodes, nodeResults, executionOrder, 'failed', `决策阻止: ${decision.reason}`);
      return 'completed';
    }

    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'success', output: decision.output });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    nodeResults[nodeId] = { status: 'failed', error: errorMessage };
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'failed', error: errorMessage });
    addTaskLog(taskId, { type: 'error', content: errorMessage, nodeId });
    if (!node.data.allowFailure) throw error;
  }
  return 'continue';
}

// ---------------------------------------------------------------------------
// knowledge 节点：知识沉淀闭环
// ---------------------------------------------------------------------------
export async function handleKnowledgeNode(ctx: NodeHandlerCtx): Promise<NodeHandlerResult> {
  const { taskId, nodeId, node, nodeResults, workflow } = ctx;
  const io = getIOInstance();

  const kConfig = (node.data as unknown) as KnowledgeNodeConfig;
  logger.info(`📚 Processing knowledge node ${nodeId}`);

  io?.to(`task:${taskId}`).emit('task:node:started', { nodeId, nodeName: node.data.label });
  addTaskLog(taskId, { type: 'output', content: '📚 正在沉淀知识...', nodeId });

  try {
    const allPrevSuccess = Object.values(nodeResults).every(r => r.status === 'success');
    const result = executeKnowledgeNode(
      kConfig, workflow.name, taskId, workflow.id,
      nodeResults, allPrevSuccess
    );
    nodeResults[nodeId] = result;

    io?.to(`task:${taskId}`).emit('task:node:output', { taskId, nodeId, output: result.output });
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'success', output: result.output });
    addTaskLog(taskId, { type: 'output', content: result.output ?? '', nodeId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    nodeResults[nodeId] = { status: 'failed', error: errorMessage };
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'failed', error: errorMessage });
    addTaskLog(taskId, { type: 'error', content: errorMessage, nodeId });
    // 知识节点失败不阻塞流程
  }
  return 'continue';
}

// ---------------------------------------------------------------------------
// rollback 节点：自动回滚
// ---------------------------------------------------------------------------
export async function handleRollbackNode(ctx: NodeHandlerCtx): Promise<NodeHandlerResult> {
  const { taskId, nodeId, node, nodeResults } = ctx;
  const io = getIOInstance();

  const rbConfig = (node.data as unknown) as RollbackNodeConfig;
  logger.info(`🔄 Processing rollback node ${nodeId}`);

  io?.to(`task:${taskId}`).emit('task:node:started', { nodeId, nodeName: node.data.label });
  addTaskLog(taskId, { type: 'output', content: '🔄 正在执行回滚...', nodeId });

  try {
    const result = await executeRollbackNode(rbConfig, nodeResults);
    nodeResults[nodeId] = result;

    io?.to(`task:${taskId}`).emit('task:node:output', { taskId, nodeId, output: result.output });
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: result.status, output: result.output });
    addTaskLog(taskId, { type: 'output', content: result.output ?? '', nodeId });

    if (result.status === 'failed' && !node.data.allowFailure) {
      throw new Error(`回滚失败: ${result.error || '未知错误'}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    nodeResults[nodeId] = { status: 'failed', error: errorMessage };
    io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'failed', error: errorMessage });
    addTaskLog(taskId, { type: 'error', content: errorMessage, nodeId });
    if (!node.data.allowFailure) throw error;
  }
  return 'continue';
}
