import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import type { Agent, AIModel } from './types';
import AgentEditorTestModal from './AgentEditorTestModal';

interface AgentEditorProps {
  agent: Agent | null;
  onClose: () => void;
}

export default function AgentEditor({ agent, onClose }: AgentEditorProps) {
  const queryClient = useQueryClient();
  const [tagsInput, setTagsInput] = useState(
    Array.isArray(agent?.tags) ? agent.tags.join(', ') : ''
  );
  const [showTestModal, setShowTestModal] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: aiModels } = useQuery({
    queryKey: ['aiModels'],
    queryFn: async () => {
      const res = await api.get('/ai-models');
      return res.data.data as AIModel[];
    }
  });

  const [formData, setFormData] = useState({
    name: agent?.name || '',
    avatar: agent?.avatar || '🤖',
    role: agent?.role || '',
    system_prompt: agent?.system_prompt || '',
    model: agent?.model || 'doubao-4o',
    temperature: agent?.temperature || 0.7,
    enabled: agent?.enabled !== 0,
    category: agent?.category || '',
    description: agent?.description || '',
    primary_model_id: agent?.primary_model_id || '',
    fallback_model_id: agent?.fallback_model_id || '',
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData & { tags?: string[] }) => {
      if (agent) {
        await api.put(`/agents/${agent.id}`, data);
      } else {
        await api.post('/agents', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    mutation.mutate({ ...formData, tags });
  };

  const handleTest = async () => {
    if (!testInput.trim()) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const testAgent = {
        ...formData,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        id: agent?.id || 'test'
      };

      const res = await api.post(`/agents/${testAgent.id}/test`, {
        input: testInput
      });

      setTestResult(res.data.data.result || '测试完成，无返回结果');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setTestResult(`测试失败: ${err.response?.data?.error || err.response?.data?.message || err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border shadow-2xl shadow-blue-500/10">
        <h2 className="text-xl font-bold text-text-primary mb-6">
          {agent ? '编辑Agent' : '新建Agent'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Agent名称
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                头像
              </label>
              <input
                type="text"
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="使用emoji作为头像"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                角色描述
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                分类
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="" className="bg-surface">选择分类...</option>
                <option value="告警处理" className="bg-surface">告警处理</option>
                <option value="故障处理" className="bg-surface">故障处理</option>
                <option value="数据分析" className="bg-surface">数据分析</option>
                <option value="巡检审计" className="bg-surface">巡检审计</option>
                <option value="服务器管理" className="bg-surface">服务器管理</option>
                <option value="操作执行" className="bg-surface">操作执行</option>
                <option value="文档报告" className="bg-surface">文档报告</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-20"
              placeholder="简短描述这个Agent的作用"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              系统提示词
            </label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-40"
              required
            />
          </div>

          <div className="bg-background rounded-xl p-4 border border-border/30">
            <label className="block text-sm font-medium text-text-primary mb-3">
              主模型 *
            </label>
            <select
              value={formData.primary_model_id}
              onChange={(e) => setFormData({ ...formData, primary_model_id: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="" className="bg-surface">选择主模型...</option>
              {(aiModels || []).filter((m: { enabled: number }) => m.enabled === 1).map((model: { id: string; name: string }) => (
                <option key={model.id} value={model.id} className="bg-surface">
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary mt-1">
              Agent 执行时优先使用的模型
            </p>
          </div>

          <div className="bg-background rounded-xl p-4 border border-border/30">
            <label className="block text-sm font-medium text-text-primary mb-3">
              备选模型 (可选)
            </label>
            <select
              value={formData.fallback_model_id}
              onChange={(e) => setFormData({ ...formData, fallback_model_id: e.target.value })}
              className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="" className="bg-surface">选择备选模型...</option>
              {(aiModels || []).filter((m: { enabled: number }) => m.enabled === 1).map((model: { id: string; name: string }) => (
                <option key={model.id} value={model.id} className="bg-surface">
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary mt-1">
              主模型失败时自动切换到备选模型
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                温度参数
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                标签 (逗号分隔)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="例如: 运维, 自动化, 测试"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50"
            />
            <label htmlFor="enabled" className="text-sm text-text-primary">
              启用此Agent
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-400 border border-blue-500/30 rounded-xl hover:from-blue-600/30 hover:to-purple-600/30 transition-all font-semibold"
            >
              🧪 测试 Agent
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all font-semibold border border-slate-600/30"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:shadow-none transition-all duration-300 font-semibold"
            >
              {mutation.isPending ? '保存中...' : (agent ? '保存' : '创建')}
            </button>
          </div>
        </form>

        {/* 测试模态框 */}
        {showTestModal && (
          <AgentEditorTestModal
            testInput={testInput}
            setTestInput={setTestInput}
            testResult={testResult}
            testLoading={testLoading}
            onTest={handleTest}
            onClose={() => setShowTestModal(false)}
          />
        )}
      </div>
    </div>
  );
}