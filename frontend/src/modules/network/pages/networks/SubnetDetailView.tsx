/**
 * 选中子网详情视图 widget（2026-07-21 拆分）
 *
 * 从原 Networks.tsx L224-388 抽出
 * 含返回按钮 + 标题 + IP 状态统计 + 搜索 + IP 表格 + 批量操作按钮
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import clsx from 'clsx';
import { ArrowLeft, Search } from 'lucide-react';
import { IP_STATUS_MAP, type IpBatchAction, type IpListData, type SubnetInfo } from './types';
import { IpListTable } from './IpListTable';

export interface SubnetDetailViewProps {
  subnet: SubnetInfo;
  ipData: IpListData | null;
  isLoadingIps: boolean;
  ipSearch: string;
  setIpSearch: (s: string) => void;
  ipStatusFilter: string;
  setIpStatusFilter: (s: string) => void;
  selectedIps: Set<string>;
  setSelectedIps: (s: Set<string>) => void;
  onBatchAction: (a: IpBatchAction) => void;
  onBack: () => void;
}

export function SubnetDetailView({
  subnet,
  ipData,
  isLoadingIps,
  ipSearch,
  setIpSearch,
  ipStatusFilter,
  setIpStatusFilter,
  selectedIps,
  setSelectedIps,
  onBatchAction,
  onBack,
}: SubnetDetailViewProps) {
  const ips = ipData?.ips || [];
  const stats = ipData?.stats || [];

  return (
    <div className="p-6 space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        返回子网列表
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary font-mono">{subnet.cidr}</h1>
          <p className="text-text-secondary text-sm mt-0.5">{subnet.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIps.size > 0 && (
            <>
              <button
                onClick={() => onBatchAction('use')}
                className="px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
              >
                标记为已用
              </button>
              <button
                onClick={() => onBatchAction('reserve')}
                className="px-3 py-1.5 text-xs font-medium bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors"
              >
                标记为预留
              </button>
              <button
                onClick={() => onBatchAction('release')}
                className="px-3 py-1.5 text-xs font-medium bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
              >
                释放
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.status}
            className={clsx(
              'bg-card border border-border rounded-lg p-3 text-center cursor-pointer transition-all',
              ipStatusFilter === s.status ? 'ring-2 ring-primary/50' : 'hover:border-primary/30',
            )}
            onClick={() => setIpStatusFilter(ipStatusFilter === s.status ? '' : s.status)}
          >
            <p className={clsx('text-xs mb-1', IP_STATUS_MAP[s.status]?.className)}>
              {IP_STATUS_MAP[s.status]?.label || s.status}
            </p>
            <p className="text-lg font-bold text-text-primary">{s.count}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜索IP、设备名、MAC..."
            value={ipSearch}
            onChange={(e) => setIpSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <IpListTable
        ips={ips}
        isLoading={isLoadingIps}
        selectedIps={selectedIps}
        onToggleIp={(id) => {
          const next = new Set(selectedIps);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setSelectedIps(next);
        }}
        onToggleAll={(checked) => {
          setSelectedIps(checked ? new Set(ips.map((ip) => ip.id)) : new Set());
        }}
      />
    </div>
  );
}
