/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Connection,
  Edge,
  Node,
  NodeTypes,
} from '@xyflow/react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Save, Trash2, ArrowLeft, Play, Download, Upload, 
  Copy, Undo, Redo, Settings, AlertCircle,
  Layers, Shield, Zap, Wrench
} from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  model: string;
  temperature: number;
  enabled: number;
  system_prompt?: string;
  description?: string;
}

interface WorkflowData {
  id?: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  is_template?: number;
}

import { Handle, Position } from '@xyflow/react';

const AgentNode = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 min-w-[200px]
        ${selected ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border bg-surface'}
        transition-all duration-200
      `}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{data.avatar || '🤖'}</span>
        <span className="font-semibold text-text-primary text-sm">{data.label || 'Agent'}</span>
      </div>
      {data.description && (
        <div className="text-xs text-text-secondary mb-2 line-clamp-2">{data.description}</div>
      )}
      {/* 输入输出显示 */}
      <div className="space-y-1 mb-2">
        {data.inputKey && (
          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
            ← 输入: {data.inputKey}
          </div>
        )}
        {data.outputKey && (
          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
          → 输出: {data.outputKey}
          </div>
        )}
      </div>
      {data.prompt && (
        <div className="text-xs text-text-secondary bg-background px-2 py-1 rounded border border-border">
          已配置Prompt
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary" />
    </div>
  );
};

const ApprovalNode = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 min-w-[200px]
        ${selected ? 'border-orange-500 bg-orange-500/15 ring-2 ring-orange-500/30' : 'border-orange-500/50 bg-orange-500/10'}
        transition-all duration-200
      `}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500" />
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-6 h-6 text-orange-400" />
        <span className="font-semibold text-text-primary text-sm">{data.label || '审批节点'}</span>
      </div>
      {data.description && (
        <div className="text-xs text-text-secondary mb-2 line-clamp-2">{data.description}</div>
      )}
      {data.approvalConfig && (
        <div className="text-xs text-orange-300 bg-orange-500/15 px-2 py-1 rounded border border-orange-500/30">
          ⏱️ 超时: {data.approvalConfig.timeout || 3600}秒
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500" />
    </div>
  );
};

const ProviderNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const typeColors: Record<string, string> = {
    notification: 'border-blue-500 bg-blue-500/10',
    action: 'border-green-500 bg-green-500/10',
    script: 'border-purple-500 bg-purple-500/10',
    alert: 'border-red-500 bg-red-500/10',
  };
  const typeIcons: Record<string, string> = {
    notification: '🔔',
    action: '⚡',
    script: '📜',
    alert: '🚨',
  };
  const tc = typeColors[data.providerType] || 'border-gray-500 bg-gray-500/10';
  const ti = typeIcons[data.providerType] || '🔧';

  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 min-w-[200px]
        ${selected ? `ring-2 ring-primary/30 ${tc}` : tc}
        transition-all duration-200
      `}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{ti}</span>
        <span className="font-semibold text-text-primary text-sm">{data.label || 'Provider'}</span>
      </div>
      {data.providerName && (
        <div className="text-xs text-text-secondary mb-1">
          {data.providerName}
        </div>
      )}
      {data.method && (
        <div className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/30">
          {data.method}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary" />
    </div>
  );
};

// ====== 补充未注册节点类型的简洁渲染 ======
const defaultNodeStyle = (color: string, selected: boolean) =>
  `px-4 py-3 rounded-lg shadow-md border-2 min-w-[140px] ${selected ? `border-${color}-500 bg-${color}-500/20 ring-2 ring-${color}-500/30` : `border-${color}-500/40 bg-${color}-500/10`} transition-all duration-200`;

const StartNode = ({ data, selected }: any) => (
  <div className={defaultNodeStyle('green', selected)} style={{ borderRadius: '9999px' }}>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500" />
    <span className="font-semibold text-sm">{data.label || '开始'}</span>
  </div>
);

const EndNode = ({ data, selected }: any) => (
  <div className={defaultNodeStyle('red', selected)} style={{ borderRadius: '9999px' }}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-red-500" />
    <span className="font-semibold text-sm">{data.label || '结束'}</span>
  </div>
);

const ConditionNode = ({ data, selected }: any) => (
  <div className={defaultNodeStyle('yellow', selected)} style={{ transform: 'rotate(0deg)' }}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-yellow-500" />
    <div className="text-sm font-semibold">◇ {data.label || '条件'}</div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-yellow-500" />
  </div>
);

const VerificationNode = ({ data, selected }: any) => (
  <div className={defaultNodeStyle('cyan', selected)}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-cyan-500" />
    <div className="flex items-center gap-1"><Shield className="w-4 h-4 text-cyan-400" /><span className="font-semibold text-sm">{data.label || '验证'}</span></div>
    {data.gates && <div className="text-xs text-cyan-300 mt-1">{data.gates.length} 级门禁</div>}
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-cyan-500" />
  </div>
);

const RiskAssessNode = ({ data, selected }: any) => (
  <div className={defaultNodeStyle('amber', selected)}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-amber-500" />
    <div className="flex items-center gap-1"><AlertCircle className="w-4 h-4 text-amber-400" /><span className="font-semibold text-sm">{data.label || '风险评估'}</span></div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-amber-500" />
  </div>
);

const DecisionNode = ({ data, selected }: any) => (
  <div className={defaultNodeStyle('indigo', selected)}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500" />
    <div className="flex items-center gap-1"><Zap className="w-4 h-4 text-indigo-400" /><span className="font-semibold text-sm">{data.label || '决策'}</span></div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500" />
  </div>
);

const KnowledgeNode = ({ data, selected }: any) => (
  <div className={defaultNodeStyle('emerald', selected)}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500" />
    <div className="flex items-center gap-1"><Save className="w-4 h-4 text-emerald-400" /><span className="font-semibold text-sm">{data.label || '知识沉淀'}</span></div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500" />
  </div>
);

const RollbackNode = ({ data, selected }: any) => (
  <div className={defaultNodeStyle('rose', selected)}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-rose-500" />
    <div className="flex items-center gap-1"><Undo className="w-4 h-4 text-rose-400" /><span className="font-semibold text-sm">{data.label || '回滚'}</span></div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-rose-500" />
  </div>
);

const GenericNode = ({ data, selected, icon, color }: any) => (
  <div className={defaultNodeStyle(color || 'gray', selected)}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-gray-400" />
    <span className="font-semibold text-sm">{data.label || '节点'}</span>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-gray-400" />
  </div>
);

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  approval: ApprovalNode,
  provider: ProviderNode,
  start: StartNode,
  end: EndNode,
  condition: ConditionNode,
  verification: VerificationNode,
  risk_assess: RiskAssessNode,
  decision: DecisionNode,
  knowledge: KnowledgeNode,
  rollback: RollbackNode,
  loop: (props) => <GenericNode {...props} color="violet" />,
  parallel: (props) => <GenericNode {...props} color="teal" />,
  webhook: (props) => <GenericNode {...props} color="sky" />,
  wait: (props) => <GenericNode {...props} color="slate" />,
  variable_set: (props) => <GenericNode {...props} color="lime" />,
};

function WorkflowEditorContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isTemplate, setIsTemplate] = useState(false);
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/api/agents');
      return res.data.data as Agent[];
    },
  });

  const { data: providers } = useQuery({
    queryKey: ['workflow-providers'],
    queryFn: async () => {
      const res = await api.get('/api/workflows/providers/list');
      return (res.data.data || []) as { id: string; name: string; type: string; configSchema: any }[];
    },
  });

  const { data: workflow } = useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const res = await api.get(`/api/workflows/${id}`);
      return res.data.data;
    },
    enabled: !!id && id !== 'new',
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Save history for undo/redo
  const saveHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // Initialize history
      setHistory([{ nodes: workflow.nodes || [], edges: workflow.edges || [] }]);
      setHistoryIndex(0);
    }
  }, [workflow, setNodes, setEdges]);

  // Track changes for history
  const saveHistoryRef = useRef(saveHistory);
  useEffect(() => {
    saveHistoryRef.current = saveHistory;
  }, [saveHistory]);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      // Debounce history save
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
    
    // Check for orphan nodes (except single node)
    if (nodes.length > 1) {
      const connectedNodes = new Set<string>();
      edges.forEach(e => {
        connectedNodes.add(e.source);
        connectedNodes.add(e.target);
      });
      
      const orphanNodes = nodes.filter(n => !connectedNodes.has(n.id));
      if (orphanNodes.length > 0) {
        errors.push(`发现 ${orphanNodes.length} 个孤立节点，请连接或删除`);
      }
    }
    
    // Check for cycles (simplified)
    setValidationErrors(errors);
    return errors.length === 0;
  }, [name, nodes, edges]);

  const saveMutation = useMutation({
    mutationFn: async (data: WorkflowData) => {
      if (!validateWorkflow()) {
        throw new Error('工作流验证失败');
      }
      
      if (id && id !== 'new') {
        await api.put(`/api/workflows/${id}`, data);
      } else {
        await api.post('/api/workflows', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate('/workflows');
      toast.success('保存成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '保存失败，请重试');
    },
  });

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({
        ...params,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#3b82f6', strokeWidth: 2 },
      }, eds));
    },
    [setEdges]
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
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // 审批节点
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

      // Provider 节点
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

      // Agent 节点
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
    [reactFlowInstance, setNodes]
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

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [setNodes, setEdges, toast]);

  const handleClear = useCallback(() => {
    if (confirm('确定要清空画布吗？此操作不可撤销。')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
    }
  }, [setNodes, setEdges]);

  const proOptions = { hideAttribution: true };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/workflows')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {id === 'new' ? '新建工作流' : '编辑工作流'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 rounded-lg hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="撤销"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 rounded-lg hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="重做"
            >
              <Redo className="w-4 h-4" />
            </button>
            
            <div className="w-px h-6 bg-border mx-2" />
            
            {/* Import/Export */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background transition-colors"
              title="导入工作流"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">导入</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background transition-colors"
              title="导出工作流"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">导出</span>
            </button>
            
            <div className="w-px h-6 bg-border mx-2" />
            
            {id && id !== 'new' && (
              <button
                onClick={handleExecute}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                立即执行
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">工作流名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：服务器CPU告警自动排查"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">工作流描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个工作流的用途"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isTemplate}
                onChange={(e) => setIsTemplate(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-text-secondary">设为模板</span>
            </label>
          </div>
        </div>
        
        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">发现问题</span>
            </div>
            <ul className="text-sm text-red-500 space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-80 border-r border-border bg-surface flex flex-col min-h-0">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" />
              可用节点
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {/* 审批节点拖拽入口 */}
              <div
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/reactflow/nodeType', 'approval');
                  event.dataTransfer.effectAllowed = 'move';
                }}
                className="p-3 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:border-orange-500 hover:bg-orange-500/15 cursor-move transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-5 h-5 text-orange-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-primary text-sm">审批节点</div>
                    <div className="text-xs text-text-secondary">人工确认</div>
                  </div>
                </div>
                <div className="text-xs text-text-secondary line-clamp-2 mt-1">
                  暂停工作流等待人工审批，支持超时自动拒绝
                </div>
              </div>

              {/* Agent 节点列表 */}
              <div className="pt-3 border-t border-border">
                <div className="text-xs font-semibold text-text-secondary mb-2">Agent 节点</div>
              </div>
              {(agents || []).filter(a => a.enabled === 1).map((agent) => (
                <div
                  key={agent.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/reactflow/nodeType', 'agent');
                    event.dataTransfer.setData('application/reactflow/agentId', agent.id);
                    event.dataTransfer.setData('application/reactflow/agentName', agent.name);
                    event.dataTransfer.setData('application/reactflow/agentAvatar', agent.avatar || '🤖');
                    event.dataTransfer.setData('application/reactflow/agentDescription', agent.description || '');
                    event.dataTransfer.setData('application/reactflow/agentSystemPrompt', agent.system_prompt || '');
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  className="p-3 rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/5 cursor-move transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{agent.avatar || '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-primary text-sm truncate">{agent.name}</div>
                      <div className="text-xs text-text-secondary truncate">{agent.role}</div>
                    </div>
                  </div>
                  {agent.description && (
                    <div className="text-xs text-text-secondary line-clamp-2 mt-1">
                      {agent.description}
                    </div>
                  )}
                </div>
              ))}
              {(agents || []).filter(a => a.enabled === 1).length === 0 && (
                <div className="text-center py-4 text-text-secondary">
                  <p className="text-xs">暂无可用Agent</p>
                </div>
              )}

              {/* Provider 节点列表 */}
              <div className="pt-3 border-t border-border">
                <div className="text-xs font-semibold text-text-secondary mb-2">Provider 节点（执行动作）</div>
              </div>
              {(providers || []).map((provider) => (
                <div
                  key={provider.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/reactflow/nodeType', 'provider');
                    event.dataTransfer.setData('application/reactflow/providerId', provider.id);
                    event.dataTransfer.setData('application/reactflow/providerName', provider.name);
                    event.dataTransfer.setData('application/reactflow/providerType', provider.type);
                    event.dataTransfer.setData('application/reactflow/providerSchema', JSON.stringify(provider.configSchema));
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  className="p-3 rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/5 cursor-move transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">
                      {provider.type === 'notification' ? '🔔' : provider.type === 'action' ? '⚡' : provider.type === 'script' ? '📜' : provider.type === 'alert' ? '🚨' : '🔧'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-primary text-sm truncate">{provider.name}</div>
                      <div className="text-xs text-text-secondary truncate">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          provider.type === 'notification' ? 'bg-blue-500/20 text-blue-400' :
                          provider.type === 'action' ? 'bg-green-500/20 text-green-400' :
                          provider.type === 'script' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {provider.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(providers || []).length === 0 && (
                <div className="text-center py-4 text-text-secondary">
                  <p className="text-xs">暂无可用Provider</p>
                </div>
              )}
            </div>
          </div>

          {selectedNode && (
            <div className="border-t border-border p-4 bg-background/50 overflow-y-auto max-h-96">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  节点配置
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={duplicateSelectedNode}
                    className="p-1 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                    title="复制节点"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={deleteSelectedNode}
                    className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    title="删除节点"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">显示名称</label>
                  <input
                    type="text"
                    value={(selectedNode.data?.label as string) || ''}
                    onChange={(e) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, label: e.target.value } }
                            : n
                        )
                      );
                      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, label: e.target.value } } : null);
                    }}
                    className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-text-secondary mb-2">节点描述</label>
                  <textarea
                    value={(selectedNode.data?.description as string) || ''}
                    onChange={(e) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, description: e.target.value } }
                            : n
                        )
                      );
                      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, description: e.target.value } } : null);
                    }}
                    placeholder="描述这个节点的作用"
                    rows={2}
                    className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none"
                  />
                </div>

                {/* 审批节点配置 */}
                {selectedNode.type === 'approval' && (
                  <div className="pt-3 border-t border-border">
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-orange-500" />
                      审批配置
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">审批说明</label>
                        <textarea
                          value={(selectedNode.data?.approvalConfig as any)?.description || ''}
                          onChange={(e) => {
                            const newConfig = {
                              ...(selectedNode.data?.approvalConfig as any),
                              description: e.target.value,
                            };
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, approvalConfig: newConfig } }
                                  : n
                              )
                            );
                            setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, approvalConfig: newConfig } } : null);
                          }}
                          placeholder="向审批人说明需要确认的内容"
                          rows={2}
                          className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">超时时间（秒）</label>
                        <input
                          type="number"
                          value={(selectedNode.data?.approvalConfig as any)?.timeout || 3600}
                          onChange={(e) => {
                            const newConfig = {
                              ...(selectedNode.data?.approvalConfig as any),
                              timeout: parseInt(e.target.value) || 3600,
                            };
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, approvalConfig: newConfig } }
                                  : n
                              )
                            );
                            setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, approvalConfig: newConfig } } : null);
                          }}
                          min={60}
                          className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                        />
                        <p className="text-xs text-text-secondary mt-1">超时后自动拒绝，0 表示不超时</p>
                      </div>
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">超时行为</label>
                        <select
                          value={(selectedNode.data?.approvalConfig as any)?.timeoutAction || 'reject'}
                          onChange={(e) => {
                            const newConfig = {
                              ...(selectedNode.data?.approvalConfig as any),
                              timeoutAction: e.target.value,
                            };
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, approvalConfig: newConfig } }
                                  : n
                              )
                            );
                            setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, approvalConfig: newConfig } } : null);
                          }}
                          className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                        >
                          <option value="reject">自动拒绝</option>
                          <option value="wait">继续等待</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Provider 节点配置 */}
                {selectedNode.type === 'provider' && (
                  <div className="pt-3 border-t border-border">
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-green-500" />
                      Provider 配置
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">Provider</label>
                        <select
                          value={(selectedNode.data?.providerId as string) || ''}
                          onChange={(e) => {
                            const pid = e.target.value;
                            const p = (providers || []).find(p => p.id === pid);
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, providerId: pid, providerName: p?.name || '', providerType: p?.type || '', configSchema: p?.configSchema || null, method: '', config: {} } }
                                  : n
                              )
                            );
                            setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, providerId: pid, providerName: p?.name || '', providerType: p?.type || '', configSchema: p?.configSchema || null, method: '', config: {} } } : null);
                          }}
                          className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                        >
                          <option value="">选择 Provider...</option>
                          {(providers || []).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                          ))}
                        </select>
                      </div>
                      {(selectedNode.data as any)?.configSchema?.properties && (
                        <div>
                          <label className="block text-sm text-text-secondary mb-2">配置参数</label>
                          <div className="space-y-2">
                            {Object.entries((selectedNode.data as any).configSchema.properties as Record<string, any>).map(([key, schema]: [string, any]) => (
                              <div key={key}>
                                <label className="block text-xs text-text-secondary mb-1">
                                  {schema.title || key}
                                  {schema.description && <span className="text-text-tertiary ml-1">({schema.description})</span>}
                                </label>
                                {schema.type === 'boolean' ? (
                                  <input
                                    type="checkbox"
                                    checked={!!(selectedNode.data?.config as any)?.[key]}
                                    onChange={(e) => {
                                      const newConfig = { ...(selectedNode.data?.config as any || {}), [key]: e.target.checked };
                                      setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, config: newConfig } } : n));
                                      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, config: newConfig } } : null);
                                    }}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                  />
                                ) : schema.enum ? (
                                  <select
                                    value={(selectedNode.data?.config as any)?.[key] || ''}
                                    onChange={(e) => {
                                      const newConfig = { ...(selectedNode.data?.config as any || {}), [key]: e.target.value };
                                      setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, config: newConfig } } : n));
                                      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, config: newConfig } } : null);
                                    }}
                                    className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                                  >
                                    <option value="">选择...</option>
                                    {schema.enum.map((v: string) => (
                                      <option key={v} value={v}>{v}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={schema.type === 'number' ? 'number' : 'text'}
                                    value={(selectedNode.data?.config as any)?.[key] || ''}
                                    onChange={(e) => {
                                      const val = schema.type === 'number' ? Number(e.target.value) : e.target.value;
                                      const newConfig = { ...(selectedNode.data?.config as any || {}), [key]: val };
                                      setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, config: newConfig } } : n));
                                      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, config: newConfig } } : null);
                                    }}
                                    placeholder={schema.default || ''}
                                    className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="pt-2 border-t border-border">
                        <div className="text-xs text-text-secondary space-y-1">
                          <p>• ID: {String(selectedNode.id)}</p>
                          <p>• Provider: {String(selectedNode.data?.providerName || '-')}</p>
                          <p>• 类型: {String(selectedNode.data?.providerType || '-')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Agent 节点配置 */}
                {selectedNode.type !== 'approval' && selectedNode.type !== 'provider' && (
                  <>
                    {/* 输入输出配置 */}
                    <div className="pt-3 border-t border-border">
                      <h4 className="text-sm font-semibold text-text-primary mb-3">数据流转配置</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-text-secondary mb-1 flex items-center gap-1">
                            <span className="text-blue-500">←</span>
                            输入键名
                          </label>
                          <input
                            type="text"
                            value={(selectedNode.data?.inputKey as string) || ''}
                            onChange={(e) => {
                              setNodes((nds) =>
                                nds.map((n) =>
                                  n.id === selectedNode.id
                                    ? { ...n, data: { ...n.data, inputKey: e.target.value } }
                                    : n
                                )
                              );
                              setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, inputKey: e.target.value } } : null);
                            }}
                            placeholder="例如: input, message"
                            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                          />
                          <p className="text-xs text-text-secondary mt-1">从上一节点接收的数据键</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm text-text-secondary mb-1 flex items-center gap-1">
                            <span className="text-green-500">→</span>
                            输出键名
                          </label>
                          <input
                            type="text"
                            value={(selectedNode.data?.outputKey as string) || ''}
                            onChange={(e) => {
                              setNodes((nds) =>
                                nds.map((n) =>
                                  n.id === selectedNode.id
                                    ? { ...n, data: { ...n.data, outputKey: e.target.value } }
                                    : n
                                )
                              );
                              setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, outputKey: e.target.value } } : null);
                            }}
                            placeholder="例如: result, output"
                            className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none text-sm"
                          />
                          <p className="text-xs text-text-secondary mt-1">传递给下一节点的数据键</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-border">
                      <label className="block text-sm text-text-secondary mb-2">自定义Prompt</label>
                      <textarea
                        value={(selectedNode.data?.prompt as string) || ''}
                        onChange={(e) => {
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, data: { ...n.data, prompt: e.target.value } }
                                : n
                            )
                          );
                          setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, prompt: e.target.value } } : null);
                        }}
                        placeholder="覆盖Agent的系统提示词（可选）"
                        rows={4}
                        className="w-full px-3 py-2 rounded bg-background border border-border focus:border-primary focus:outline-none resize-none font-mono text-sm"
                      />
                    </div>
                    
                    <div className="pt-2 border-t border-border">
                      <div className="text-xs text-text-secondary space-y-1">
                        <p>• ID: {String(selectedNode.id)}</p>
                        <p>• Agent ID: {String(selectedNode.data?.agentId || '-')}</p>
                        <p>• 位置: ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              proOptions={proOptions}
              fitView
            >
              <Background gap={16} size={1} />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  return node.selected ? '#3b82f6' : '#475569';
                }}
                className="border border-border rounded-lg overflow-hidden"
              />
              <Panel position="top-center">
                <div className="bg-surface/95 backdrop-blur-sm px-4 py-2 rounded-lg border border-border shadow-lg">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-text-secondary">
                      从左侧拖拽Agent到画布创建节点
                    </span>
                    <span className="text-text-secondary">•</span>
                    <span className="text-text-secondary">
                      {nodes.length} 个节点
                    </span>
                    <span className="text-text-secondary">•</span>
                    <span className="text-text-secondary">
                      {edges.length} 条连接
                    </span>
                  </div>
                </div>
              </Panel>
              <Panel position="bottom-left">
                <div className="bg-surface/95 backdrop-blur-sm p-2 rounded-lg border border-border">
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空画布
                  </button>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent />
    </ReactFlowProvider>
  );
}
