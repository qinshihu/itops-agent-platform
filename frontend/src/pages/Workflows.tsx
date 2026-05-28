import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch, Play, Clock, Plus, Edit, Server,
  Search, Filter, Copy, Trash2, XCircle,
  Zap, Shield, Database, Globe, Cpu, AlertTriangle,
  ArrowRight, Sparkles, CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  is_template: number;
  created_at: string;
  updated_at?: string;
}

interface Server {
  id: string;
  name: string;
  hostname: string;
}

export default function Workflows() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);
  const [selectedWorkflowForServer, setSelectedWorkflowForServer] = useState<Workflow | null>(null);
  const [showServerSelectModal, setShowServerSelectModal] = useState(false);
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTemplate, setFilterTemplate] = useState<'all' | 'template' | 'custom'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const getWorkflowStyle = (workflow: Workflow) => {
    const serverNames = ['服务器', '巡检', '合规'];
    const securityNames = ['安全', '漏洞'];
    const dataNames = ['数据', '备份', '恢复'];
    const networkNames = ['网络', 'DNS'];
    const systemNames = ['系统', '性能', '监控'];
    
    const name = workflow.name.toLowerCase();
    
    if (serverNames.some(n => name.includes(n))) {
      return { icon: Server as any, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' };
    }
    if (securityNames.some(n => name.includes(n))) {
      return { icon: Shield, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    }
    if (dataNames.some(n => name.includes(n))) {
      return { icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
    }
    if (networkNames.some(n => name.includes(n))) {
      return { icon: Globe, color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
    }
    if (systemNames.some(n => name.includes(n))) {
      return { icon: Cpu, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
    }
    
    if (workflow.is_template === 1) {
      return { icon: Sparkles, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
    }
    
    return { icon: GitBranch, color: 'text-text-secondary', bg: 'bg-text-secondary/10', border: 'border-text-secondary/30' };
  };
  
  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await api.get('/api/servers');
      return res.data.data as Server[];
    },
  });

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/api/workflows');
      return res.data.data as Workflow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      await api.delete(`/api/workflows/${workflowId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setDeleteConfirmId(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      const newWorkflow = {
        ...workflow,
        name: `${workflow.name} (副本)`,
        is_template: 0,
      };
      delete (newWorkflow as any).id;
      delete (newWorkflow as any).created_at;
      delete (newWorkflow as any).updated_at;
      await api.post('/api/workflows', newWorkflow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async ({ workflowId, context }: { workflowId: string; context?: any }) => {
      const res = await api.post('/api/tasks', {
        workflow_id: workflowId,
        name: 'Task',
        input: '开始执行工作流',
        context
      });
      return res.data.data;
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate(`/tasks`);
    },
  });

  const isServerRelatedWorkflow = (workflow: Workflow) => {
    const serverAgentNames = [
      '服务器命令执行', 
      '自动巡检', 
      '合规检查',
      '系统巡检',
      '变更执行',
      '服务器'
    ];
    return workflow.nodes?.some((node: any) => 
      serverAgentNames.some(name => node.data?.label?.includes(name))
    );
  };

  const filteredWorkflows = workflows?.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        workflow.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterTemplate === 'all' ||
                        (filterTemplate === 'template' && workflow.is_template === 1) ||
                        (filterTemplate === 'custom' && workflow.is_template === 0);
    return matchesSearch && matchesFilter;
  });

  const handleExecute = (workflow: Workflow) => {
    if (isServerRelatedWorkflow(workflow) && servers && servers.length > 0) {
      setSelectedWorkflowForServer(workflow);
      setSelectedServers([]); // 重置选择
      setShowServerSelectModal(true);
    } else {
      if (confirm(`确定要执行工作流 "${workflow.name}" 吗？`)) {
        setExecutingWorkflow(workflow.id);
        executeMutation.mutate({ workflowId: workflow.id }, {
          onSettled: () => setExecutingWorkflow(null),
        });
      }
    }
  };

  const toggleServerSelection = (serverId: string) => {
    setSelectedServers(prev => {
      if (prev.includes(serverId)) {
        return prev.filter(id => id !== serverId);
      } else {
        return [...prev, serverId];
      }
    });
  };

  const selectAllServers = () => {
    if (servers) {
      setSelectedServers(servers.map(s => s.id));
    }
  };

  const clearServerSelection = () => {
    setSelectedServers([]);
  };

  const handleSelectServersAndExecute = () => {
    if (selectedWorkflowForServer && selectedServers.length > 0) {
      setExecutingWorkflow(selectedWorkflowForServer.id);
      executeMutation.mutate(
        { 
          workflowId: selectedWorkflowForServer.id, 
          context: { serverIds: selectedServers } 
        },
        {
          onSettled: () => {
            setExecutingWorkflow(null);
            setShowServerSelectModal(false);
            setSelectedWorkflowForServer(null);
            setSelectedServers([]);
          },
        }
      );
    }
  };

  const handleDuplicate = (workflow: Workflow) => {
    if (confirm(`确定要复制工作流 "${workflow.name}" 吗？`)) {
      duplicateMutation.mutate(workflow);
    }
  };

  const handleDelete = (workflowId: string) => {
    deleteMutation.mutate(workflowId);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">工作流管理</h1>
            <p className="text-text-secondary">管理和执行运维自动化工作流</p>
          </div>
          <button
            onClick={() => navigate('/workflows/new')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建工作流
          </button>
        </div>

        {/* Search and Filter */}
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="搜索工作流..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-secondary" />
              <select
                value={filterTemplate}
                onChange={(e) => setFilterTemplate(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none"
              >
                <option value="all">全部</option>
                <option value="template">仅模板</option>
                <option value="custom">仅自定义</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface rounded-xl p-5 border border-border hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <GitBranch className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold text-text-primary mb-1">{workflows?.length || 0}</div>
            <div className="text-sm text-text-secondary">总工作流</div>
          </div>
          <div className="bg-surface rounded-xl p-5 border border-border hover:border-purple-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <div className="text-3xl font-bold text-purple-500 mb-1">
              {workflows?.filter(w => w.is_template === 1).length || 0}
            </div>
            <div className="text-sm text-text-secondary">模板</div>
          </div>
          <div className="bg-surface rounded-xl p-5 border border-border hover:border-blue-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Edit className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-500 mb-1">
              {workflows?.filter(w => w.is_template === 0).length || 0}
            </div>
            <div className="text-sm text-text-secondary">自定义</div>
          </div>
          <div className="bg-surface rounded-xl p-5 border border-border hover:border-green-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Cpu className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <div className="text-3xl font-bold text-green-500 mb-1">
              {workflows?.reduce((acc, w) => acc + (w.nodes?.length || 0), 0) || 0}
            </div>
            <div className="text-sm text-text-secondary">总节点</div>
          </div>
        </div>

        {/* Server Select Modal */}
        {showServerSelectModal && selectedWorkflowForServer && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4">
              <h3 className="text-xl font-bold text-text-primary mb-2">选择服务器</h3>
              <p className="text-text-secondary mb-4">
                请选择要在哪些服务器上执行工作流 &quot;{selectedWorkflowForServer.name}&quot;
              </p>
              
              {/* Selection Controls */}
              <div className="flex items-center justify-between mb-4 p-3 bg-background rounded-lg border border-border">
                <span className="text-sm text-text-secondary">
                  已选择: <span className="font-medium text-primary">{selectedServers.length}</span> / {servers?.length || 0}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllServers}
                    className="text-sm px-3 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                  >
                    全选
                  </button>
                  <button
                    onClick={clearServerSelection}
                    className="text-sm px-3 py-1 bg-surface border border-border text-text-secondary rounded hover:bg-background transition-colors"
                  >
                    清空
                  </button>
                </div>
              </div>
              
              {/* Server List */}
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {servers?.map((server) => (
                  <button
                    key={server.id}
                    onClick={() => toggleServerSelection(server.id)}
                    disabled={!!executingWorkflow}
                    className={`w-full p-4 text-left rounded-lg border transition-all disabled:opacity-50 flex items-center gap-3 ${
                      selectedServers.includes(server.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary hover:bg-primary/5'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedServers.includes(server.id)
                        ? 'bg-primary border-primary text-white'
                        : 'border-gray-300'
                    }`}>
                      {selectedServers.includes(server.id) && <CheckCircle className="w-3.5 h-3.5" />}
                    </div>
                    <Server className={`w-5 h-5 ${selectedServers.includes(server.id) ? 'text-primary' : 'text-gray-400'}`} />
                    <div className="flex-1">
                      <div className="font-medium text-text-primary">{server.name}</div>
                      <div className="text-sm text-text-secondary">{server.hostname}</div>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowServerSelectModal(false);
                    setSelectedWorkflowForServer(null);
                    setSelectedServers([]);
                  }}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSelectServersAndExecute}
                  disabled={selectedServers.length === 0 || !!executingWorkflow}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executingWorkflow ? '执行中...' : `执行 (${selectedServers.length}台)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-500/10 rounded-full">
                  <XCircle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-text-primary">确认删除</h3>
              </div>
              <p className="text-text-secondary mb-6">
                确定要删除这个工作流吗？此操作不可撤销。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredWorkflows?.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-xl border border-border">
            <GitBranch className="w-16 h-16 text-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">暂无工作流</h3>
            <p className="text-text-secondary mb-6">
              {searchQuery || filterTemplate !== 'all' ? '没有找到匹配的工作流' : '开始创建您的第一个工作流'}
            </p>
            <button
              onClick={() => navigate('/workflows/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建工作流
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredWorkflows?.map((workflow) => {
              const style = getWorkflowStyle(workflow);
              const Icon = style.icon;
              
              return (
                <div
                  key={workflow.id}
                  className="bg-surface rounded-2xl border border-border hover:border-primary/30 transition-all group relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${style.bg}`} />
                  
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${style.bg} group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-6 h-6 ${style.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-text-primary truncate">{workflow.name}</h3>
                            {workflow.is_template === 1 && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-primary/20 to-purple-500/20 text-primary text-xs rounded-full border border-primary/20">
                                <Sparkles className="w-3 h-3" />
                                模板
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-text-secondary" />
                            <span className="text-xs text-text-secondary">
                              {formatDistanceToNow(new Date(workflow.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDuplicate(workflow)}
                              className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                              title="复制"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(workflow.id)}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-text-secondary mb-4 line-clamp-2 min-h-[40px]">
                      {workflow.description || '暂无描述'}
                    </p>

                    <div className="bg-gradient-to-br from-background/80 to-background/40 rounded-xl p-5 mb-4 border border-border/60">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-primary" />
                          执行流程
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">
                            {workflow.nodes?.length || 0} 节点
                          </span>
                          <span className="text-xs text-text-tertiary">|</span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/10 text-purple-500 rounded-md text-xs font-medium">
                            {workflow.edges?.length || 0} 连接
                          </span>
                        </div>
                      </div>
                      
                      <div className="min-h-[60px]">
                        {workflow.nodes && workflow.nodes.length > 0 ? (
                          <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {(() => {
                              const nodeMap = new Map((workflow.nodes || []).map(node => [node.id, node]));
                              const edgeMap = new Map<string, string[]>();
                              
                              // 构建连接关系
                              (workflow.edges || []).forEach(edge => {
                                const targets = edgeMap.get(edge.source) || [];
                                targets.push(edge.target);
                                edgeMap.set(edge.source, targets);
                              });
                              
                              // 找到起始节点（没有入边的节点）
                              const targetIds = new Set((workflow.edges || []).map(e => e.target));
                              const startNodes = (workflow.nodes || []).filter(n => !targetIds.has(n.id));
                              
                              // 如果只有一个起始节点，尝试构建一个简化的线性流程
                              if (startNodes.length === 1) {
                                const orderedNodes: any[] = [];
                                let currentId: string | null = startNodes[0].id;
                                const visited = new Set<string>();
                                
                                while (currentId && !visited.has(currentId) && orderedNodes.length < 5) {
                                  visited.add(currentId);
                                  const node = nodeMap.get(currentId);
                                  if (node) orderedNodes.push(node);
                                  const nextTargets = edgeMap.get(currentId) || [];
                                  currentId = nextTargets.length > 0 ? nextTargets[0] : null;
                                }
                                
                                return orderedNodes.map((node, index) => (
                                  <div key={node.id} className="flex items-center shrink-0">
                                    <div className="px-4 py-2.5 bg-gradient-to-r from-surface to-background rounded-lg border-2 border-primary/20 hover:border-primary/50 transition-all shadow-sm flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                                      </div>
                                      <span className="text-sm font-medium text-text-primary truncate max-w-28">
                                        {node.data?.label || '节点'}
                                      </span>
                                    </div>
                                    {index < orderedNodes.length - 1 && (
                                      <div className="flex items-center px-1">
                                        <div className="w-6 h-px bg-gradient-to-r from-primary/50 to-primary/30" />
                                        <ArrowRight className="w-3 h-3 text-primary/60 mx-0.5" />
                                        <div className="w-6 h-px bg-gradient-to-l from-primary/50 to-primary/30" />
                                      </div>
                                    )}
                                  </div>
                                ));
                              }
                              
                              // 否则显示前几个节点
                              return (workflow.nodes || []).slice(0, 4).map((node, index) => (
                                <div key={node.id} className="flex items-center shrink-0">
                                  <div className="px-4 py-2.5 bg-gradient-to-r from-surface to-background rounded-lg border-2 border-border/70 hover:border-primary/40 transition-all shadow-sm flex items-center gap-2">
                                    <span className="text-sm font-medium text-text-primary truncate max-w-24">
                                      {node.data?.label || '节点'}
                                    </span>
                                  </div>
                                  {index < Math.min((workflow.nodes || []).length, 4) - 1 && (
                                    <ArrowRight className="w-4 h-4 text-text-tertiary mx-1" />
                                  )}
                                </div>
                              ));
                            })()}
                            
                            {workflow.nodes && workflow.nodes.length > 4 && (
                              <div className="shrink-0 ml-1 px-3 py-2 bg-gradient-to-r from-primary/5 to-purple-500/5 text-primary rounded-lg border border-primary/20 flex items-center gap-1.5">
                                <span className="text-sm font-medium">+{workflow.nodes.length - 4}</span>
                                <span className="text-xs text-text-secondary">更多</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-16 text-text-tertiary text-sm italic border-2 border-dashed border-border/50 rounded-lg">
                            暂无节点，点击编辑添加
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleExecute(workflow)}
                        disabled={executingWorkflow === workflow.id || (workflow.nodes?.length || 0) === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-purple-600 text-white rounded-xl hover:from-primary/90 hover:to-purple-600/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/25"
                      >
                        <Play className="w-4 h-4" />
                        {executingWorkflow === workflow.id ? '执行中...' : '立即执行'}
                      </button>
                      <button
                        onClick={() => navigate(`/workflows/${workflow.id}`)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-background border border-border text-text-primary rounded-xl hover:bg-background/80 hover:border-primary/30 transition-all"
                      >
                        <Edit className="w-4 h-4" />
                        编辑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
