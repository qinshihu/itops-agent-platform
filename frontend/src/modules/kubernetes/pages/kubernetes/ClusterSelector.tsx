/**
 * Kubernetes 集群选择器
 *
 * 从原 Kubernetes.tsx 抽离（2026-07-08 增量-13）。
 * 含：集群下拉框 + 导入集群按钮 + 刷新集群按钮 + 删除当前集群按钮。
 */

import { ChevronDown, Upload, RefreshCw, Trash2 } from 'lucide-react';
import type { K8sContext } from './types';

interface ClusterSelectorProps {
  contexts: K8sContext[];
  effectiveContext: string;
  onContextChange: (id: string) => void;
  onImportCluster: () => void;
  onRefreshContexts: () => void;
  onDeleteContext: (ctx: K8sContext) => void;
}

export function ClusterSelector({
  contexts,
  effectiveContext,
  onContextChange,
  onImportCluster,
  onRefreshContexts,
  onDeleteContext,
}: ClusterSelectorProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-text-secondary text-sm shrink-0">集群：</span>

        <div className="relative">
          <select
            value={effectiveContext}
            onChange={(e) => onContextChange(e.target.value)}
            className="appearance-none bg-surface border border-border text-text-primary text-sm rounded-lg px-3 py-2 pr-8 min-w-[200px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          >
            {contexts.map((ctx) => (
              <option key={ctx.id} value={ctx.id}>{ctx.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        </div>

        <button
          onClick={onImportCluster}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          <Upload size={14} /> 导入集群
        </button>

        <button
          onClick={onRefreshContexts}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-surface hover:bg-border/50 rounded-lg transition-colors border border-border"
        >
          <RefreshCw size={14} /> 刷新集群
        </button>

        {contexts.length > 0 && (
          <button
            onClick={() => {
              const ctx = contexts.find((c) => c.id === effectiveContext);
              if (ctx) onDeleteContext(ctx);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors ml-auto"
          >
            <Trash2 size={14} /> 删除当前集群
          </button>
        )}
      </div>
    </div>
  );
}

export default ClusterSelector;
