import { Plus, RefreshCw, Eye } from 'lucide-react';
import clsx from 'clsx';
import { formatAge } from './types';
import type { Deployment } from './types';

interface DeploymentTableProps {
  deployments: Deployment[];
  filteredDeployments: Deployment[];
  isLoading: boolean;
  isError: boolean;
  searchText: string;
  onRetry: () => void;
  onScale: (dep: Deployment) => void;
  onRestart: (dep: Deployment) => void;
  onDetail: (dep: Deployment) => void;
}

export default function DeploymentTable({
  _deployments,
  filteredDeployments,
  isLoading,
  isError,
  searchText,
  onRetry,
  onScale,
  onRestart,
  onDetail,
}: DeploymentTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
          <RefreshCw size={20} className="text-red-400" />
        </div>
        <p className="text-text-secondary text-sm">获取 Deployments 失败</p>
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <RefreshCw size={14} /> 重试
        </button>
      </div>
    );
  }

  if (filteredDeployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
          <RefreshCw size={20} className="text-text-tertiary" />
        </div>
        <p className="text-text-tertiary text-sm">
          {searchText ? '无匹配的 Deployment' : '暂无 Deployment 数据'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-text-tertiary">
            <th className="text-left py-3 px-3 font-medium">名称</th>
            <th className="text-left py-3 px-3 font-medium">命名空间</th>
            <th className="text-left py-3 px-3 font-medium">副本数</th>
            <th className="text-left py-3 px-3 font-medium">镜像</th>
            <th className="text-left py-3 px-3 font-medium">Age</th>
            <th className="text-right py-3 px-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredDeployments.map(dep => (
            <tr key={`${dep.namespace}/${dep.name}`} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
              <td className="py-2.5 px-3 text-text-primary font-medium max-w-[200px] truncate">{dep.name}</td>
              <td className="py-2.5 px-3 text-text-secondary">{dep.namespace}</td>
              <td className="py-2.5 px-3">
                <span className={clsx(
                  'font-medium',
                  dep.availableReplicas < dep.replicas ? 'text-yellow-400' : 'text-green-400',
                )}>
                  {dep.availableReplicas} / {dep.replicas}
                </span>
              </td>
              <td className="py-2.5 px-3 text-text-secondary font-mono text-xs max-w-[280px] truncate">{dep.image}</td>
              <td className="py-2.5 px-3 text-text-secondary">{formatAge(dep.creationTimestamp)}</td>
              <td className="py-2.5 px-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onScale(dep)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-status-warning bg-surface hover:bg-status-warning/10 rounded transition-colors border border-border"
                  >
                    <Plus size={12} /> 扩缩容
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`确定要重启 Deployment "${dep.name}" 吗？`)) {
                        onRestart(dep);
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary bg-surface hover:bg-primary/10 rounded transition-colors border border-border"
                  >
                    <RefreshCw size={12} /> 重启
                  </button>
                  <button
                    onClick={() => onDetail(dep)}
                    className="p-1.5 text-text-tertiary hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                    title="详情"
                  >
                    <Eye size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}