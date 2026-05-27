import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Shield,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Activity,
  ListChecks,
  Zap,
  XCircle,
  RotateCcw,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';

interface RemediationStats {
  total_policies: number;
  enabled_policies: number;
  today: {
    total: number;
    success: number;
    failed: number;
    rolled_back: number;
    success_rate: number;
    avg_duration_ms: number;
  };
  waiting_approval: number;
  recent_executions: Array<{
    id: string;
    status: string;
    status_reason: string;
    created_at: string;
    policy_name: string;
    execution_mode: string;
    alert_title: string;
    alert_severity: string;
  }>;
}

interface PolicyWithStats {
  id: string;
  name: string;
  enabled: number;
  alert_source: string;
  alert_severity: string;
  stats: {
    total_triggers: number;
    success_rate: number;
    avg_duration_ms: number;
  };
}

interface AlertSourceStats {
  source: string;
  total_alerts: number;
  new_alerts: number;
  active_alerts: number;
  resolved_alerts: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

export default function RemediationDashboard() {
  const [trendPeriod, setTrendPeriod] = useState<'24h' | '7d'>('24h');

  const { data: remediationStats, isLoading: isLoadingRemediation } = useQuery({
    queryKey: ['remediation-stats'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/remediation-stats');
      return res.data.data as RemediationStats;
    },
    refetchInterval: 30000,
    staleTime: 30000,
  });

  const { data: allPolicies } = useQuery({
    queryKey: ['remediation-policies-all'],
    queryFn: async () => {
      const res = await api.get('/api/remediation-policies', { params: { limit: 100 } });
      return res.data.data.policies as Array<{
        id: string;
        name: string;
        enabled: number;
        alert_source: string;
        alert_severity: string;
      }>;
    },
    staleTime: 60000,
  });

  const { data: policiesWithStats, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ['remediation-policies-with-stats'],
    queryFn: async () => {
      if (!allPolicies || allPolicies.length === 0) return [];

      const statsPromises = allPolicies.slice(0, 10).map(async (policy) => {
        try {
          const res = await api.get(`/api/remediation-policies/${policy.id}/stats`, {
            params: { days: 7 },
          });
          return {
            id: policy.id,
            name: policy.name,
            enabled: policy.enabled,
            alert_source: policy.alert_source,
            alert_severity: policy.alert_severity,
            stats: res.data.data as {
              total_triggers: number;
              success_rate: number;
              avg_duration_ms: number;
            },
          };
        } catch {
          return {
            id: policy.id,
            name: policy.name,
            enabled: policy.enabled,
            alert_source: policy.alert_source,
            alert_severity: policy.alert_severity,
            stats: { total_triggers: 0, success_rate: 0, avg_duration_ms: 0 },
          };
        }
      });

      return (await Promise.all(statsPromises)).filter((p) => p.stats.total_triggers > 0);
    },
    enabled: !!allPolicies && allPolicies.length > 0,
    staleTime: 60000,
  });

  const { data: alertSourceStats, isLoading: isLoadingSources } = useQuery({
    queryKey: ['alert-source-stats'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/alert-source-stats');
      return res.data.data.source_stats as AlertSourceStats[];
    },
    staleTime: 60000,
  });

  const { data: executionTrend } = useQuery({
    queryKey: ['remediation-trend', trendPeriod],
    queryFn: async () => {
      const hours = trendPeriod === '24h' ? 24 : 168;
      const res = await api.get('/api/dashboard/task-trends', { params: { hours } });
      return res.data.data as Array<{
        time_bucket: string;
        total: number;
        completed: number;
        failed: number;
        running: number;
      }>;
    },
    staleTime: 60000,
  });

  const stats = remediationStats?.today || {
    total: 0,
    success: 0,
    failed: 0,
    rolled_back: 0,
    success_rate: 0,
    avg_duration_ms: 0,
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { text: string; className: string; icon: React.ReactNode }> = {
      success: {
        text: '成功',
        className: 'bg-green-500/10 text-green-400 border-green-500/20',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
      },
      failed: {
        text: '失败',
        className: 'bg-red-500/10 text-red-400 border-red-500/20',
        icon: <XCircle className="w-3.5 h-3.5" />,
      },
      rolled_back: {
        text: '已回滚',
        className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        icon: <RotateCcw className="w-3.5 h-3.5" />,
      },
      pending: {
        text: '等待中',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        icon: <Clock className="w-3.5 h-3.5" />,
      },
      running: {
        text: '执行中',
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        icon: <Activity className="w-3.5 h-3.5" />,
      },
      waiting_approval: {
        text: '待审批',
        className: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        icon: <AlertCircle className="w-3.5 h-3.5" />,
      },
      skipped: {
        text: '已跳过',
        className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        icon: <ArrowDown className="w-3.5 h-3.5" />,
      },
      rejected: {
        text: '已拒绝',
        className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        icon: <XCircle className="w-3.5 h-3.5" />,
      },
    };

    const item = config[status] || {
      text: status,
      className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${item.className}`}>
        {item.icon}
        {item.text}
      </span>
    );
  };

  const getSeverityBadge = (severity: string) => {
    if (!severity) return null;
    const config: Record<string, string> = {
      critical: 'bg-red-500/10 text-red-400',
      high: 'bg-orange-500/10 text-orange-400',
      medium: 'bg-yellow-500/10 text-yellow-400',
      low: 'bg-green-500/10 text-green-400',
    };
    const className = config[severity] || 'bg-gray-500/10 text-gray-400';
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
        {severity}
      </span>
    );
  };

  const sortedPoliciesBySuccessRate = [...(policiesWithStats || [])].sort(
    (a, b) => b.stats.success_rate - a.stats.success_rate
  );

  const maxTriggers = Math.max(
    ...executionTrend?.map((d) => d.total) || [1],
    1
  );

  const loading = isLoadingRemediation || isLoadingPolicies || isLoadingSources;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">修复效果仪表盘</h1>
            <p className="text-slate-400 text-sm">自动修复策略执行效果与统计分析</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg p-1">
            <button
              onClick={() => setTrendPeriod('24h')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                trendPeriod === '24h'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              最近24小时
            </button>
            <button
              onClick={() => setTrendPeriod('7d')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                trendPeriod === '7d'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              最近7天
            </button>
          </div>
        </div>

        {/* Overall Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 hover:border-blue-500/50 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '...' : remediationStats?.total_policies || 0}
            </div>
            <div className="text-sm text-slate-400">总策略数</div>
            <div className="mt-2 text-xs text-green-400">
              {loading ? '' : `${remediationStats?.enabled_policies || 0} 个已启用`}
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 hover:border-green-500/50 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className={`text-sm font-medium ${stats.success_rate >= 80 ? 'text-green-400' : stats.success_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.success_rate}%
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '...' : stats.total}
            </div>
            <div className="text-sm text-slate-400">今日修复执行</div>
            <div className="mt-2 text-xs text-slate-500">
              成功 {stats.success} · 失败 {stats.failed}
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 hover:border-purple-500/50 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '...' : formatDuration(stats.avg_duration_ms)}
            </div>
            <div className="text-sm text-slate-400">平均执行时间</div>
            <div className="mt-2 text-xs text-slate-500">
              今日已回滚 {stats.rolled_back} 次
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 hover:border-orange-500/50 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-orange-500/10">
                <AlertCircle className="w-5 h-5 text-orange-400" />
              </div>
              {remediationStats?.waiting_approval ? (
                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs">
                  待处理
                </span>
              ) : null}
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '...' : remediationStats?.waiting_approval || 0}
            </div>
            <div className="text-sm text-slate-400">待审批</div>
            <div className="mt-2 text-xs text-slate-500">
              等待人工确认
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Execution Trend */}
          <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                执行趋势
              </h2>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  成功
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  失败
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  执行中
                </span>
              </div>
            </div>
            <div className="h-48 flex items-end gap-1.5">
              {executionTrend && executionTrend.length > 0 ? (
                executionTrend.slice(-24).map((item, index) => {
                  const successHeight = (item.completed / maxTriggers) * 100;
                  const failedHeight = (item.failed / maxTriggers) * 100;
                  const runningHeight = (item.running / maxTriggers) * 100;
                  const label = trendPeriod === '24h'
                    ? format(parseISO(item.time_bucket), 'HH:mm')
                    : format(parseISO(item.time_bucket), 'MM/dd');
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center group">
                      <div className="relative w-full flex flex-col items-center h-40 justify-end">
                        <div className="absolute bottom-0 w-full flex flex-col items-center">
                          {runningHeight > 0 && (
                            <div
                              className="w-full bg-purple-500/60 rounded-t-sm min-h-[2px] transition-all hover:bg-purple-400"
                              style={{ height: `${runningHeight}%` }}
                            />
                          )}
                          {successHeight > 0 && (
                            <div
                              className="w-full bg-green-500/60 min-h-[2px] transition-all hover:bg-green-400"
                              style={{ height: `${successHeight}%` }}
                            />
                          )}
                          {failedHeight > 0 && (
                            <div
                              className="w-full bg-red-500/60 rounded-b-sm min-h-[2px] transition-all hover:bg-red-400"
                              style={{ height: `${failedHeight}%` }}
                            />
                          )}
                        </div>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          总数: {item.total}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-2 truncate w-full text-center">
                        {label}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  暂无执行数据
                </div>
              )}
            </div>
          </div>

          {/* Policy Success Rate Ranking */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-400" />
                策略成功率排行
              </h2>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-thin">
              {sortedPoliciesBySuccessRate.length > 0 ? (
                sortedPoliciesBySuccessRate.map((policy, index) => (
                  <div
                    key={policy.id}
                    className="p-3 rounded-lg bg-slate-900/50 hover:bg-slate-700/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : index === 1
                              ? 'bg-slate-400/20 text-slate-300'
                              : index === 2
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-slate-700/50 text-slate-500'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="text-sm text-white font-medium truncate max-w-[120px]">
                          {policy.name}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          policy.stats.success_rate >= 80
                            ? 'text-green-400'
                            : policy.stats.success_rate >= 50
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        {policy.stats.success_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          policy.stats.success_rate >= 80
                            ? 'bg-green-500'
                            : policy.stats.success_rate >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${policy.stats.success_rate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
                      <span>触发 {policy.stats.total_triggers} 次</span>
                      <span>平均 {formatDuration(policy.stats.avg_duration_ms)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  暂无策略执行数据
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert Source Stats */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              按告警来源分组统计
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alertSourceStats && alertSourceStats.length > 0 ? (
              alertSourceStats.slice(0, 6).map((source) => {
                const resolveRate =
                  source.total_alerts > 0
                    ? ((source.resolved_alerts / source.total_alerts) * 100).toFixed(1)
                    : '0';
                return (
                  <div
                    key={source.source}
                    className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/30 hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-white text-sm">{source.source}</h3>
                      <span className="text-xs text-slate-400">
                        解决率 {resolveRate}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="text-center p-2 bg-slate-800/50 rounded">
                        <div className="text-lg font-bold text-white">{source.total_alerts}</div>
                        <div className="text-[10px] text-slate-500">总告警</div>
                      </div>
                      <div className="text-center p-2 bg-green-500/5 rounded">
                        <div className="text-lg font-bold text-green-400">{source.resolved_alerts}</div>
                        <div className="text-[10px] text-slate-500">已解决</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {source.critical_count > 0 && (
                        <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
                          严重 {source.critical_count}
                        </span>
                      )}
                      {source.high_count > 0 && (
                        <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded">
                          高 {source.high_count}
                        </span>
                      )}
                      {source.medium_count > 0 && (
                        <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">
                          中 {source.medium_count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-3 text-center py-8 text-slate-500">
                暂无告警来源数据
              </div>
            )}
          </div>
        </div>

        {/* Recent Executions */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-cyan-400" />
              最近修复执行记录
            </h2>
            <span className="text-xs text-slate-400">
              共 {remediationStats?.recent_executions?.length || 0} 条
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">执行ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">策略</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">告警</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">执行时间</th>
                </tr>
              </thead>
              <tbody>
                {remediationStats?.recent_executions && remediationStats.recent_executions.length > 0 ? (
                  remediationStats.recent_executions.map((exec) => (
                    <tr
                      key={exec.id}
                      className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-500 font-mono">
                          {exec.id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-white font-medium">{exec.policy_name}</div>
                        <div className="text-xs text-slate-500">{exec.execution_mode}</div>
                      </td>
                      <td className="py-3 px-4">
                        {exec.alert_title ? (
                          <div>
                            <div className="text-sm text-slate-300 truncate max-w-[200px]">
                              {exec.alert_title}
                            </div>
                            {getSeverityBadge(exec.alert_severity)}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(exec.status)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-400">
                          {formatDistanceToNow(parseISO(exec.created_at), { addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      暂无执行记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
