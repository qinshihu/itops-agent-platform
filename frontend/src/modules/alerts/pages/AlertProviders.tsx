import { useState, useMemo as _useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Plus, Edit, Trash2, Copy, CheckCircle, Link, Globe, _Zap, Info, TestTube } from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../../lib/api';
import { getAxiosErrorMessage } from '@/lib/errorHandler';

interface AlertProvider {
  id: string;
  name: string;
  type: string;
  configSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      default?: unknown;
      enum?: string[];
    }>;
    required?: string[];
  };
}

interface AlertProviderConfig {
  id: string;
  provider_id: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ── 各 Provider 的使用说明 ──
const PROVIDER_GUIDES: Record<string, {
  title: string;
  steps: string[];
  webhookFormat?: string;
  note?: string;
}> = {
  prometheus: {
    title: 'Prometheus Alertmanager 接入指南',
    steps: [
      '1. 在 Alertmanager 配置文件中添加 webhook receiver：',
      '2. 将下方 Webhook 地址填入 url 字段',
      '3. 重启 Alertmanager 使配置生效',
      '4. 告警触发后会自动推送到此地址，系统自动创建告警记录',
    ],
    webhookFormat: 'alertmanager',
    note: '⚠️ 本系统会自动解析 Alertmanager 的 JSON 格式告警，提取 labels 和 annotations 中的关键字段。',
  },
  zabbix: {
    title: 'Zabbix Webhook 接入指南',
    steps: [
      '1. 在 Zabbix 管理后台 → 报警媒介类型 → 创建 Webhook 类型',
      '2. 将下方 Webhook 地址填入 URL 字段',
      '3. 参数中配置 {ALERT.SUBJECT}、{ALERT.MESSAGE} 等宏',
      '4. 在动作(Actions)中关联此报警媒介',
    ],
    note: '⚠️ Zabbix 告警推送使用 JSON 格式，系统会自动解析 subject 和 message 字段。',
  },
  grafana: {
    title: 'Grafana Alerting 接入指南',
    steps: [
      '1. 在 Grafana → Alerting → Contact points → 新建 Webhook',
      '2. 将下方 Webhook 地址填入 URL 字段',
      '3. 在 Notification policies 中关联此 contact point',
      '4. 告警触发后 Grafana 会自动 POST JSON 到此地址',
    ],
    note: '⚠️ 本系统自动解析 Grafana 告警格式，包括告警名称、状态、标签和值。',
  },
  webhook: {
    title: '通用 Webhook 接入指南',
    steps: [
      '1. 将下方 Webhook 地址配置到任意支持 Webhook 的系统',
      '2. POST JSON 格式数据到该地址',
      '3. 支持字段：title(标题)、severity(严重度)、content(内容)、source(来源)',
    ],
    webhookFormat: 'generic',
    note: '💡 通用格式，适用于自定义系统或第三方工具。最小 JSON 示例：{"title":"告警标题","severity":"warning","content":"告警详情"}',
  },
};

// ── 生成配置表单字段 ──
function getFormFields(provider: AlertProvider): Array<{
  key: string;
  label: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}> {
  if (!provider?.configSchema?.properties) return [];
  const required = provider.configSchema.required || [];
  return Object.entries(provider.configSchema.properties).map(([key, prop]) => ({
    key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    type: prop.type,
    description: prop.description || '',
    required: required.includes(key),
    default: prop.default,
    enum: prop.enum,
  }));
}

export default function AlertProviders() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AlertProviderConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AlertProvider | null>(null);
  const [configFormData, setConfigFormData] = useState<Record<string, unknown>>({});
  const [configName, setConfigName] = useState('');
  const [configEnabled, setConfigEnabled] = useState(true);
  const [copied, setCopied] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [_showGuide, _setShowGuide] = useState(false);

  const { data: providers, isLoading } = useQuery({
    queryKey: ['alert-providers', selectedType],
    queryFn: async () => {
      const params = selectedType ? { type: selectedType } : undefined;
      const res = await api.get('/alerts/providers/list', { params });
      return res.data.data as AlertProvider[];
    },
  });

  const { data: configs } = useQuery({
    queryKey: ['alert-provider-configs'],
    queryFn: async () => {
      const res = await api.get('/alerts/providers/configs');
      return res.data.data as AlertProviderConfig[];
    },
  });

  const createConfigMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/alerts/providers/configs', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-provider-configs'] });
      setShowConfigModal(false);
      resetForm();
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.put(`/alerts/providers/configs/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-provider-configs'] });
      setShowConfigModal(false);
      resetForm();
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/alerts/providers/configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-provider-configs'] });
    },
  });

  const types = Array.from(new Set((providers || []).map(p => p.type)));
  const filteredProviders = (providers || []).filter(p =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getWebhookUrl = (providerId: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.protocol}//${window.location.host}/api/webhooks/${providerId}`;
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(''), 2000);
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    setEditingConfig(null);
    setSelectedProvider(null);
    setConfigFormData({});
    setConfigName('');
    setConfigEnabled(true);
    setTestResult(null);
  };

  const openCreateConfig = (provider: AlertProvider) => {
    setSelectedProvider(provider);
    setEditingConfig(null);
    setConfigName(`${provider.name} 配置`);
    setConfigEnabled(true);
    setTestResult(null);
    // 初始化表单默认值
    const defaults: Record<string, unknown> = {};
    if (provider.configSchema?.properties) {
      Object.entries(provider.configSchema.properties).forEach(([key, prop]) => {
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        } else if (prop.type === 'number') {
          defaults[key] = 0;
        } else if (prop.type === 'boolean') {
          defaults[key] = false;
        } else {
          defaults[key] = '';
        }
      });
    }
    setConfigFormData(defaults);
    setShowConfigModal(true);
  };

  const handleEditConfig = (config: AlertProviderConfig) => {
    const provider = providers?.find(p => p.id === config.provider_id) || null;
    setSelectedProvider(provider);
    setEditingConfig(config);
    setConfigName(config.name);
    setConfigEnabled(config.enabled);
    setConfigFormData(config.config || {});
    setTestResult(null);
    setShowConfigModal(true);
  };

  const handleTestConnection = async () => {
    if (!selectedProvider) return;
    setTesting(true);
    setTestResult(null);
    try {
      // 对于 webhook 类型，测试 webhook 端点是否可达
      if (selectedProvider.type === 'webhook' || selectedProvider.type === 'prometheus' || selectedProvider.type === 'grafana') {
        const webhookUrl = getWebhookUrl(selectedProvider.id);
        const _res = await api.post('/alerts/providers/fetch', {
          provider: selectedProvider.id,
          config: configFormData,
        });
        setTestResult({ ok: true, message: `Provider "${selectedProvider.name}" 配置有效，Webhook 地址: ${webhookUrl}` });
      } else {
        const _res2 = await api.post('/alerts/providers/fetch', {
          provider: selectedProvider.id,
          config: configFormData,
        });
        setTestResult({ ok: true, message: '连接测试成功，Provider 配置有效' });
      }
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        message: getAxiosErrorMessage(err, '连接测试失败，请检查配置'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      provider_id: selectedProvider?.id || '',
      name: configName,
      config: configFormData,
      enabled: configEnabled,
    };
    if (editingConfig) {
      updateConfigMutation.mutate({ id: editingConfig.id, data });
    } else {
      createConfigMutation.mutate(data);
    }
  };

  const formFields = selectedProvider ? getFormFields(selectedProvider) : [];
  const guide = selectedProvider ? PROVIDER_GUIDES[selectedProvider.id] || PROVIDER_GUIDES[selectedProvider.type] : null;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">告警源配置</h1>
          <p className="text-slate-400">配置 Prometheus、Zabbix、Grafana 等外部告警源，自动接入告警处理流程</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['alert-providers', 'alert-provider-configs'] })}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-700 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索告警源..."
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-64"
        />
        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-400">类型:</span>
          <button onClick={() => setSelectedType(null)} className={clsx("px-3 py-1.5 rounded-full text-sm font-medium transition-all", !selectedType ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>全部</button>
          {types.map(type => (
            <button key={type} onClick={() => setSelectedType(selectedType === type ? null : type)} className={clsx("px-3 py-1.5 rounded-full text-sm font-medium transition-all", selectedType === type ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>
              <Globe className="w-3 h-3 inline mr-1" />{type}
            </button>
          ))}
        </div>
      </div>

      {/* Existing Configs */}
      {configs && configs.length > 0 && (
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">已配置的告警源 ({configs.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map((config) => {
              const relatedProvider = providers?.find(p => p.id === config.provider_id);
              const webhookUrl = getWebhookUrl(config.provider_id);
              return (
                <div key={config.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20">
                        <Globe className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-100">{config.name}</h3>
                        <span className="text-xs text-slate-400">{relatedProvider?.name || config.provider_id} · {relatedProvider?.type}</span>
                      </div>
                    </div>
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", config.enabled ? "bg-green-900/50 text-green-300" : "bg-slate-700 text-slate-400")}>
                      {config.enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>

                  {/* Webhook URL */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Link className="w-3 h-3 text-blue-400" />
                      <span className="text-xs text-slate-400">Webhook 接收地址:</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <code className="flex-1 bg-slate-900 px-2 py-1.5 rounded text-xs text-blue-300 overflow-x-auto whitespace-nowrap select-all">
                        {webhookUrl}
                      </code>
                      <button onClick={() => handleCopy(webhookUrl, config.id)} className="p-1.5 bg-slate-700 rounded hover:bg-slate-600 transition-all flex-shrink-0" title="复制">
                        {copied === config.id ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                      </button>
                    </div>
                  </div>

                  {/* Config Fields Summary */}
                  {config.config && Object.keys(config.config).length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {Object.entries(config.config).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">
                          {k}: {typeof v === 'string' ? (v.length > 20 ? v.substring(0, 20) + '...' : v) : String(v)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => handleEditConfig(config)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 text-sm transition-all">
                      <Edit className="w-3.5 h-3.5" />编辑
                    </button>
                    <button onClick={() => deleteConfigMutation.mutate(config.id)} disabled={deleteConfigMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 text-red-300 rounded-lg hover:bg-red-800 text-sm transition-all">
                      <Trash2 className="w-3.5 h-3.5" />删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Providers */}
      <div className="flex-1 overflow-auto p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">可用告警源类型</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => {
            const relatedConfigs = configs?.filter(c => c.provider_id === provider.id) || [];
            const guide = PROVIDER_GUIDES[provider.id] || PROVIDER_GUIDES[provider.type];
            const formFields = getFormFields(provider);
            const webhookUrl = getWebhookUrl(provider.id);

            return (
              <div key={provider.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20">
                      <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">{provider.name}</h3>
                      <span className="text-xs text-slate-400 uppercase">{provider.type}</span>
                    </div>
                  </div>
                  {relatedConfigs.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900/50 text-blue-300">{relatedConfigs.length} 个配置</span>
                  )}
                </div>

                {/* Configuration Fields Preview */}
                {formFields.length > 0 && (
                  <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">需要配置的字段:</p>
                    <div className="space-y-1.5">
                      {formFields.map(f => (
                        <div key={f.key} className="flex items-center gap-2 text-xs">
                          <span className={clsx("w-1.5 h-1.5 rounded-full", f.required ? "bg-red-400" : "bg-slate-500")}></span>
                          <code className="text-blue-300">{f.key}</code>
                          <span className="text-slate-500">— {f.description}</span>
                          {f.required && <span className="text-red-400 text-xs">必填</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Usage Guide Summary */}
                {guide && (
                  <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-medium text-blue-300">{guide.title}</span>
                    </div>
                    {guide.note && <p className="text-xs text-blue-400/70 mt-1">{guide.note}</p>}
                  </div>
                )}

                {/* Webhook URL */}
                <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-slate-400">Webhook 接收地址:</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-slate-950 px-2 py-1.5 rounded text-xs text-green-300 overflow-x-auto whitespace-nowrap select-all">{webhookUrl}</code>
                    <button onClick={() => handleCopy(webhookUrl, `url-${provider.id}`)} className="p-1.5 bg-slate-700 rounded hover:bg-slate-600 transition-all flex-shrink-0" title="复制">
                      {copied === `url-${provider.id}` ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                    </button>
                  </div>
                </div>

                <button onClick={() => openCreateConfig(provider)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full justify-center transition-all font-medium">
                  <Plus className="w-4 h-4" />新建配置
                </button>
              </div>
            );
          })}
        </div>

        {filteredProviders.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>没有找到匹配的告警源</p>
          </div>
        )}
      </div>

      {/* Config Modal - 字段化表单 */}
      {showConfigModal && selectedProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 rounded-t-xl z-10">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingConfig ? `编辑配置: ${configName}` : `新建 ${selectedProvider.name} 配置`}
              </h3>
              <button onClick={() => { setShowConfigModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-slate-700 transition-all text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Config Name */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-200">配置名称 <span className="text-red-400">*</span></label>
                <input type="text" required value={configName} onChange={(e) => setConfigName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="例如: 生产环境 Prometheus" />
              </div>

              {/* Provider ID (readonly when editing) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-200">告警源类型</label>
                <input type="text" disabled value={`${selectedProvider.name} (${selectedProvider.type})`}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed" />
              </div>

              {/* Dynamic Form Fields from configSchema */}
              {formFields.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-200 mb-2">配置参数</label>
                  <div className="space-y-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    {formFields.map(field => (
                      <div key={field.key} className="space-y-1">
                        <label className="block text-xs font-medium text-slate-300">
                          {field.label} {field.required && <span className="text-red-400">*</span>}
                        </label>
                        {field.description && (
                          <p className="text-xs text-slate-500 mb-1">{field.description}</p>
                        )}
                        {field.type === 'boolean' ? (
                          <select value={configFormData[field.key] ? 'true' : 'false'}
                            onChange={(e) => setConfigFormData({ ...configFormData, [field.key]: e.target.value === 'true' })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm">
                            <option value="true">是</option>
                            <option value="false">否</option>
                          </select>
                        ) : field.enum ? (
                          <select value={configFormData[field.key] || ''}
                            onChange={(e) => setConfigFormData({ ...configFormData, [field.key]: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm">
                            <option value="">请选择</option>
                            {field.enum.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        ) : field.type === 'number' ? (
                          <input type="number" value={configFormData[field.key] ?? ''}
                            onChange={(e) => setConfigFormData({ ...configFormData, [field.key]: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                            placeholder={`请输入${field.label}`} />
                        ) : field.key.includes('url') || field.key.includes('endpoint') ? (
                          <input type="url" value={configFormData[field.key] || ''}
                            onChange={(e) => setConfigFormData({ ...configFormData, [field.key]: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm font-mono"
                            placeholder={`https://...`} />
                        ) : field.key.includes('token') || field.key.includes('password') || field.key.includes('secret') ? (
                          <input type="password" value={configFormData[field.key] || ''}
                            onChange={(e) => setConfigFormData({ ...configFormData, [field.key]: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                            placeholder="请输入（自动加密存储）" />
                        ) : (
                          <input type="text" value={configFormData[field.key] || ''}
                            onChange={(e) => setConfigFormData({ ...configFormData, [field.key]: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                            placeholder={`请输入${field.label}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Webhook URL (always show for reference) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-200">Webhook 接收地址</label>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 bg-slate-950 px-3 py-2.5 rounded-lg text-xs text-green-300 overflow-x-auto whitespace-nowrap select-all border border-slate-700">
                    {getWebhookUrl(selectedProvider.id)}
                  </code>
                  <button type="button" onClick={() => handleCopy(getWebhookUrl(selectedProvider.id), 'modal-url')}
                    className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all flex-shrink-0" title="复制">
                    {copied === 'modal-url' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">将此地址配置到 {selectedProvider.name} 的 Webhook/Alertmanager 中</p>
              </div>

              {/* Usage Guide */}
              {guide && (
                <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-300">{guide.title}</span>
                  </div>
                  <div className="space-y-1">
                    {guide.steps.map((step, i) => (
                      <p key={i} className="text-xs text-blue-400/80">{step}</p>
                    ))}
                  </div>
                  {guide.note && (
                    <p className="text-xs text-blue-400/60 mt-2 border-t border-blue-800/30 pt-2">{guide.note}</p>
                  )}
                </div>
              )}

              {/* Test Connection */}
              <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <button type="button" onClick={handleTestConnection} disabled={testing}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm font-medium">
                  <TestTube className="w-4 h-4" />
                  {testing ? '测试中...' : '测试连接'}
                </button>
                {testResult && (
                  <span className={clsx("text-sm", testResult.ok ? "text-green-400" : "text-red-400")}>
                    {testResult.ok ? '✓' : '✗'} {testResult.message}
                  </span>
                )}
              </div>

              {/* Enabled */}
              <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <input type="checkbox" id="config-enabled" checked={configEnabled}
                  onChange={(e) => setConfigEnabled(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500" />
                <label htmlFor="config-enabled" className="text-sm text-slate-200">启用此告警源（启用后 Webhook 地址才会生效）</label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => { setShowConfigModal(false); resetForm(); }}
                  className="px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 hover:bg-slate-600 transition-all font-medium">取消</button>
                <button type="submit" disabled={createConfigMutation.isPending || updateConfigMutation.isPending}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all font-medium shadow-sm">
                  {createConfigMutation.isPending || updateConfigMutation.isPending ? '保存中...' : (editingConfig ? '更新配置' : '创建配置')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
