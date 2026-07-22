/**
 * useWorkflowEditor 主 hook（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 useWorkflowEditor.ts 646 行（git HEAD 554 + workspace 646）包含：
 *   - 10+ useState（nodes/edges/name/description/selectedNode/isTemplate/history/historyIndex/...）
 *   - 30+ useCallback（dropHandlers + eventHandlers + lifecycleHandlers + 14 updateXxxConfig）
 *   - 3 useQuery（agents / providers / workflow）
 *   - 1 useMutation（saveWorkflow）
 *   - 5 useEffect（ref / history sync / ...）
 *
 * 拆分后行为：6 个子模块按职责分离 + 主 hook 仅编排 (~150 行)
 *   - constants.ts                — 6+ 常量 (40)
 *   - helpers.ts                  — pushHistory + validateWorkflowPure (50)
 *   - dropHandlers.ts             — onDragOver + onDrop (120)
 *   - eventHandlers.ts            — 7 个 event handler (120)
 *   - nodeConfigUpdaters.ts       — 14 个 updateXxx (200)
 *   - lifecycleHandlers.ts        — 5 个 lifecycle (120)
 *   - index.ts                    — barrel (15)
 *
 * 桶兼容：原 `import { useWorkflowEditor } from '.../useWorkflowEditor'` 仍可用
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import api from '../../../../lib/api';
import { useToast } from '../../../../contexts/ToastContext';
import type { Agent, Provider, WorkflowData } from './types';
import { pushHistory, validateWorkflowPure } from './helpers';
import { useDropHandlers } from './dropHandlers';
import { useEventHandlers } from './eventHandlers';
import { useNodeConfigUpdaters } from './nodeConfigUpdaters';
import { useLifecycleHandlers } from './lifecycleHandlers';

export function useWorkflowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isTemplate, setIsTemplate] = useState(false);
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null!);

  // ── Queries ──
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data } = await api.get('/agents');
      return data as Agent[];
    },
  });

  const { data: providers } = useQuery({
    queryKey: ['workflow-providers'],
    queryFn: async () => {
      const { data } = await api.get('/workflows/providers/list');
      return (data || []) as Provider[];
    },
  });

  const { data: workflow } = useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const { data } = await api.get(`/workflows/${id}`);
      return data;
    },
    enabled: !!id && id !== 'new',
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // ── Validate (pure + setState) ──
  const validateWorkflow = useCallback(() => {
    const errors = validateWorkflowPure(name, nodes, edges);
    setValidationErrors(errors);
    return errors.length === 0;
  }, [name, nodes, edges]);

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async (data: WorkflowData) => {
      if (!validateWorkflow()) {
        throw new Error('工作流验证失败');
      }

      if (id && id !== 'new') {
        await api.put(`/workflows/${id}`, data);
      } else {
        await api.post('/workflows', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate('/workflows');
      toast.success('保存成功！');
    },
    onError: (error: Error) => {
      toast.error(error.message || '保存失败，请重试');
    },
  });

  // ── Sub-handler factories ──
  const { onDragOver, onDrop } = useDropHandlers({
    reactFlowWrapper,
    reactFlowInstance,
    setNodes,
  });

  const eventHandlers = useEventHandlers({
    selectedNode,
    setSelectedNode,
    setNodes,
    setEdges,
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
  });

  const nodeUpdaters = useNodeConfigUpdaters({
    setNodes,
    setSelectedNode,
    providers,
  });

  const lifecycle = useLifecycleHandlers({
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
  });

  // ── Save history (compat: was inline before) ──
  const saveHistory = useCallback(() => {
    const { newHistory, newIndex } = pushHistory(history, historyIndex, nodes, edges);
    setHistory(newHistory);
    setHistoryIndex(newIndex);
  }, [nodes, edges, history, historyIndex]);

  // ── Lifecycle effects (load workflow on mount / id change) ──
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (id && id !== 'new' && workflow) {
      setName(workflow.name || '');
      setDescription(workflow.description || '');
      setIsTemplate(!!workflow.is_template);
      setNodes(workflow.nodes || []);
      setEdges(workflow.edges || []);
    } else if (id === 'new') {
      setName('');
      setDescription('');
      setNodes([]);
      setEdges([]);
    }
  }, [id, workflow, setNodes, setEdges]);

  const saveHistoryRef = useRef(saveHistory);
  useEffect(() => {
    saveHistoryRef.current = saveHistory;
  }, [saveHistory]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (!reactFlowInstance) return;
    const timer = setTimeout(() => {
      saveHistoryRef.current();
    }, 600);
    return () => clearTimeout(timer);
  }, [nodes, edges, reactFlowInstance]);

  // ── Final shape ──
  return {
    id,
    name,
    setName,
    description,
    setDescription,
    isTemplate,
    setIsTemplate,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect: eventHandlers.onConnect,
    onDragOver,
    onDrop,
    onNodeClick: eventHandlers.onNodeClick,
    onPaneClick: eventHandlers.onPaneClick,
    deleteSelectedNode: eventHandlers.deleteSelectedNode,
    duplicateSelectedNode: eventHandlers.duplicateSelectedNode,
    handleUndo: eventHandlers.handleUndo,
    handleRedo: eventHandlers.handleRedo,
    selectedNode,
    setSelectedNode,
    reactFlowInstance,
    setReactFlowInstance,
    reactFlowWrapper,
    fileInputRef,
    historyIndex,
    historyLength: history.length,
    handleSave: lifecycle.handleSave,
    handleExecute: lifecycle.handleExecute,
    handleExport: lifecycle.handleExport,
    handleImport: lifecycle.handleImport,
    handleClear: lifecycle.handleClear,
    validationErrors,
    saveHistory,
    saveMutation,
    proOptions: { hideAttribution: true },
    agents,
    providers,
    workflow,
    ...nodeUpdaters,
  };
}
