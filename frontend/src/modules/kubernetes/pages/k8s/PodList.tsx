/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, FileText, Eye, Trash2, X, AlertCircle, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../../lib/api';
import type { Pod, PodDetail } from '../Kubernetes';
import { podStatusColors, formatAge } from '../Kubernetes';

interface PodListProps {
  pods: Pod[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  context: string;
  searchText: string;
  onDeletePod: (pod: Pod) => void;
}

const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <AlertCircle size={36} className="text-red-400" />
    <p className="text-text-secondary text-sm">{message}</p>
    <button
      onClick={onRetry}
      className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
    >
      <RefreshCw size={14} /> 重试
    </button>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-2">
    <Box size={36} className="text-text-tertiary" />
    <p className="text-text-tertiary text-sm">{message}</p>
  </div>
);

export default function PodList({ pods, loading, error, onRetry, context, searchText, onDeletePod }: PodListProps) {
  const [podDetailOpen, setPodDetailOpen] = useState(false);
  const [podDetailTarget, setPodDetailTarget] = useState<Pod | null>(null);
  const [podLogsOpen, setPodLogsOpen] = useState(false);
  const [podLogsTarget, setPodLogsTarget] = useState<Pod | null>(null);

  const filtered = pods.filter(p =>
    !searchText || p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Pod 详情
  const {
    data: podDetail,
    isLoading: podDetailLoading,
  } = useQuery({
    queryKey: ['kubernetes-pod-detail', context, podDetailTarget?.namespace, podDetailTarget?.name],
    queryFn: async () => {
      if (!podDetailTarget || !context) return null;
      const res = await api.get(`/kubernetes/pods/${podDetailTarget.namespace}/${podDetailTarget.name}`, {
        params: { context },
      });
      return res.data.data as PodDetail;
    },
    enabled: !!podDetailTarget && !!context,
  });

  // Pod 日志
  const {
    data: podLogs,
    isLoading: podLogsLoading,
  } = useQuery({
    queryKey: ['kubernetes-pod-logs', context, podLogsTarget?.namespace, podLogsTarget?.name],
    queryFn: async () => {
      if (!podLogsTarget || !context) return '';
      const res = await api.get(`/kubernetes/pods/${podLogsTarget.namespace}/${podLogsTarget.name}/logs`, {
        params: { tail: 500, context },
      });
      return (res.data.data?.logs || res.data.data || res.data) as string;
    },
    enabled: !!podLogsTarget && !!context,
  });

  return (
    <div className="p-4">
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message="获取 Pods 失败" onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <EmptyState message={searchText ? '无匹配的 Pod' : '暂无 Pod 数据'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-tertiary">
                <th className="text-left py-3 px-3 font-medium">名称</th>
                <th className="text-left py-3 px-3 font-medium">命名空间</th>
                <th className="text-left py-3 px-3 font-medium">状态</th>
                <th className="text-left py-3 px-3 font-medium">就绪容器</th>
                <th className="text-left py-3 px-3 font-medium">重启次数</th>
                <th className="text-left py-3 px-3 font-medium">IP</th>
                <th className="text-left py-3 px-3 font-medium">节点</th>
                <th className="text-left py-3 px-3 font-medium">Age</th>
                <th className="text-right py-3 px-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(pod => (
                <tr key={`${pod.namespace}/${pod.name}`} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                  <td className="py-2.5 px-3 text-text-primary font-medium max-w-[200px] truncate">{pod.name}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{pod.namespace}</td>
                  <td className="py-2.5 px-3">
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', podStatusColors[pod.status] || 'text-text-tertiary bg-surface')}>
                      {pod.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary">{pod.ready}</td>
                  <td className="py-2.5 px-3">
                    <span className={clsx(pod.restarts > 5 ? 'text-red-400 font-medium' : 'text-text-secondary')}>
                      {pod.restarts}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary font-mono text-xs">{pod.ip || '-'}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{pod.node || '-'}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{formatAge(pod.creationTimestamp)}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setPodLogsTarget(pod); setPodLogsOpen(true); }}
                        className="p-1.5 text-text-tertiary hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="日志"
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        onClick={() => { setPodDetailTarget(pod); setPodDetailOpen(true); }}
                        className="p-1.5 text-text-tertiary hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        title="详情"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => onDeletePod(pod)}
                        className="p-1.5 text-text-tertiary hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pod 详情 Drawer */}
      {podDetailOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setPodDetailOpen(false); setPodDetailTarget(null); }} />
          <div className="relative w-full max-w-xl bg-card border-l border-border shadow-2xl h-full overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Eye size={18} /> Pod 详情
              </h3>
              <button
                onClick={() => { setPodDetailOpen(false); setPodDetailTarget(null); }}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {podDetailLoading ? (
                <Spinner />
              ) : podDetail ? (
                <>
                  <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-tertiary">名称</span>
                      <span className="text-text-primary font-medium">{podDetail.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-tertiary">命名空间</span>
                      <span className="text-text-primary">{podDetail.namespace}</span>
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-medium text-text-primary mb-2">Labels</h4>
                    {Object.keys(podDetail.labels || {}).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(podDetail.labels).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-md font-mono">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-text-tertiary text-sm">无 Labels</p>
                    )}
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-medium text-text-primary mb-2">Annotations</h4>
                    {Object.keys(podDetail.annotations || {}).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(podDetail.annotations).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded-md font-mono">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-text-tertiary text-sm">无 Annotations</p>
                    )}
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-medium text-text-primary mb-2">Conditions</h4>
                    {(podDetail.conditions || []).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border/50 text-text-tertiary">
                              <th className="text-left py-2 px-2 font-medium">类型</th>
                              <th className="text-left py-2 px-2 font-medium">状态</th>
                              <th className="text-left py-2 px-2 font-medium">原因</th>
                              <th className="text-left py-2 px-2 font-medium">消息</th>
                            </tr>
                          </thead>
                          <tbody>
                            {podDetail.conditions.map((c, i) => (
                              <tr key={i} className="border-b border-border/30">
                                <td className="py-2 px-2 text-text-primary">{c.type}</td>
                                <td className="py-2 px-2">
                                  <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', c.status === 'True' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-text-secondary">{c.reason || '-'}</td>
                                <td className="py-2 px-2 text-text-secondary max-w-[200px] truncate" title={c.message}>{c.message || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-text-tertiary text-sm">无 Conditions</p>
                    )}
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-medium text-text-primary mb-3">容器列表</h4>
                    {(podDetail.containers || []).length > 0 ? (
                      <div className="space-y-3">
                        {podDetail.containers.map((c, i) => (
                          <div key={i} className="bg-card border border-border rounded-lg p-3 space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-text-tertiary">容器名</span>
                              <span className="text-text-primary font-medium">{c.name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-text-tertiary">镜像</span>
                              <span className="text-text-secondary font-mono text-xs">{c.image}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-text-tertiary">端口</span>
                              <span className="text-text-secondary">{c.ports?.join(', ') || '-'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-text-tertiary text-sm">无容器信息</p>
                    )}
                  </div>
                </>
              ) : (
                <EmptyState message="无法加载 Pod 详情" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pod 日志 Drawer */}
      {podLogsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setPodLogsOpen(false); setPodLogsTarget(null); }} />
          <div className="relative w-full max-w-3xl bg-card border-l border-border shadow-2xl h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10 shrink-0">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <FileText size={18} /> Pod 日志
              </h3>
              <div className="flex items-center gap-2">
                {podLogsTarget && (
                  <span className="text-text-tertiary text-sm">{podLogsTarget.namespace}/{podLogsTarget.name}</span>
                )}
                <button
                  onClick={() => { setPodLogsOpen(false); setPodLogsTarget(null); }}
                  className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {podLogsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner />
                </div>
              ) : (
                <pre className="text-xs text-green-300 bg-[#0d1117] p-4 font-mono leading-relaxed whitespace-pre-wrap min-h-full">
                  {podLogs || '暂无日志'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
