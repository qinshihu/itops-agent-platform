import type {
  WorkflowNode,
  WorkflowEdge,
  NodeResult,
  ExecutionContext,
  WorkflowParsed,
} from '../../../../types';

/** 保存到 tasks.context 的执行上下文（用于审批恢复） */
export interface PersistedExecutionState {
  workflowId: string;
  workflowName: string;
  initialInput?: string;
  executionOrder: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeResults: Record<string, NodeResult>;
  executionContext: ExecutionContext;
  pausedAtIndex: number;
}

/** 节点处理器上下文：封装 executeFromIndex 循环中传递给各节点处理器的状态 */
export interface NodeHandlerCtx {
  taskId: string;
  nodeId: string;
  node: WorkflowNode;
  nodeResults: Record<string, NodeResult>;
  executionContext: ExecutionContext;
  workflow: WorkflowParsed;
  initialInput?: string;
  index: number;
  executionOrder: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  executionDepth: number;
  maxExecutionDepth: number;
}

/** 节点处理器返回值：控制 executeFromIndex 循环的后续行为 */
export type NodeHandlerResult = 'continue' | 'paused' | 'completed';
