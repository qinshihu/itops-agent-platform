import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Play, Pause } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';

interface ScheduledTask {
  id: string;
  name: string;
  description: string | null;
  workflow_id: string | null;
  cron_expression: string;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  workflow_name: string;
}

interface Workflow {
  id: string;
  name: string;
}

export default function ScheduledTasks() {
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    workflow_id: '',
    cron_expression: '',
    enabled: true,
  });
  const queryClient = useQueryClient();

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['scheduledTasks'],
    queryFn: async () => {
      const res = await api.get('/api/scheduled-tasks');
      return res.data.data as ScheduledTask[];
    },
  });

  const { data: workflowsData } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/api/workflows');
      return res.data.data as Workflow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/api/scheduled-tasks', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/api/scheduled-tasks/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      setShowModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/scheduled-tasks/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/scheduled-tasks/${id}/toggle`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (task: ScheduledTask) => {
    setEditingTask(task);
    setFormData({
      name: task.name,
      description: task.description || '',
      workflow_id: task.workflow_id || '',
      cron_expression: task.cron_expression,
      enabled: !!task.enabled,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingTask(null);
    setFormData({
      name: '',
      description: '',
      workflow_id: '',
      cron_expression: '',
      enabled: true,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '未执行';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">定时任务</h1>
            <p className="text-text-secondary">管理自动化任务</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            新建任务
          </button>
        </div>

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">名称</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">工作流</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Cron 表达式</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">状态</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">上次执行</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasksLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      加载中...
                    </td>
                  </tr>
                ) : tasksData?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      暂无定时任务
                    </td>
                  </tr>
                ) : (
                  tasksData?.map((task) => (
                    <tr key={task.id} className="hover:bg-background transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{task.name}</div>
                        {task.description && (
                          <div className="text-sm text-text-secondary">{task.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {task.workflow_name || '无'}
                      </td>
                      <td className="px-4 py-3">
                        <code className="px-2 py-1 bg-background rounded text-sm font-mono">
                          {task.cron_expression}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          task.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        )}>
                          {task.enabled ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatDate(task.last_run_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleMutation.mutate(task.id)}
                            disabled={toggleMutation.isPending}
                            className="p-2 hover:bg-background rounded-lg transition-colors"
                            title={task.enabled ? '禁用' : '启用'}
                          >
                            {task.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleEdit(task)}
                            className="p-2 hover:bg-background rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(task.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingTask ? '编辑定时任务' : '新建定时任务'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-background rounded"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">任务名称</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  placeholder="输入任务名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  rows={3}
                  placeholder="输入任务描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">关联工作流</label>
                <select
                  value={formData.workflow_id}
                  onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">选择工作流（可选）</option>
                  {workflowsData?.map((wf) => (
                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Cron 表达式</label>
                <input
                  type="text"
                  required
                  value={formData.cron_expression}
                  onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono"
                  placeholder="例如: 0 0 * * * (每天零点)"
                />
                <p className="text-xs text-text-secondary mt-1">
                  格式: 分 时 日 月 周
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <label htmlFor="enabled" className="text-sm text-text-secondary">启用任务</label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-background border border-border rounded-lg text-text-primary hover:bg-surface transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {editingTask ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
