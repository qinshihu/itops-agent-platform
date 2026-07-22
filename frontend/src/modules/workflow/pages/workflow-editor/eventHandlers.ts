/**
 * useWorkflowEditor 事件 handlers（2026-07-21 拆分）
 *
 * 把原 useWorkflowEditor.ts L145-318 的小型事件 handler 抽出：
 * - onConnect：连接 edge + animated + arrow marker
 * - onNodeClick：选中 node
 * - onPaneClick：取消选中
 * - deleteSelectedNode：删除 + 清理 edges
 * - duplicateSelectedNode：克隆 + 偏移 50px
 * - handleUndo / handleRedo：history navigation
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 *
 * ⚠️ 注意：history / historyIndex 保留独立 state（兼容性：WorkflowEditor.tsx L23 仍用 wf.historyIndex）
 */

import { useCallback } from 'react';
import { addEdge, MarkerType, type Connection, type Edge, type Node } from '@xyflow/react';
import { NODE_ID_PREFIX } from './constants';

export interface EventHandlersArgs {
  selectedNode: Node | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  history: Array<{ nodes: Node[]; edges: Edge[] }>;
  setHistory: React.Dispatch<React.SetStateAction<Array<{ nodes: Node[]; edges: Edge[] }>>>;
  historyIndex: number;
  setHistoryIndex: React.Dispatch<React.SetStateAction<number>>;
}

/** 工厂：返回 5 个核心事件 handler */
export function useEventHandlers({
  selectedNode,
  setSelectedNode,
  setNodes,
  setEdges,
  history,
  setHistory,
  historyIndex,
  setHistoryIndex,
}: EventHandlersArgs) {
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#3b82f6', strokeWidth: 2 },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
    );
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges]);

  const duplicateSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const newNode: Node = {
      ...selectedNode,
      id: `${NODE_ID_PREFIX}${Date.now()}`,
      position: { x: selectedNode.position.x + 50, y: selectedNode.position.y + 50 },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [selectedNode, setNodes]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex, setNodes, setEdges, setHistoryIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex, setNodes, setEdges, setHistoryIndex]);

  return {
    onConnect,
    onNodeClick,
    onPaneClick,
    deleteSelectedNode,
    duplicateSelectedNode,
    handleUndo,
    handleRedo,
  };
}
