import { useQuery } from '@tanstack/react-query';
import { Network, RefreshCw, Plus, ArrowDown } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';
import TopologyGraph from '../components/TopologyGraph';
import type { TopologyNode, TopologyEdge } from '../components/TopologyGraph';

interface Dependency {
  source: string;
  target: string;
  type: string;
  protocol: string;
  status: 'active' | 'inactive' | 'degraded';
  call_count?: number;
  avg_latency?: number;
}

interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

const protocolColors: Record<string, string> = {
  http: 'bg-blue-100 text-blue-700',
  https: 'bg-blue-100 text-blue-700',
  grpc: 'bg-purple-100 text-purple-700',
  tcp: 'bg-gray-100 text-gray-700',
  mysql: 'bg-orange-100 text-orange-700',
  redis: 'bg-red-100 text-red-700',
  kafka: 'bg-green-100 text-green-700',
  amqp: 'bg-yellow-100 text-yellow-700',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  degraded: 'bg-yellow-100 text-yellow-700',
};

const statusLabels: Record<string, string> = {
  active: '正常',
  inactive: '断开',
  degraded: '降级',
};

export default function Topology() {
  const { data: topologyData, isLoading: topologyLoading, refetch: refetchTopology } = useQuery({
    queryKey: ['topology', 'global'],
    queryFn: async () => {
      const res = await api.get('/api/topology/global');
      return res.data.data as TopologyData;
    },
  });

  const { data: dependencies, isLoading: depsLoading } = useQuery({
    queryKey: ['topology', 'dependencies'],
    queryFn: async () => {
      const res = await api.get('/api/topology/dependency');
      return res.data.data as Dependency[];
    },
  });

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Network className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">服务拓扑</h1>
            <p className="text-text-secondary text-sm mt-0.5">查看服务间依赖关系和调用链路</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchTopology()}
            disabled={topologyLoading}
            className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-lg flex items-center gap-2 text-sm disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={clsx('w-4 h-4', topologyLoading && 'animate-spin')} />
            刷新
          </button>
          <button
            className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowDown className="w-4 h-4" />
            发现依赖
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">拓扑视图</h2>
          {topologyLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <TopologyGraph
              nodes={topologyData?.nodes || []}
              edges={topologyData?.edges || []}
              height={500}
            />
          )}
        </div>

        <div className="bg-surface rounded-xl border border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">依赖列表</h2>
          </div>
          {depsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-text-secondary">源服务</th>
                    <th className="text-left px-4 py-3 font-medium text-text-secondary">目标服务</th>
                    <th className="text-left px-4 py-3 font-medium text-text-secondary">类型</th>
                    <th className="text-left px-4 py-3 font-medium text-text-secondary">协议</th>
                    <th className="text-left px-4 py-3 font-medium text-text-secondary">状态</th>
                    <th className="text-right px-4 py-3 font-medium text-text-secondary">调用次数</th>
                    <th className="text-right px-4 py-3 font-medium text-text-secondary">平均延迟</th>
                  </tr>
                </thead>
                <tbody>
                  {dependencies?.map((dep, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border/50 hover:bg-background/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-text-primary font-medium">{dep.source}</td>
                      <td className="px-4 py-3 text-text-primary">{dep.target}</td>
                      <td className="px-4 py-3 text-text-secondary">{dep.type}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', protocolColors[dep.protocol.toLowerCase()] || 'bg-gray-100 text-gray-700')}>
                          {dep.protocol.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusColors[dep.status])}>
                          {statusLabels[dep.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {dep.call_count?.toLocaleString() || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {dep.avg_latency ? `${dep.avg_latency}ms` : '-'}
                      </td>
                    </tr>
                  ))}
                  {dependencies?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                        暂无依赖数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
