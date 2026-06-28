/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Filter, Bell, Zap, Workflow, Database, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import api from '../../../lib/api';
import { sanitizeText } from '../../../lib/xss';
import { useTheme } from '../../../contexts/ThemeContext';

interface AlertMapping {
  id: string;
  alert_source: string | null;
  alert_severity: string | null;
  alert_title_pattern: string | null;
  workflow_id: string;
  enabled: number;
  created_at: string;
  workflow_name: string;
}

interface Workflow {
  id: string;
  name: string;
}

// 预设模板
const presetTemplates = [
  {
    name: 'Prometheus CPU告警自动处理',
    description: '处理Prometheus的CPU使用率告警',
    alert_source: 'prometheus',
    alert_severity: 'critical',
    alert_title_pattern: 'CPU'
  },
  {
    name: 'Zabbix内存告警自动处理',
    description: '处理Zabbix的内存告警',
    alert_source: 'zabbix',
    alert_severity: 'high',
    alert_title_pattern: 'Memory'
  },
  {
    name: '任意来源告警处理',
    description: '处理所有来源的所有告警',
    alert_source: '',
    alert_severity: '',
    alert_title_pattern: ''
  }
];

// 获取级别图标
const getSeverityIcon = (severity: string | null) => {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    case 'high':
      return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    case 'medium':
      return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    case 'low':
      return <AlertTriangle className="w-4 h-4 text-blue-600" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

export default function AlertMappings() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [showModal, setShowModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<AlertMapping | null>(null);
  const [formData, setFormData] = useState({
    alert_source: '',
    alert_severity: '',
    alert_title_pattern: '',
    workflow_id: '',
    enabled: true,
  });
  const queryClient = useQueryClient();

  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ['alertMappings'],
    queryFn: async () => {
      const res = await api.get('/api/alert-mappings');
      return res.data.data as AlertMapping[];
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
      const res = await api.post('/api/alert-mappings', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertMappings'] });
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/api/alert-mappings/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertMappings'] });
      setShowModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/alert-mappings/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertMappings'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMapping) {
      updateMutation.mutate({ id: editingMapping.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (mapping: AlertMapping) => {
    setEditingMapping(mapping);
    setFormData({
      alert_source: mapping.alert_source || '',
      alert_severity: mapping.alert_severity || '',
      alert_title_pattern: mapping.alert_title_pattern || '',
      workflow_id: mapping.workflow_id,
      enabled: !!mapping.enabled,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingMapping(null);
    setFormData({
      alert_source: '',
      alert_severity: '',
      alert_title_pattern: '',
      workflow_id: '',
      enabled: true,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-500" />
              告警自动处理
            </h1>
            <p className="text-text-secondary mt-1">配置告警自动触发工作流，实现自动化运维</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            新建映射
          </button>
        </div>

        {/* 预设模板 */}
        <div className={`${
          isDark 
            ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20' 
            : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'
        } rounded-xl border p-4`}>
          <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
            isDark ? 'text-blue-300' : 'text-blue-800'
          }`}>
            <Database className="w-4 h-4" />
            快速模板
          </h3>
          <div className="flex flex-wrap gap-2">
            {presetTemplates.map((template, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setFormData({
                    alert_source: template.alert_source,
                    alert_severity: template.alert_severity,
                    alert_title_pattern: template.alert_title_pattern,
                    workflow_id: '',
                    enabled: true,
                  });
                  setShowModal(true);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-surface hover:border-primary/50 hover:shadow-sm transition-all text-sm flex items-center gap-2"
              >
                <Bell className="w-4 h-4 text-blue-500" />
                {template.name}
              </button>
            ))}
          </div>
        </div>

        {/* 映射列表 - 卡片式布局 */}
        {mappingsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-surface rounded-xl border border-border p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : mappingsData?.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-xl border border-border">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">暂无告警映射</h3>
            <p className="text-text-secondary mb-4">开始配置您的第一个告警自动处理规则</p>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              创建第一个映射
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mappingsData?.map((mapping) => (
              <div key={mapping.id} className="bg-surface rounded-xl border border-border hover:shadow-md transition-all p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`p-2 rounded-lg ${
                      isDark 
                        ? (mapping.enabled ? 'bg-green-500/20' : 'bg-gray-500/20') 
                        : (mapping.enabled ? 'bg-green-100' : 'bg-gray-100')
                    }`}>
                      {mapping.enabled ? 
                        <CheckCircle className={`w-5 h-5 ${
                          isDark ? 'text-green-400' : 'text-green-600'
                        }`} /> : 
                        <XCircle className={`w-5 h-5 ${
                          isDark ? 'text-gray-400' : 'text-gray-400'
                        }`} />
                      }
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isDark 
                        ? (mapping.enabled ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300') 
                        : (mapping.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')
                    }`}>
                      {mapping.enabled ? '启用' : '禁用'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(mapping)}
                      className="p-1.5 hover:bg-background rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(mapping.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm text-text-primary">
                      来源: <span className="font-medium">{sanitizeText(mapping.alert_source) || '任意'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(mapping.alert_severity)}
                    <span className="text-sm text-text-primary">
                      级别: <span className="font-medium">{sanitizeText(mapping.alert_severity) || '任意'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm text-text-primary">
                      匹配: <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">{sanitizeText(mapping.alert_title_pattern) || '任意'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border mt-2">
                    <Workflow className="w-4 h-4 text-primary" />
                    <span className="text-sm text-text-primary font-medium">
                      {sanitizeText(mapping.workflow_name)}
                    </span>
                  </div>
                </div>
                
                <div className="text-xs text-text-secondary mt-3 pt-2 border-t border-border">
                  创建于 {formatDate(mapping.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full shadow-2xl">
            <div className={`p-4 border-b border-border flex items-center justify-between rounded-t-xl ${
              isDark 
                ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10' 
                : 'bg-gradient-to-r from-blue-50 to-purple-50'
            }`}>
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                {editingMapping ? '编辑告警映射' : '新建告警映射'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1.5 rounded-lg hover:bg-background transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* 告警来源 */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" />
                  告警来源
                </label>
                <input
                  type="text"
                  value={formData.alert_source}
                  onChange={(e) => setFormData({ ...formData, alert_source: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="例如: prometheus, zabbix (留空表示任意来源)"
                />
              </div>

              {/* 告警级别 */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  告警级别
                </label>
                <select
                  value={formData.alert_severity}
                  onChange={(e) => setFormData({ ...formData, alert_severity: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value="">✨ 任意级别</option>
                  <option value="disaster">💥 Disaster (Zabbix 灾难)</option>
                  <option value="critical">🔴 Critical (严重)</option>
                  <option value="high">🟠 High (高)</option>
                  <option value="medium">🟡 Medium (中)</option>
                  <option value="warning">🟨 Warning (Zabbix 警告)</option>
                  <option value="low">🔵 Low (低)</option>
                  <option value="info">ℹ️ Info (信息)</option>
                </select>
              </div>

              {/* 标题匹配 */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary flex items-center gap-2">
                  <Filter className="w-4 h-4 text-purple-500" />
                  标题匹配模式
                </label>
                <input
                  type="text"
                  value={formData.alert_title_pattern}
                  onChange={(e) => setFormData({ ...formData, alert_title_pattern: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm"
                  placeholder="包含文字即匹配 (留空表示任意标题)"
                />
              </div>

              {/* 触发工作流 */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-green-500" />
                  触发工作流
                </label>
                <select
                  required
                  value={formData.workflow_id}
                  onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value="">选择要触发的工作流...</option>
                  {workflowsData?.map((wf) => (
                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                  ))}
                </select>
              </div>

              {/* 启用开关 */}
              <div className="flex items-center gap-3 bg-background p-3 rounded-lg border border-border">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-5 h-5 text-primary focus:ring-primary rounded"
                />
                <label htmlFor="enabled" className="text-sm text-text-primary font-medium">立即启用此映射</label>
              </div>

              {/* 提示信息 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">配置说明</p>
                    <p>留空的条件表示匹配任意值。Zabbix 可直接使用 disaster、warning、info 等原始级别，也可使用 critical、medium、low 等归一化级别。</p>
                  </div>
                </div>
              </div>

              {/* 按钮 */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary hover:bg-surface transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending ? '保存中...' : (editingMapping ? '更新' : '创建')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
