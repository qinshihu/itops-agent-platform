/**
 * useWorkflowEditor Drag & Drop handlers（2026-07-21 拆分）
 *
 * 把原 useWorkflowEditor.ts L162-273 的 onDragOver + onDrop 抽出
 * 包含 7 种节点类型识别：
 * - approval (审批节点)
 * - 6 个 NON_CORE_NODE_DEFAULTS 流程控制节点
 * - provider (工作流 Provider)
 * - agent (Agent)
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import { useCallback } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import { NON_CORE_NODE_DEFAULTS, NODE_ID_PREFIX } from './constants';

/** drag & drop 处理函数工厂参数 */
export interface DropHandlersArgs {
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  reactFlowInstance: ReactFlowInstance | null;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

/**
 * 工厂函数：返回 onDragOver + onDrop 一对 handler
 * - onDragOver：阻止默认并显示 move 光标
 * - onDrop：识别节点类型 + 创建新的 Node 并 concat 到 setNodes
 */
export function useDropHandlers({
  reactFlowWrapper,
  reactFlowInstance,
  setNodes,
}: DropHandlersArgs) {
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const nodeType = event.dataTransfer.getData('application/reactflow/nodeType');
      if (!reactFlowInstance) return;
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // ── 审批节点 ──
      if (nodeType === 'approval') {
        const newNode: Node = {
          id: `${NODE_ID_PREFIX}${Date.now()}`,
          type: 'approval',
          position,
          data: {
            label: '审批节点',
            description: '请确认是否继续执行',
            approvalConfig: {
              description: '请确认是否继续执行',
              timeout: 3600,
              timeoutAction: 'reject',
              approvers: ['admin'],
            },
          },
          connectable: true,
        };
        setNodes((nds) => nds.concat(newNode));
        return;
      }

      // ── 6 类流程控制节点（NON_CORE_NODE_DEFAULTS） ──
      const nonCoreDef = NON_CORE_NODE_DEFAULTS[nodeType];
      if (nonCoreDef) {
        const newNode: Node = {
          id: `${NODE_ID_PREFIX}${Date.now()}`,
          type: nodeType,
          position,
          data: { ...nonCoreDef.data, label: nonCoreDef.label, description: nonCoreDef.description },
          connectable: true,
        };
        setNodes((nds) => nds.concat(newNode));
        return;
      }

      // ── Provider 节点 ──
      if (nodeType === 'provider') {
        const providerId = event.dataTransfer.getData('application/reactflow/providerId');
        const providerName = event.dataTransfer.getData('application/reactflow/providerName');
        const providerType = event.dataTransfer.getData('application/reactflow/providerType');
        const providerSchema = event.dataTransfer.getData('application/reactflow/providerSchema');
        const newNode: Node = {
          id: `${NODE_ID_PREFIX}${Date.now()}`,
          type: 'provider',
          position,
          data: {
            label: providerName || 'Provider',
            providerId,
            providerName,
            providerType,
            configSchema: providerSchema ? JSON.parse(providerSchema) : null,
            method: '',
            config: {},
          },
          connectable: true,
        };
        setNodes((nds) => nds.concat(newNode));
        return;
      }

      // ── Agent 节点（兜底） ──
      const agentId = event.dataTransfer.getData('application/reactflow/agentId');
      const agentName = event.dataTransfer.getData('application/reactflow/agentName');
      const agentAvatar = event.dataTransfer.getData('application/reactflow/agentAvatar');
      const agentDescription = event.dataTransfer.getData('application/reactflow/agentDescription');
      const agentSystemPrompt = event.dataTransfer.getData('application/reactflow/agentSystemPrompt');

      if (typeof agentId !== 'string') return;

      const newNode: Node = {
        id: `${NODE_ID_PREFIX}${Date.now()}`,
        type: 'agent',
        position,
        data: {
          label: agentName,
          agentId,
          avatar: agentAvatar,
          description: agentDescription,
          prompt: agentSystemPrompt,
        },
        connectable: true,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  return { onDragOver, onDrop };
}
