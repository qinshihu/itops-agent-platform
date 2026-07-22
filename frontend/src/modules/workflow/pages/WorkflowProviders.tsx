/**
 * WorkflowProviders 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 WorkflowProviders.tsx 858 行包含所有 hooks + meta + UI
 * 拆分后行为：6 个子文件按职责分离 + 主组件仅编排 (~50 行)
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { useProvidersData } from './workflow-providers/useProvidersData';
import ProviderListPanel from './workflow-providers/ProviderListPanel';
import ProviderDetailPanel from './workflow-providers/ProviderDetailPanel';

export default function WorkflowProviders() {
  const data = useProvidersData();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-surface/50 backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            工作流动作库
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            共 {data.providers?.length ?? 0} 个动作 · 可在工作流中调用，支持参数配置与执行测试
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧 list panel */}
        <ProviderListPanel
          providers={data.providers}
          filteredProviders={data.filteredProviders}
          selectedId={data.selectedId}
          isLoading={data.isLoading}
          searchQuery={data.searchQuery}
          setSearchQuery={data.setSearchQuery}
          activeType={data.activeType}
          setActiveType={data.setActiveType}
          typeCounts={data.typeCounts}
          onSelectProvider={(id) => {
            data.setSelectedId(id);
            data.setTestConfig({});
          }}
          totalProvidersCount={data.providers?.length ?? 0}
        />

        {/* 右侧 detail panel */}
        <ProviderDetailPanel
          selectedProvider={data.selectedProvider}
          copiedId={data.copiedId}
          testResults={data.testResults}
          testConfig={data.testConfig}
          setTestConfig={data.setTestConfig}
          testMutationPending={data.testMutationPending}
          testMutationVariables={null}
          onCopy={data.handleCopy}
          onTest={data.handleTest}
          onClearResult={data.handleClearResult}
        />
      </div>
    </div>
  );
}
