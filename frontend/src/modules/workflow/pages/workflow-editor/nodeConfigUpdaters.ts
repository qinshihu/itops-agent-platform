/**
 * useWorkflowEditor Node Config Updaters（2026-07-21 拆分）
 *
 * 把原 useWorkflowEditor.ts L399-589 的 11+ updateXxxConfig 抽出：
 * - updateNodeLabel / updateNodeDescription / updateNodeData（通用 update）
 * - updateNodeInputKey / updateNodeOutputKey / updateNodePrompt（agent 字段）
 * - updateApprovalConfig（审批节点嵌套 config）
 * - updateVerificationConfig / updateRiskAssessConfig / updateDecisionConfig / updateKnowledgeConfig / updateRollbackConfig（5 类增强节点）
 * - updateGenericConfig（6 类流程控制节点）
 * - updateProviderId / updateProviderConfig（provider 节点 + config）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 *
 * ⚠️ 桶兼容：WorkflowEditor.tsx L46-59 调用 14 个独立 prop 名字，**不能合并**
 *   不能合并的同类用工厂函数 createNodeFieldUpdater 简化代码但不暴露工厂
 */

import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import type { ApprovalNodeData, Provider, ProviderNodeData } from './types';

export interface NodeConfigUpdatersArgs {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
  providers?: Provider[] | null;
}

/**
 * 内部工具：通用"按 nodeId 设置 data field"模式
 * 同时同步 setNodes 和 setSelectedNode
 */
function createNodeFieldUpdater(
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>,
) {
  return (field: string) =>
    (nodeId: string, value: unknown) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, [field]: value } }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId
          ? { ...prev, data: { ...prev.data, [field]: value } }
          : prev,
      );
    };
}

/** 工厂：返回所有 13+ 个 updater（API 完全兼容） */
export function useNodeConfigUpdaters({
  setNodes,
  setSelectedNode,
  providers,
}: NodeConfigUpdatersArgs) {
  // ── 通用 update field 工厂实例 ──
  const setNodeField = createNodeFieldUpdater(setNodes, setSelectedNode);

  // ── 完整 data 替换 ──
  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId
          ? { ...prev, data: { ...prev.data, ...data } }
          : prev,
      );
    },
    [setNodes, setSelectedNode],
  );

  // ── 简单字段（label / description）──
  const updateNodeLabel = useCallback(
    (nodeId: string, value: string) => {
      setNodeField('label')(nodeId, value);
    },
    [setNodeField],
  );

  const updateNodeDescription = useCallback(
    (nodeId: string, value: string) => {
      setNodeField('description')(nodeId, value);
    },
    [setNodeField],
  );

  const updateNodeInputKey = useCallback(
    (nodeId: string, value: string) => {
      updateNodeData(nodeId, { inputKey: value });
    },
    [updateNodeData],
  );

  const updateNodeOutputKey = useCallback(
    (nodeId: string, value: string) => {
      updateNodeData(nodeId, { outputKey: value });
    },
    [updateNodeData],
  );

  const updateNodePrompt = useCallback(
    (nodeId: string, value: string) => {
      updateNodeData(nodeId, { prompt: value });
    },
    [updateNodeData],
  );

  // ── 审批节点（嵌套 config）──
  const updateApprovalConfig = useCallback(
    (nodeId: string, partial: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const existing = (n.data as ApprovalNodeData)?.approvalConfig || {};
          return { ...n, data: { ...n.data, approvalConfig: { ...existing, ...partial } } };
        }),
      );
      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev;
        const existing = (prev.data as ApprovalNodeData)?.approvalConfig || {};
        return { ...prev, data: { ...prev.data, approvalConfig: { ...existing, ...partial } } };
      });
    },
    [setNodes, setSelectedNode],
  );

  // ── 5 类增强节点 + 6 类流程节点（共享同形）──
  const updateVerificationConfig = useCallback(
    (nodeId: string, partial: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...partial } } : n)),
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId
          ? { ...prev, data: { ...prev.data, ...partial } }
          : prev,
      );
    },
    [setNodes, setSelectedNode],
  );

  const updateRiskAssessConfig = updateVerificationConfig;
  const updateDecisionConfig = updateVerificationConfig;
  const updateKnowledgeConfig = updateVerificationConfig;
  const updateRollbackConfig = updateVerificationConfig;
  const updateGenericConfig = updateVerificationConfig;

  // ── Provider 节点 ──
  const updateProviderId = useCallback(
    (nodeId: string, pid: string) => {
      const p = (providers || []).find((prov) => prov.id === pid);
      const newData = {
        providerId: pid,
        providerName: p?.name || '',
        providerType: p?.type || '',
        configSchema: p?.configSchema || null,
        method: '',
        config: {},
      };
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, ...newData } }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId
          ? { ...prev, data: { ...prev.data, ...newData } }
          : prev,
      );
    },
    [providers, setNodes, setSelectedNode],
  );

  const updateProviderConfig = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const existing = (n.data as ProviderNodeData)?.config || {};
          return { ...n, data: { ...n.data, config: { ...existing, [key]: value } } };
        }),
      );
      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev;
        const existing = (prev.data as ProviderNodeData)?.config || {};
        return { ...prev, data: { ...prev.data, config: { ...existing, [key]: value } } };
      });
    },
    [setNodes, setSelectedNode],
  );

  return {
    updateNodeLabel,
    updateNodeDescription,
    updateNodeData,
    updateNodeInputKey,
    updateNodeOutputKey,
    updateNodePrompt,
    updateApprovalConfig,
    updateVerificationConfig,
    updateRiskAssessConfig,
    updateDecisionConfig,
    updateKnowledgeConfig,
    updateRollbackConfig,
    updateGenericConfig,
    updateProviderId,
    updateProviderConfig,
  };
}
