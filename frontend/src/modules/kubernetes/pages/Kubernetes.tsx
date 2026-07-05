import { 
  Container, RefreshCw, Search, ChevronDown, Upload, Trash2, X 
} from 'lucide-react';
import clsx from 'clsx';
import { useKubernetes } from './kubernetes/useKubernetes';
import K8sUnavailable from './kubernetes/K8sUnavailable';
import ImportClusterModal from './kubernetes/ImportClusterModal';
import OverviewCards from './kubernetes/OverviewCards';
import DeploymentTable from './kubernetes/DeploymentTable';
import ScaleModal from './kubernetes/ScaleModal';
import DeleteConfirmModal from './kubernetes/DeleteConfirmModal';
import PodList from './k8s/PodList';
import ServiceList from './k8s/ServiceList';
import NodeList from './k8s/NodeList';

// Re-export types for backward compatibility
export type { K8sContext, Namespace, Pod, PodDetail, Service, NodeInfo } from './kubernetes/types';
export { podStatusColors, serviceTypeColors, nodeStatusColors, formatAge } from './kubernetes/types';

export default function Kubernetes() {
  const k = useKubernetes();

  // ==================== K8s 不可用状态 ====================
  if (!k.contextsLoading && !k.hasContexts) {
    return (
      <div>
        <K8sUnavailable onImport={() => k.setImportModalOpen(true)} />
        {k.importModalOpen && (
          <ImportClusterModal
            kubeconfigContent={k.kubeconfigContent}
            setKubeconfigContent={k.handleKubeconfigChange}
            testResult={k.testResult}
            testingConfig={k.testingConfig}
            isImporting={k.importMutation.isPending}
            onTest={k.testConfig}
            onImport={() => k.importMutation.mutate(k.kubeconfigContent)}
            onClose={k.handleCloseImport}
          />
        )}
      </div>
    );
  }

  // ==================== 集群加载中 ====================
  if (k.contextsLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  // ==================== 主渲染 ====================
  return (
    <div className="p-6 space-y-5">
      {/* 页面标题行 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Container size={26} className="text-primary" />
          <h1 className="text-xl font-bold text-text-primary">K8s 资源管理</h1>
        </div>
        <button
          onClick={k.refreshCurrentTab}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-surface hover:bg-border/50 rounded-lg transition-colors border border-border"
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {/* 集群上下文管理 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-text-secondary text-sm shrink-0">集群：</span>

          <div className="relative">
            <select
              value={k.effectiveContext}
              onChange={(e) => k.handleContextChange(e.target.value)}
              className="appearance-none bg-surface border border-border text-text-primary text-sm rounded-lg px-3 py-2 pr-8 min-w-[200px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              {k.contexts.map(ctx => (
                <option key={ctx.id} value={ctx.id}>{ctx.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>

          <button
            onClick={() => k.setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            <Upload size={14} /> 导入集群
          </button>

          <button
            onClick={() => { /* refresh contexts */ }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-surface hover:bg-border/50 rounded-lg transition-colors border border-border"
          >
            <RefreshCw size={14} /> 刷新集群
          </button>

          {k.contexts.length > 0 && (
            <button
              onClick={() => {
                const ctx = k.contexts.find(c => c.id === k.effectiveContext);
                if (ctx) k.setDeleteContextTarget(ctx);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors ml-auto"
            >
              <Trash2 size={14} /> 删除当前集群
            </button>
          )}
        </div>
      </div>

      {/* 命名空间选择器 + 概览卡片 */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-text-secondary text-sm shrink-0">命名空间：</span>
          <div className="relative">
            <select
              value={k.effectiveNamespace}
              onChange={(e) => k.setNamespace(e.target.value)}
              className="appearance-none bg-surface border border-border text-text-primary text-sm rounded-lg px-3 py-2 pr-8 min-w-[220px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              {k.namespacesLoading ? (
                <option>加载中...</option>
              ) : k.namespaces.length === 0 ? (
                <option value="">无命名空间</option>
              ) : (
                <>
                  <option value="">全部命名空间</option>
                  {k.namespaces.map(ns => (
                    <option key={ns.name} value={ns.name}>{ns.name}</option>
                  ))}
                </>
              )}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>
        </div>

        <OverviewCards
          nodes={k.overview?.nodes ?? 0}
          pods={k.overview?.pods ?? 0}
          services={k.overview?.services ?? 0}
          deployments={k.overview?.deployments ?? 0}
        />
      </div>

      {/* Tab 标签栏 + 搜索 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 pt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1">
            <TabButton tab="pods" label="Pods" active={k.activeTab} onClick={k.setActiveTab} />
            <TabButton tab="deployments" label="Deployments" active={k.activeTab} onClick={k.setActiveTab} />
            <TabButton tab="services" label="Services" active={k.activeTab} onClick={k.setActiveTab} />
            <TabButton tab="nodes" label="节点" active={k.activeTab} onClick={k.setActiveTab} />
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索..."
              value={k.searchText}
              onChange={(e) => k.setSearchText(e.target.value)}
              className="bg-surface border border-border text-text-primary text-sm rounded-lg pl-9 pr-3 py-2 w-56 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
            {k.searchText && (
              <button
                onClick={() => k.setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Pods Tab */}
        {k.activeTab === 'pods' && (
          <PodList
            pods={k.pods}
            loading={k.podsLoading}
            error={k.podsError}
            onRetry={() => k.refetchPods()}
            context={k.effectiveContext}
            searchText={k.searchText}
            onDeletePod={k.setDeletePodTarget}
          />
        )}

        {/* Deployments Tab */}
        {k.activeTab === 'deployments' && (
          <div className="p-4">
            <DeploymentTable
              deployments={k.deployments}
              filteredDeployments={k.filteredDeployments}
              isLoading={k.deploymentsLoading}
              isError={k.deploymentsError}
              searchText={k.searchText}
              onRetry={() => k.refetchDeployments()}
              onScale={k.handleScaleOpen}
              onRestart={(dep) => k.restartMutation.mutate(dep)}
              onDetail={() => { /* toast handled internally */ }}
            />
          </div>
        )}

        {/* Services Tab */}
        {k.activeTab === 'services' && (
          <ServiceList
            services={k.services}
            loading={k.servicesLoading}
            error={k.servicesError}
            onRetry={() => k.refetchServices()}
            searchText={k.searchText}
          />
        )}

        {/* Nodes Tab */}
        {k.activeTab === 'nodes' && (
          <NodeList
            nodes={k.nodes}
            loading={k.nodesLoading}
            error={k.nodesError}
            onRetry={() => k.refetchNodes()}
            searchText={k.searchText}
          />
        )}
      </div>

      {/* ==================== 导入集群 Modal ==================== */}
      {k.importModalOpen && (
        <ImportClusterModal
          kubeconfigContent={k.kubeconfigContent}
          setKubeconfigContent={k.handleKubeconfigChange}
          testResult={k.testResult}
          testingConfig={k.testingConfig}
          isImporting={k.importMutation.isPending}
          onTest={k.testConfig}
          onImport={() => k.importMutation.mutate(k.kubeconfigContent)}
          onClose={k.handleCloseImport}
        />
      )}

      {/* ==================== 扩缩容 Modal ==================== */}
      {k.scaleOpen && k.scaleTarget && (
        <ScaleModal
          scaleTarget={k.scaleTarget}
          scaleReplicas={k.scaleReplicas}
          setScaleReplicas={k.setScaleReplicas}
          isPending={k.scaleMutation.isPending}
          onConfirm={() => k.scaleMutation.mutate({ dep: k.scaleTarget!, replicas: k.scaleReplicas })}
          onClose={() => k.setScaleOpen(false)}
        />
      )}

      {/* ==================== 删除 Pod 确认 ==================== */}
      {k.deletePodTarget && (
        <DeleteConfirmModal
          title="确认删除 Pod"
          subtitle="此操作不可恢复"
          targetName={k.deletePodTarget.name}
          isPending={k.deletePodMutation.isPending}
          onConfirm={() => k.deletePodMutation.mutate(k.deletePodTarget!)}
          onClose={() => k.setDeletePodTarget(null)}
        />
      )}

      {/* ==================== 删除集群确认 ==================== */}
      {k.deleteContextTarget && (
        <DeleteConfirmModal
          title="确认删除集群"
          subtitle="此操作不可恢复"
          targetName={k.deleteContextTarget.name}
          isPending={k.deleteContextMutation.isPending}
          onConfirm={() => k.deleteContextMutation.mutate(k.deleteContextTarget!.id)}
          onClose={() => k.setDeleteContextTarget(null)}
        />
      )}
    </div>
  );
}

// ==================== 内联辅助组件 ====================
function TabButton({ tab, label, active, onClick }: { 
  tab: 'pods' | 'deployments' | 'services' | 'nodes'; 
  label: string; 
  active: string; 
  onClick: (t: typeof tab) => void;
}) {
  return (
    <button
      onClick={() => onClick(tab)}
      className={clsx(
        'px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
        active === tab
          ? 'bg-primary text-white shadow-lg shadow-primary/20'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface',
      )}
    >
      {label}
    </button>
  );
}