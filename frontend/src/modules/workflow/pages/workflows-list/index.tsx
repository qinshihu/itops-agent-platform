import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch, Plus, Sparkles, Edit, Cpu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../../lib/api';
import type { Workflow, Server, WorkflowNode } from './types';
import WorkflowToolbar from './WorkflowToolbar';
import WorkflowCard from './WorkflowCard';
import ServerSelectModal from './ServerSelectModal';
import DeleteConfirmModal from './DeleteConfirmModal';

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

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const { data } = await api.get('/servers');
      return data as Server[];
    },
  });

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const { data } = await api.get('/workflows');
      return data as Workflow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      await api.delete(`/workflows/${workflowId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setDeleteConfirmId(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      const { id: _id, created_at: _created_at, updated_at: _updated_at, ...cleanWorkflow } = {
        ...workflow,
        name: `${workflow.name} (副本)`,
        is_template: 0,
      };
      await api.post('/workflows', cleanWorkflow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async ({ workflowId, context }: { workflowId: string; context?: Record<string, unknown> }) => {
      const { data } = await api.post('/tasks', {
        workflow_id: workflowId,
        name: 'Task',
        input: '开始执行工作流',
        context
      });
      return data;
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
    return workflow.nodes?.some((node: WorkflowNode) =>
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
      setSelectedServers([]);
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

  const handleEdit = (workflow: Workflow) => {
    navigate(`/workflows/${workflow.id}`);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <WorkflowToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterTemplate={filterTemplate}
          onFilterChange={setFilterTemplate}
          onCreateNew={() => navigate('/workflows/new')}
        />

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
          <ServerSelectModal
            workflow={selectedWorkflowForServer}
            servers={servers || []}
            selectedServers={selectedServers}
            executingWorkflow={executingWorkflow}
            onToggleServer={toggleServerSelection}
            onSelectAll={selectAllServers}
            onClearSelection={clearServerSelection}
            onCancel={() => {
              setShowServerSelectModal(false);
              setSelectedWorkflowForServer(null);
              setSelectedServers([]);
            }}
            onExecute={handleSelectServersAndExecute}
          />
        )}

        {/* Delete Confirm Modal */}
        {deleteConfirmId && (
          <DeleteConfirmModal
            isPending={deleteMutation.isPending}
            onCancel={() => setDeleteConfirmId(null)}
            onConfirm={() => handleDelete(deleteConfirmId)}
          />
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
            {filteredWorkflows?.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                isExecuting={executingWorkflow === workflow.id}
                onExecute={handleExecute}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteConfirmId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}