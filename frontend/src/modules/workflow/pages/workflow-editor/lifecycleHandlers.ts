/**
 * useWorkflowEditor Lifecycle handlers（2026-07-21 拆分）
 *
 * 把原 useWorkflowEditor.ts L320-397 的 5 个 lifecycle handler 抽出：
 * - handleSave：保存（含 validation + mutation）
 * - handleExecute：跳转 /tasks?workflowId=id
 * - handleExport：下载 JSON 文件
 * - handleImport：读取 + 解析 + 应用（FileReader）
 * - handleClear：清空画布（含 confirm）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import { useCallback } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { WorkflowData } from './types';

export interface LifecycleHandlersArgs {
  id: string | undefined;
  navigate: (path: string) => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
  };
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  isTemplate: boolean;
  setName: (s: string) => void;
  setDescription: (s: string) => void;
  setIsTemplate: (b: boolean) => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
  saveMutation: UseMutationResult<unknown, Error, WorkflowData, unknown>;
  validateWorkflow: () => boolean;
  validationErrors: string[];
}

/** 工厂：返回 5 个 lifecycle handler */
export function useLifecycleHandlers({
  id,
  navigate,
  toast,
  name,
  description,
  nodes,
  edges,
  isTemplate,
  setName,
  setDescription,
  setIsTemplate,
  setNodes,
  setEdges,
  setSelectedNode,
  saveMutation,
  validateWorkflow,
  validationErrors,
}: LifecycleHandlersArgs) {
  const handleSave = useCallback(() => {
    if (!validateWorkflow()) {
      toast.error('工作流验证失败:\n' + validationErrors.join('\n'));
      return;
    }

    saveMutation.mutate({
      name,
      description,
      nodes,
      edges,
      is_template: isTemplate ? 1 : 0,
    });
  }, [
    name, description, nodes, edges, isTemplate,
    saveMutation, validateWorkflow, validationErrors, toast,
  ]);

  const handleExecute = useCallback(() => {
    if (!id || id === 'new') {
      toast.warning('请先保存工作流再执行');
      return;
    }
    navigate(`/tasks?workflowId=${id}`);
  }, [id, navigate, toast]);

  const handleExport = useCallback(() => {
    const data = {
      name,
      description,
      nodes,
      edges,
      is_template: isTemplate ? 1 : 0,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'workflow'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [name, description, nodes, edges, isTemplate]);

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.nodes && data.edges) {
            setName(data.name || '导入的工作流');
            setDescription(data.description || '');
            setIsTemplate(data.is_template === 1);
            setNodes(data.nodes);
            setEdges(data.edges);
            toast.success('导入成功！');
          } else {
            toast.error('无效的工作流文件');
          }
        } catch {
          toast.error('导入失败：无效的JSON格式');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    [setNodes, setEdges, toast, setName, setDescription, setIsTemplate],
  );

  const handleClear = useCallback(() => {
    if (confirm('确定要清空画布吗？此操作不可撤销。')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
    }
  }, [setNodes, setEdges, setSelectedNode]);

  return {
    handleSave,
    handleExecute,
    handleExport,
    handleImport,
    handleClear,
  };
}
