/**
 * useWorkflowEditor 纯函数 helpers（2026-07-21 拆分）
 *
 * 把原 useWorkflowEditor.ts 的纯逻辑抽出：
 * - saveHistory：管理 history 队列（保留 callback-friendly）
 * - validateWorkflow：检查工作流合法性
 *
 * 注：所有 helper 都是纯函数，state 由调用方提供（即 hook 主体）
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import type { Edge, Node } from '@xyflow/react';
import { MAX_HISTORY } from './constants';

/**
 * 推入一条 history snapshot（自动截断超过 MAX_HISTORY 的项）
 * 返回 {newHistory, newIndex} 用于 setState
 */
export function pushHistory(
  history: Array<{ nodes: Node[]; edges: Edge[] }>,
  historyIndex: number,
  currentNodes: Node[],
  currentEdges: Edge[],
): { newHistory: Array<{ nodes: Node[]; edges: Edge[] }>; newIndex: number } {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push({ nodes: [...currentNodes], edges: [...currentEdges] });
  if (newHistory.length > MAX_HISTORY) newHistory.shift();
  return {
    newHistory,
    newIndex: newHistory.length - 1,
  };
}

/**
 * 校验工作流合法性
 * 返回 errors 列表（空数组即合法）
 */
export function validateWorkflowPure(name: string, nodes: Node[], edges: Edge[]): string[] {
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push('请输入工作流名称');
  }

  if (nodes.length === 0) {
    errors.push('请至少添加一个节点');
  }

  if (nodes.length > 1) {
    const connectedNodes = new Set<string>();
    edges.forEach((e) => {
      connectedNodes.add(e.source);
      connectedNodes.add(e.target);
    });

    const orphanNodes = nodes.filter((n) => !connectedNodes.has(n.id));
    if (orphanNodes.length > 0) {
      errors.push(`发现 ${orphanNodes.length} 个孤立节点，请连接或删除`);
    }
  }

  return errors;
}
