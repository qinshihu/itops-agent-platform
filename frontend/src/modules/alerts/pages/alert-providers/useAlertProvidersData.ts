/**
 * AlertProviders 数据 hook（2026-07-21 拆分）
 *
 * 把原 AlertProviders.tsx L107-284 的 state + query + mutation + handlers 抽出
 * 包含：
 * - 11 useState（selectedType / searchQuery / showConfigModal / editingConfig / selectedProvider 等）
 * - 2 useQuery（providers list / configs list）
 * - 3 useMutation（createConfig / updateConfig / deleteConfig）
 * - 8+ handlers（resetForm / openCreateConfig / handleEditConfig / handleTestConnection / handleSubmit 等）
 * - 派生 helpers（getFormFields / getWebhookUrl / handleCopy / types / filteredProviders）
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import type { AlertProvider, AlertProviderConfig, TestResult } from './types';
import { getFormFields } from './providerGuides';

export function useAlertProvidersData() {
  const queryClient = useQueryClient();

  // ===== State =====
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
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [_showGuide, _setShowGuide] = useState(false);

  // ===== Queries =====
  const { data: providers, isLoading } = useQuery({
    queryKey: ['alert-providers', selectedType],
    queryFn: async () => {
      const params = selectedType ? { type: selectedType } : undefined;
      const { data } = await api.get('/alerts/providers/list', { params });
      return data as AlertProvider[];
    },
  });

  const { data: configs } = useQuery({
    queryKey: ['alert-provider-configs'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/providers/configs');
      return data as AlertProviderConfig[];
    },
  });

  // ===== Mutations =====
  const createConfigMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { data: result } = await api.post('/alerts/providers/configs', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-provider-configs'] });
      setShowConfigModal(false);
      resetForm();
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { data: result } = await api.put(`/alerts/providers/configs/${id}`, data);
      return result;
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

  // ===== Derived =====
  const types = useMemo(
    () => Array.from(new Set((providers || []).map((p) => p.type))),
    [providers],
  );

  const filteredProviders = useMemo(
    () =>
      (providers || []).filter(
        (p) =>
          !searchQuery ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.type.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [providers, searchQuery],
  );

  const configsByProvider = useMemo(() => {
    const map: Record<string, AlertProviderConfig[]> = {};
    (configs || []).forEach((c) => {
      if (!map[c.provider_id]) map[c.provider_id] = [];
      map[c.provider_id].push(c);
    });
    return map;
  }, [configs]);

  // ===== Helpers =====
  const getWebhookUrl = (providerId: string): string => {
    if (typeof window === 'undefined') return '';
    return `${window.location.protocol}//${window.location.host}/api/webhooks/${providerId}`;
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      /* ignore */
    }
  };

  // ===== Form handlers =====
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
    const provider = providers?.find((p) => p.id === config.provider_id) || null;
    setSelectedProvider(provider);
    setEditingConfig(config);
    setConfigName(config.name);
    setConfigEnabled(config.enabled);
    setConfigFormData(config.config || {});
    setTestResult(null);
    setShowConfigModal(true);
  };

  const closeModal = () => {
    setShowConfigModal(false);
    resetForm();
  };

  const handleDeleteConfig = (id: string) => {
    if (!window.confirm('确定要删除此配置吗？')) return;
    deleteConfigMutation.mutate(id);
  };

  const handleTestConnection = async () => {
    if (!selectedProvider) return;
    setTesting(true);
    setTestResult(null);
    try {
      // 对于 webhook / prometheus / grafana 类型，校验 webhook 端点可达
      if (
        selectedProvider.type === 'webhook' ||
        selectedProvider.type === 'prometheus' ||
        selectedProvider.type === 'grafana'
      ) {
        const webhookUrl = getWebhookUrl(selectedProvider.id);
        await api.post('/alerts/providers/fetch', {
          provider: selectedProvider.id,
          config: configFormData,
        });
        setTestResult({
          ok: true,
          message: `Provider "${selectedProvider.name}" 配置有效，Webhook 地址: ${webhookUrl}`,
        });
      } else {
        await api.post('/alerts/providers/fetch', {
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

  // ===== Computed form fields (current modal provider) =====
  const formFields = selectedProvider ? getFormFields(selectedProvider) : [];

  return {
    // state
    selectedType,
    setSelectedType,
    searchQuery,
    setSearchQuery,
    showConfigModal,
    editingConfig,
    selectedProvider,
    configFormData,
    setConfigFormData,
    configName,
    setConfigName,
    configEnabled,
    setConfigEnabled,
    copied,
    testing,
    testResult,
    setTestResult,
    // queries
    providers,
    configs,
    isLoading,
    // mutations
    createPending: createConfigMutation.isPending,
    updatePending: updateConfigMutation.isPending,
    // derived
    types,
    filteredProviders,
    configsByProvider,
    // helpers
    getWebhookUrl,
    handleCopy,
    getFormFields,
    // handlers
    openCreateConfig,
    handleEditConfig,
    closeModal,
    handleDeleteConfig,
    handleTestConnection,
    handleSubmit,
    // form derived
    formFields,
    // raw mutations (for advanced use)
    deleteConfigMutation,
  };
}

export type AlertProvidersData = ReturnType<typeof useAlertProvidersData>;
