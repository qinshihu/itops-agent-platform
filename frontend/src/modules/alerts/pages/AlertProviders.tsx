/**
 * AlertProviders 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 AlertProviders.tsx 637 行包含 11 useState + 2 query + 3 mutation + 8 handlers + 4 panel UI
 *
 * 拆分后行为：6 个子文件按职责分离 + 主组件仅编排 (~100 行)
 *   - types.ts                  — interface（40 行）
 *   - providerGuides.ts         — PROVIDER_GUIDES + getFormFields（85 行）
 *   - useAlertProvidersData.ts  — 全部 hooks + handlers（180 行）
 *   - ConfiguredAlertSourceList.tsx — 已配置 list（120 行）
 *   - AvailableProviderGrid.tsx — 可用 provider grid（120 行）
 *   - EditConfigModal.tsx       — 编辑 modal（180 行）
 *   - index.ts                  — barrel（20 行）
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { clsx } from 'clsx';
import { RefreshCw, Globe } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAlertProvidersData } from './alert-providers/useAlertProvidersData';
import { ConfiguredAlertSourceList } from './alert-providers/ConfiguredAlertSourceList';
import { AvailableProviderGrid } from './alert-providers/AvailableProviderGrid';
import { EditConfigModal } from './alert-providers/EditConfigModal';
import { PROVIDER_GUIDES } from './alert-providers/providerGuides';
import type { AlertProvider } from './alert-providers/types';

export default function AlertProviders() {
  const queryClient = useQueryClient();
  const data = useAlertProvidersData();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['alert-providers'] });
    queryClient.invalidateQueries({ queryKey: ['alert-provider-configs'] });
  };

  const getProviderGuide = (provider: AlertProvider) =>
    PROVIDER_GUIDES[provider.id] || PROVIDER_GUIDES[provider.type] || null;

  if (data.isLoading) {
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
          <p className="text-slate-400">
            配置 Prometheus、Zabbix、Grafana 等外部告警源，自动接入告警处理流程
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
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
          value={data.searchQuery}
          onChange={(e) => data.setSearchQuery(e.target.value)}
          placeholder="搜索告警源..."
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-64"
        />
        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-400">类型:</span>
          <button
            onClick={() => data.setSelectedType(null)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              !data.selectedType
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
            )}
          >
            全部
          </button>
          {data.types.map((type) => (
            <button
              key={type}
              onClick={() => data.setSelectedType(data.selectedType === type ? null : type)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                data.selectedType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
              )}
            >
              <Globe className="w-3 h-3 inline mr-1" />
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 已配置 list */}
      <ConfiguredAlertSourceList
        configs={data.configs}
        providers={data.providers}
        copied={data.copied}
        getWebhookUrl={data.getWebhookUrl}
        onCopy={data.handleCopy}
        onEdit={data.handleEditConfig}
        onDelete={data.handleDeleteConfig}
        deletePending={data.deleteConfigMutation.isPending}
      />

      {/* 可用告警源 grid */}
      <div className="flex-1 overflow-auto p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">可用告警源类型</h3>
        <AvailableProviderGrid
          providers={data.filteredProviders}
          relatedConfigsMap={data.configsByProvider}
          copied={data.copied}
          getWebhookUrl={data.getWebhookUrl}
          onCopy={data.handleCopy}
          onCreateConfig={data.openCreateConfig}
          getFormFields={data.getFormFields}
          getProviderGuide={getProviderGuide}
        />
      </div>

      {/* Edit Modal */}
      {data.showConfigModal && data.selectedProvider && (
        <EditConfigModal
          provider={data.selectedProvider}
          editingConfig={data.editingConfig}
          configName={data.configName}
          setConfigName={data.setConfigName}
          configFormData={data.configFormData}
          setConfigFormData={data.setConfigFormData}
          configEnabled={data.configEnabled}
          setConfigEnabled={data.setConfigEnabled}
          copied={data.copied}
          copy={data.handleCopy}
          testResult={data.testResult}
          testing={data.testing}
          onTestConnection={data.handleTestConnection}
          onSubmit={data.handleSubmit}
          onClose={data.closeModal}
          createPending={data.createPending}
          updatePending={data.updatePending}
          getWebhookUrl={data.getWebhookUrl}
          formFields={data.formFields}
          guide={getProviderGuide(data.selectedProvider)}
        />
      )}
    </div>
  );
}
