import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, FileText as _FileText, Activity, Terminal, X } from 'lucide-react';
import api from '../../../lib/api';
import { formatBytes, statusBadge, withEndpointParams } from './types';

// ── Docker API 响应类型 ────────────────────────────────

interface DockerCPUStats {
  cpu_usage?: { total_usage?: number; percpu_usage?: number[] };
  system_cpu_usage?: number;
  online_cpus?: number;
}

interface DockerStats {
  cpu_stats?: DockerCPUStats;
  precpu_stats?: DockerCPUStats;
  memory_stats?: { usage?: number; limit?: number };
  networks?: Record<string, { rx_bytes: number; tx_bytes: number; rx_packets: number; tx_packets: number }>;
}

interface DockerContainerDetail {
  Id?: string;
  Name?: string;
  State?: { Status?: string };
  Config?: { Image?: string; WorkingDir?: string; Cmd?: string[] };
  Created?: string;
  Platform?: string;
  Os?: string;
  Architecture?: string;
}

// ── Props ──────────────────────────────────────────────

interface ContainerDetailProps {
  endpointId: string;
  selectedContainerId: string;
  selectedContainerName: string;
  showLogsDrawer: boolean;
  showStatsDrawer: boolean;
  showDetailDrawer: boolean;
  onCloseLogs: () => void;
  onCloseStats: () => void;
  onCloseDetail: () => void;
}

// ── Component ──────────────────────────────────────────

export function ContainerDetail({
  endpointId,
  selectedContainerId,
  selectedContainerName,
  showLogsDrawer,
  showStatsDrawer,
  showDetailDrawer,
  onCloseLogs,
  onCloseStats,
  onCloseDetail,
}: ContainerDetailProps) {
  // ═══ LOGS / STATS / DETAIL QUERIES ════════════════════

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['container-logs', selectedContainerId],
    queryFn: async () => {
      const { data } = await api.get(`/containers/logs/${selectedContainerId}`, {
        params: withEndpointParams(endpointId, { tail: 200 }),
      });
      return data as string;
    },
    enabled: showLogsDrawer && !!selectedContainerId,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['container-stats', selectedContainerId],
    queryFn: async () => {
      const { data } = await api.get(`/containers/stats/${selectedContainerId}`, {
        params: withEndpointParams(endpointId),
      });
      return data as DockerStats;
    },
    enabled: showStatsDrawer && !!selectedContainerId,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['container-detail', selectedContainerId],
    queryFn: async () => {
      const { data } = await api.get(`/containers/${selectedContainerId}`, {
        params: withEndpointParams(endpointId),
      });
      return data as DockerContainerDetail;
    },
    enabled: showDetailDrawer && !!selectedContainerId,
  });

  // ═══ RENDER ═══════════════════════════════════════════

  return (
    <>
      {/* ── Container Logs Drawer ── */}
      {showLogsDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onCloseLogs} />
          <div className="relative ml-auto w-full max-w-2xl bg-surface border-l border-border h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold text-text-primary">容器日志: {selectedContainerName}</h3>
              </div>
              <button onClick={onCloseLogs} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {logsLoading ? (
                <div className="text-text-tertiary text-sm">加载中...</div>
              ) : (
                <pre className="text-xs font-mono text-green-400 bg-black/40 rounded-lg p-4 overflow-auto whitespace-pre-wrap max-h-full leading-relaxed">
                  {logsData || '暂无日志'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Container Stats Drawer ── */}
      {showStatsDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onCloseStats} />
          <div className="relative ml-auto w-full max-w-lg bg-surface border-l border-border h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold text-text-primary">容器状态: {selectedContainerName}</h3>
              </div>
              <button onClick={onCloseStats} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {statsLoading ? (
                <div className="text-text-tertiary text-sm">加载中...</div>
              ) : statsData ? (
                <>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium text-text-secondary mb-3">CPU</h4>
                    {(() => {
                      const cpu = statsData.cpu_stats;
                      const pre = statsData.precpu_stats;
                      const cpuUsage = cpu?.cpu_usage;
                      const preCpuUsage = pre?.cpu_usage;
                      const sys = cpu?.system_cpu_usage ?? 0;
                      const preSys = pre?.system_cpu_usage ?? 0;
                      const usage = cpuUsage?.total_usage ?? 0;
                      const preUsage = preCpuUsage?.total_usage ?? 0;
                      const percpu = cpuUsage?.percpu_usage ?? [];
                      const online = cpu?.online_cpus ?? (percpu.length || 1);
                      const delta = usage - preUsage;
                      const sysDelta = sys - preSys || delta;
                      const pct = sysDelta > 0 ? (delta / sysDelta * online * 100).toFixed(1) : '0.0';
                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-text-tertiary">使用率</span>
                            <span className="text-lg font-bold text-text-primary">{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium text-text-secondary mb-3">内存</h4>
                    {(() => {
                      const mem = statsData.memory_stats;
                      const used = mem?.usage ?? 0;
                      const limit = mem?.limit ?? 1;
                      const pct = (used / limit * 100).toFixed(1);
                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-text-tertiary">使用 / 限制</span>
                            <span className="text-sm font-medium text-text-primary">{formatBytes(used)} / {formatBytes(limit)}</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-purple-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                          </div>
                          <div className="text-xs text-text-tertiary mt-1">{pct}%</div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium text-text-secondary mb-3">网络</h4>
                    {(() => {
                      const nets = statsData.networks;
                      if (!nets) return <div className="text-xs text-text-tertiary">无网络数据</div>;
                      return Object.entries(nets).map(([name, data]) => (
                        <div key={name} className="mb-3 last:mb-0">
                          <span className="text-xs font-medium text-text-primary">{name}</span>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div className="text-xs"><span className="text-text-tertiary">RX: </span><span className="text-green-400">{formatBytes(data.rx_bytes)}</span></div>
                            <div className="text-xs"><span className="text-text-tertiary">TX: </span><span className="text-blue-400">{formatBytes(data.tx_bytes)}</span></div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              ) : (
                <div className="text-text-tertiary text-sm">暂无统计数据</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Container Detail Drawer ── */}
      {showDetailDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onCloseDetail} />
          <div className="relative ml-auto w-full max-w-lg bg-surface border-l border-border h-full overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold text-text-primary">容器详情: {selectedContainerName}</h3>
              </div>
              <button onClick={onCloseDetail} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {detailLoading ? (
                <div className="text-text-tertiary text-sm">加载中...</div>
              ) : detailData ? (
                <div className="space-y-3">
                  {([
                    ['名称', detailData.Name || selectedContainerName],
                    ['ID', detailData.Id || '-'],
                    ['状态', (() => { const s = detailData.State?.Status || ''; const b = statusBadge(s); return <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${b.bg} ${b.text}`}><span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />{s || 'unknown'}</span>; })() as ReactNode],
                    ['镜像', detailData.Config?.Image || '-'],
                    ['工作目录', detailData.Config?.WorkingDir || '-'],
                    ['命令', (detailData.Config?.Cmd?.join(' ')) || '-'],
                    ['创建时间', (detailData.Created ? new Date(detailData.Created).toLocaleString('zh-CN') : '-')],
                    ['平台', (detailData.Platform || detailData.Os ? `${detailData.Os || ''}/${detailData.Architecture || ''}` : '-')],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="flex">
                      <span className="text-xs text-text-tertiary w-20 flex-shrink-0">{label}</span>
                      <span className="text-sm text-text-primary break-all">{value as ReactNode}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-tertiary text-sm">暂无详情数据</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
