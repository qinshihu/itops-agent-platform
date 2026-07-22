/**
 * Kubernetes 资源管理 - 聚合入口
 *
 * 原文件 308 行（v4 报告误标 1458 行，已修正为 308 行——报告与代码实际状态有偏差）。
 * 2026-07-08 增量-13：进一步把 TabButton / 标题栏 / 集群选择 / 命名空间选择 / 搜索框
 * 抽离为 kubernetes/ 子目录中的独立组件，Kubernetes.tsx 现在只负责：
 *   1. 调用 useKubernetes 业务 hook
 *   2. 处理 3 种空状态（不可用 / 加载中 / 主渲染）
 *   3. 把数据传给子组件
 *
 * 已拆分的子组件（kubernetes/ 子目录）：
 *   - HeaderBar（标题 + 刷新按钮）
 *   - ClusterSelector（集群选择 + 导入/刷新/删除）
 *   - NamespaceSelector（命名空间选择）
 *   - SearchBox（搜索）
 *   - TabButton（Tab 按钮）
 *   - K8sUnavailable（无可用集群时的提示）
 *   - ImportClusterModal（导入 kubeconfig）
 *   - OverviewCards（资源概览卡片）
 *   - DeploymentTable（Deployments 列表）
 *   - ScaleModal（扩缩容）
 *   - DeleteConfirmModal（删除确认）
 *   - useKubernetes（业务逻辑 hook）
 *   - types（类型 + 颜色 + 工具函数）
 *
 * Tab 内容组件（k8s/ 子目录）：
 *   - PodList / ServiceList / NodeList
 */

import { useKubernetes } from './kubernetes/useKubernetes';
import K8sUnavailable from './kubernetes/K8sUnavailable';
import ImportClusterModal from './kubernetes/ImportClusterModal';
import OverviewCards from './kubernetes/OverviewCards';
import DeploymentTable from './kubernetes/DeploymentTable';
import ScaleModal from './kubernetes/ScaleModal';
import DeleteConfirmModal from './kubernetes/DeleteConfirmModal';
import HeaderBar from './kubernetes/HeaderBar';
import ClusterSelector from './kubernetes/ClusterSelector';
import NamespaceSelector from './kubernetes/NamespaceSelector';
import SearchBox from './kubernetes/SearchBox';
import { TabButton, type K8sTab } from './kubernetes/TabButton';
import PodList from './k8s/PodList';
import ServiceList from './k8s/ServiceList';
import NodeList from './k8s/NodeList';

// Re-export types for backward compatibility
export type { K8sContext, Namespace, Pod, PodDetail, Service, NodeInfo } from './kubernetes/types';
export { podStatusColors, serviceTypeColors, nodeStatusColors, formatAge } from './kubernetes/types';

export default function Kubernetes() {
  const k = useKubernetes();

  // ==================== 状态 1：K8s 不可用 ====================
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

  // ==================== 状态 2：集群加载中 ====================
  if (k.contextsLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  // ==================== 状态 3：主渲染 ====================
  return (
    <div className="p-6 space-y-5">
      <HeaderBar onRefresh={k.refreshCurrentTab} />

      <ClusterSelector
        contexts={k.contexts}
        effectiveContext={k.effectiveContext}
        onContextChange={k.handleContextChange}
        onImportCluster={() => k.setImportModalOpen(true)}
        onRefreshContexts={() => {/* refresh contexts */}}
        onDeleteContext={(ctx) => k.setDeleteContextTarget(ctx)}
      />

      <div className="space-y-4">
        <NamespaceSelector
          effectiveNamespace={k.effectiveNamespace}
          namespacesLoading={k.namespacesLoading}
          namespaces={k.namespaces}
          onNamespaceChange={(ns) => k.setNamespace(ns)}
        />

        <OverviewCards
          nodes={k.overview?.nodes ?? 0}
          pods={k.overview?.pods ?? 0}
          services={k.overview?.services ?? 0}
          deployments={k.overview?.deployments ?? 0}
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 pt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1">
            <TabButton tab="pods" label="Pods" active={k.activeTab} onClick={k.setActiveTab} />
            <TabButton tab="deployments" label="Deployments" active={k.activeTab} onClick={k.setActiveTab} />
            <TabButton tab="services" label="Services" active={k.activeTab} onClick={k.setActiveTab} />
            <TabButton tab="nodes" label="节点" active={k.activeTab} onClick={k.setActiveTab} />
          </div>
          <SearchBox value={k.searchText} onChange={k.setSearchText} />
        </div>

        {k.activeTab === ('pods' as K8sTab) && (
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

        {k.activeTab === ('deployments' as K8sTab) && (
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
              onDetail={() => {/* toast handled internally */}}
            />
          </div>
        )}

        {k.activeTab === ('services' as K8sTab) && (
          <ServiceList
            services={k.services}
            loading={k.servicesLoading}
            error={k.servicesError}
            onRetry={() => k.refetchServices()}
            searchText={k.searchText}
          />
        )}

        {k.activeTab === ('nodes' as K8sTab) && (
          <NodeList
            nodes={k.nodes}
            loading={k.nodesLoading}
            error={k.nodesError}
            onRetry={() => k.refetchNodes()}
            searchText={k.searchText}
          />
        )}
      </div>

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
