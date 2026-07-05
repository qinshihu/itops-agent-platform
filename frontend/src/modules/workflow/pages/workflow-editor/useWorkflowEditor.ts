import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Connection, Edge, Node, ReactFlowInstance } from '@xyflow/react';
import { addEdge, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import api from '../../../../lib/api';
import { useToast } from '../../../../contexts/ToastContext';
import type { Agent, ApprovalNodeData, Provider, ProviderNodeData, WorkflowData } from './types';

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
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null!);

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/agents');
      return res.data.data as Agent[];
    },
  });

  const { data: providers } = useQuery({
    queryKey: ['workflow-providers'],
    queryFn: async () => {
      const res = await api.get('/workflows/providers/list');
      return (res.data.data || []) as Provider[];
    },
  });

  const { data: workflow } = useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const res = await api.get(`/workflows/${id}`);
      return res.data.data;
    },
    enabled: !!id && id !== 'new',
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const saveHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (workflow && !initializedRef.current) {
      initializedRef.current = true;
      setName(workflow.name);
      setDescription(workflow.description);
      setIsTemplate(workflow.is_template === 1);
      if (workflow.nodes && workflow.nodes.length > 0) {
        setNodes(workflow.nodes);
      }
      if (workflow.edges && workflow.edges.length > 0) {
        setEdges(workflow.edges);
      }
      setHistory([{ nodes: workflow.nodes || [], edges: workflow.edges || [] }]);
      setHistoryIndex(0);
    }
  }, [workflow, setNodes, setEdges]);

  const saveHistoryRef = useRef(saveHistory);
  useEffect(() => {
    saveHistoryRef.current = saveHistory;
  }, [saveHistory]);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const timer = setTimeout(() => {
        saveHistoryRef.current();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, edges.length]);

  const validateWorkflow = useCallback(() => {
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

    setValidationErrors(errors);
    return errors.length === 0;
  }, [name, nodes, edges]);

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

      if (nodeType === 'approval') {
        const newNode: Node = {
          id: `node-${Date.now()}`,
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

      if (nodeType === 'provider') {
        const providerId = event.dataTransfer.getData('application/reactflow/providerId');
        const providerName = event.dataTransfer.getData('application/reactflow/providerName');
        const providerType = event.dataTransfer.getData('application/reactflow/providerType');
        const providerSchema = event.dataTransfer.getData('application/reactflow/providerSchema');
        const newNode: Node = {
          id: `node-${Date.now()}`,
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

      const agentId = event.dataTransfer.getData('application/reactflow/agentId');
      const agentName = event.dataTransfer.getData('application/reactflow/agentName');
      const agentAvatar = event.dataTransfer.getData('application/reactflow/agentAvatar');
      const agentDescription = event.dataTransfer.getData('application/reactflow/agentDescription');
      const agentSystemPrompt = event.dataTransfer.getData('application/reactflow/agentSystemPrompt');

      if (typeof agentId !== 'string') return;

      const newNode: Node = {
        id: `node-${Date.now()}`,
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

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges]);

  const duplicateSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const newNode: Node = {
      ...selectedNode,
      id: `node-${Date.now()}`,
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
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex, setNodes, setEdges]);

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
  }, [name, description, nodes, edges, isTemplate, saveMutation, validateWorkflow, validationErrors, toast]);

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
    [setNodes, setEdges, toast],
  );

  const handleClear = useCallback(() => {
    if (confirm('确定要清空画布吗？此操作不可撤销。')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
    }
  }, [setNodes, setEdges]);

  const updateNodeLabel = useCallback(
    (nodeId: string, value: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: value } } : n)),
      );
      setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, label: value } } : null));
    },
    [setNodes],
  );

  const updateNodeDescription = useCallback(
    (nodeId: string, value: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, description: value } } : n)),
      );
      setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, description: value } } : null));
    },
    [setNodes],
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
      );
      setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, ...data } } : null));
    },
    [setNodes],
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
        if (!prev) return null;
        const existing = (prev.data as ApprovalNodeData)?.approvalConfig || {};
        return { ...prev, data: { ...prev.data, approvalConfig: { ...existing, ...partial } } };
      });
    },
    [setNodes],
  );

  const updateProviderId = useCallback(
    (nodeId: string, pid: string) => {
      const p = (providers || []).find((prov) => prov.id === pid);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  providerId: pid,
                  providerName: p?.name || '',
                  providerType: p?.type || '',
                  configSchema: p?.configSchema || null,
                  method: '',
                  config: {},
                },
              }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev
          ? {
              ...prev,
              data: {
                ...prev.data,
                providerId: pid,
                providerName: p?.name || '',
                providerType: p?.type || '',
                configSchema: p?.configSchema || null,
                method: '',
                config: {},
              },
            }
          : null,
      );
    },
    [providers, setNodes],
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
        if (!prev) return null;
        const existing = (prev.data as ProviderNodeData)?.config || {};
        return { ...prev, data: { ...prev.data, config: { ...existing, [key]: value } } };
      });
    },
    [setNodes],
  );

  const proOptions = { hideAttribution: true };

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
    onConnect,
    onDragOver,
    onDrop,
    onNodeClick,
    onPaneClick,
    reactFlowWrapper,
    reactFlowInstance,
    setReactFlowInstance,
    selectedNode,
    validationErrors,
    agents: agents || [],
    providers: providers || [],
    saveMutation,
    handleUndo,
    handleRedo,
    handleSave,
    handleExecute,
    handleExport,
    handleImport,
    handleClear,
    fileInputRef,
    historyIndex,
    historyLength: history.length,
    deleteSelectedNode,
    duplicateSelectedNode,
    updateNodeLabel,
    updateNodeDescription,
    updateNodeInputKey,
    updateNodeOutputKey,
    updateNodePrompt,
    updateApprovalConfig,
    updateProviderId,
    updateProviderConfig,
    proOptions,
  };
}