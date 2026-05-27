import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Trash2 } from 'lucide-react';

const EXECUTION_MODES = [
  { value: 'auto', label: '自动执行' },
  { value: 'approval', label: '审批后执行' },
  { value: 'suggestion', label: '仅建议' }
];

const SEVERITY_OPTIONS = [
  { value: 'disaster', label: '灾难' },
  { value: 'high', label: '高' },
  { value: 'average', label: '中' },
  { value: 'warning', label: '警告' },
  { value: 'info', label: '信息' }
];

const ALERT_SOURCES = ['zabbix', 'prometheus', 'custom'];

export default function RemediationPolicyEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    alert_source: 'zabbix',
    alert_severity: '',
    alert_keywords: '',
    alert_tags: '',
    execution_mode: 'approval',
    workflow_id: '',
    workflow_params: '{}',
    max_executions_per_hour: 5,
    cooldown_seconds: 300,
    enable_verification: false,
    verification_workflow_id: '',
    verification_params: '{}',
    verification_timeout_seconds: 120,
    enable_rollback: false,
    rollback_workflow_id: '',
    rollback_on_failure: true
  });

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/api/workflows');
      return res.data.data;
    }
  });

  const { data: policy, isLoading: isLoadingPolicy } = useQuery({
    queryKey: ['remediation-policy', id],
    queryFn: async () => {
      const res = await api.get(`/api/remediation-policies/${id}`);
      return res.data.data;
    },
    enabled: !isNew
  });

  useEffect(() => {
    if (policy) {
      setFormData({
        name: policy.name || '',
        description: policy.description || '',
        alert_source: policy.alert_source || 'zabbix',
        alert_severity: policy.alert_severity || '',
        alert_keywords: policy.alert_keywords ? JSON.parse(policy.alert_keywords).join(', ') : '',
        alert_tags: policy.alert_tags ? JSON.parse(policy.alert_tags).join(', ') : '',
        execution_mode: policy.execution_mode || 'approval',
        workflow_id: policy.workflow_id || '',
        workflow_params: policy.workflow_params || '{}',
        max_executions_per_hour: policy.max_executions_per_hour || 5,
        cooldown_seconds: policy.cooldown_seconds || 300,
        enable_verification: policy.enable_verification === 1,
        verification_workflow_id: policy.verification_workflow_id || '',
        verification_params: policy.verification_params || '{}',
        verification_timeout_seconds: policy.verification_timeout_seconds || 120,
        enable_rollback: policy.enable_rollback === 1,
        rollback_workflow_id: policy.rollback_workflow_id || '',
        rollback_on_failure: policy.rollback_on_failure === 1
      });
    }
  }, [policy]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...formData,
        alert_keywords: formData.alert_keywords ? JSON.stringify(formData.alert_keywords.split(',').map(s => s.trim()).filter(Boolean)) : null,
        alert_tags: formData.alert_tags ? JSON.stringify(formData.alert_tags.split(',').map(s => s.trim()).filter(Boolean)) : null,
      };
      if (isNew) {
        await api.post('/api/remediation-policies', data);
      } else {
        await api.put(`/api/remediation-policies/${id}`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-policies'] });
      navigate('/remediation-policies');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/remediation-policies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-policies'] });
      navigate('/remediation-policies');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const handleDelete = () => {
    if (confirm('确定要删除此策略吗？')) {
      deleteMutation.mutate();
    }
  };

  if (isLoadingPolicy) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-700/50 bg-slate-900/50 flex-shrink-0">
        <button
          onClick={() => navigate('/remediation-policies')}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">
            {isNew ? '新建修复策略' : '编辑修复策略'}
          </h2>
        </div>
        {!isNew && (
          <button
            onClick={handleDelete}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-all duration-200 shadow-lg shadow-blue-600/30"
        >
          <Save className="w-4 h-4" />
          保存
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <form onSubmit={handleSubmit} className="p-6 max-w-5xl">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-base font-semibold text-white mb-3">基本信息</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">策略名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="例如：磁盘空间不足自动清理"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">描述</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="策略描述"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mt-4">
            <h3 className="text-base font-semibold text-white mb-3">触发条件</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">告警来源 *</label>
                <select
                  required
                  value={formData.alert_source}
                  onChange={(e) => setFormData({ ...formData, alert_source: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {ALERT_SOURCES.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">告警级别</label>
                <select
                  value={formData.alert_severity}
                  onChange={(e) => setFormData({ ...formData, alert_severity: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">全部</option>
                  {SEVERITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">关键词匹配</label>
                <input
                  type="text"
                  value={formData.alert_keywords}
                  onChange={(e) => setFormData({ ...formData, alert_keywords: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="多个关键词用逗号分隔"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">标签匹配</label>
                <input
                  type="text"
                  value={formData.alert_tags}
                  onChange={(e) => setFormData({ ...formData, alert_tags: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="多个标签用逗号分隔"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mt-4">
            <h3 className="text-base font-semibold text-white mb-3">执行策略</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">执行模式 *</label>
                <select
                  required
                  value={formData.execution_mode}
                  onChange={(e) => setFormData({ ...formData, execution_mode: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {EXECUTION_MODES.map(mode => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">关联工作流</label>
                <select
                  value={formData.workflow_id}
                  onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">选择工作流</option>
                  {workflows?.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">工作流参数 (JSON)</label>
                <textarea
                  rows={2}
                  value={formData.workflow_params}
                  onChange={(e) => setFormData({ ...formData, workflow_params: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  placeholder='{"server_id": "{{alert.host}}"}'
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mt-4">
            <h3 className="text-base font-semibold text-white mb-3">触发控制</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">每小时最大执行次数</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_executions_per_hour}
                  onChange={(e) => setFormData({ ...formData, max_executions_per_hour: parseInt(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">冷却时间（秒）</label>
                <input
                  type="number"
                  min="0"
                  value={formData.cooldown_seconds}
                  onChange={(e) => setFormData({ ...formData, cooldown_seconds: parseInt(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mt-4">
            <h3 className="text-base font-semibold text-white mb-3">验证配置</h3>
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_verification}
                  onChange={(e) => setFormData({ ...formData, enable_verification: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-300">启用修复后验证</span>
              </label>
            </div>
            {formData.enable_verification && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">验证工作流</label>
                  <select
                    value={formData.verification_workflow_id}
                    onChange={(e) => setFormData({ ...formData, verification_workflow_id: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">选择工作流</option>
                    {workflows?.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">验证超时（秒）</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.verification_timeout_seconds}
                    onChange={(e) => setFormData({ ...formData, verification_timeout_seconds: parseInt(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">验证参数 (JSON)</label>
                  <textarea
                    rows={2}
                    value={formData.verification_params}
                    onChange={(e) => setFormData({ ...formData, verification_params: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mt-4">
            <h3 className="text-base font-semibold text-white mb-3">回滚配置</h3>
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_rollback}
                  onChange={(e) => setFormData({ ...formData, enable_rollback: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-300">启用自动回滚</span>
              </label>
            </div>
            {formData.enable_rollback && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">回滚工作流</label>
                  <select
                    value={formData.rollback_workflow_id}
                    onChange={(e) => setFormData({ ...formData, rollback_workflow_id: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">选择工作流</option>
                    {workflows?.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={formData.rollback_on_failure}
                      onChange={(e) => setFormData({ ...formData, rollback_on_failure: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-300">修复失败时自动回滚</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
