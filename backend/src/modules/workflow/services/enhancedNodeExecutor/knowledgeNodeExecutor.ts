/**
 * Knowledge 节点执行器：知识沉淀闭环
 *
 * 从原 enhancedNodeExecutor.ts 拆分（2026-07-08 P1-7 拆分）。
 * 通过 AI 模块的 KnowledgeEngine 把执行结果沉淀为知识条目。
 */
import { knowledgeEngine } from '../../../ai/services/KnowledgeEngine';
import type { NodeResult } from '../../../../types';
import type { KnowledgeNodeConfig } from '../enhancedNodeTypes';

export function executeKnowledgeNode(
  config: KnowledgeNodeConfig,
  workflowName: string,
  taskId: string,
  workflowId: string,
  nodeResults: Record<string, NodeResult>,
  overallSuccess: boolean,
): NodeResult {
  // 使用统一知识引擎
  const knowledgeId = knowledgeEngine.storeFromWorkflow({
    workflowName,
    taskId,
    workflowId,
    nodeResults,
    overallSuccess,
  });

  return {
    status: 'success',
    output: `📚 知识已沉淀: "${workflowName}" (${knowledgeId})`,
    metadata: { knowledgeId, category: 'workflow_execution' },
  };
}
