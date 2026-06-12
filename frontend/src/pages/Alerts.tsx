import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Bell, CheckCircle, Clock, AlertCircle, Search, Play, ExternalLink, X as XIcon, Loader2, ListChecks, CheckCircle2, AlertCircle as AlertCircle2, Zap, Wifi, Wrench, Terminal } from 'lucide-react';
import { safeFormatDistance } from '../lib/date';
import clsx from 'clsx';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeText } from '../lib/xss';

const wsUrl = window.location.origin;
const WS_RECONNECT_INTERVALS = [1000, 2000, 5000, 10000, 30000];

interface Alert {
  id: string;
  source: string;
  severity: string;
  title: string;
  content: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ProcessResult {
  alertId: string;
  matchedPolicies: Array<{ id: string; name: string; execution_mode: string }>;
  executionIds: string[];
  error: string | null;
}

export default function Alerts() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: alerts, refetch } = useQuery({
    queryKey: ['alerts', statusFilter, severityFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      const res = await api.get('/api/alerts', { params });
      return res.data.data as Alert[];
    },
    staleTime: 30000,
  });

  // 关联数据：AI 分析结果 + 修复执行记录
  const { data: analysisMap = {} } = useQuery({
    queryKey: ['alert-auto-analysis-map'],
    queryFn: async () => {
      const res = await api.get('/api/alert-auto-analysis?limit=200');
      const items = (res.data.data || []) as any[];
      const map: Record<string, any> = {};
      items.forEach((item: any) => { if (item.alert_id && !map[item.alert_id]) map[item.alert_id] = item; });
      return map;
    },
    refetchInterval: 30000,
  });

  const connectWebSocketRef = useRef<ReturnType<typeof connectWebSocketInner> | null>(null);
  const scheduleReconnectRef = useRef<(() => void) | null>(null);

  const connectWebSocketInner = useCallback(() => {
    if (!token) return;

    const socket: Socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: false,
    });

    socket.on('connect', () => {
      setWsConnected(true);
      reconnectAttemptRef.current = 0;
      socket.emit('alert:subscribe');
    });

    socket.on('disconnect', () => {
      setWsConnected(false);
      scheduleReconnectRef.current?.();
    });

    socket.on('connect_error', () => {
      setWsConnected(false);
      scheduleReconnectRef.current?.();
    });

    socket.on('alert:new', () => {
      refetch();
    });

    socket.on('alert:updated', () => {
      refetch();
    });

    socketRef.current = socket;

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('alert:new');
      socket.off('alert:updated');
      socket.emit('alert:unsubscribe');
      socket.disconnect();
    };
  }, [token, refetch]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= WS_RECONNECT_INTERVALS.length) return;
    const delay = WS_RECONNECT_INTERVALS[reconnectAttemptRef.current];
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current++;
      connectWebSocketRef.current?.();
    }, delay);
  }, []);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocketInner;
    scheduleReconnectRef.current = scheduleReconnect;
    const cleanup = connectWebSocketInner();
    return () => {
      cleanup?.();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectWebSocketInner, scheduleReconnect]);

  const serverSideFilteredAlerts = alerts?.filter((alert) => {
    if (!searchQuery) return true;
    return alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.source.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, string> = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低',
    };
    return labels[severity] || severity;
  };

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      }
    });

    const handleConnect = () => {
      socket.emit('alert:subscribe');
    };

    const handleAlertNew = (data: Alert) => {
      console.log('New alert:', data);
      refetch();
    };

    const handleAlertUpdated = () => {
      refetch();
    };

    socket.on('connect', handleConnect);
    socket.on('alert:new', handleAlertNew);
    socket.on('alert:updated', handleAlertUpdated);

    return () => {
      socket.emit('alert:unsubscribe');
      socket.off('connect', handleConnect);
      socket.off('alert:new', handleAlertNew);
      socket.off('alert:updated', handleAlertUpdated);
      socket.disconnect();
    };
  }, [refetch, token]);

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.put(`/api/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => refetch(),
  });

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.put(`/api/alerts/${alertId}/resolve`);
    },
    onSuccess: () => refetch(),
  });

  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  const processMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await api.post(`/api/alerts/${alertId}/process`);
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.data) {
        setProcessResult(data.data);
      }
      refetch();
    },
  });

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">告警中心</h1>
            <p className="text-text-secondary">查看和管理系统告警</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface rounded-xl p-5 border border-border hover:border-status-failed/30 transition-all">
            <div className="p-2 bg-status-failed/10 rounded-lg w-fit mb-3">
              <AlertCircle className="w-5 h-5 text-status-failed" />
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">
              {alerts?.filter((a) => a.status === 'new').length || 0}
            </p>
            <p className="text-sm text-text-secondary">新告警</p>
          </div>
          <div className="bg-surface rounded-xl p-5 border border-border hover:border-status-warning/30 transition-all">
            <div className="p-2 bg-status-warning/10 rounded-lg w-fit mb-3">
              <Clock className="w-5 h-5 text-status-warning" />
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">
              {alerts?.filter((a) => a.status === 'acknowledged').length || 0}
            </p>
            <p className="text-sm text-text-secondary">已确认</p>
          </div>
          <div className="bg-surface rounded-xl p-5 border border-border hover:border-status-success/30 transition-all">
            <div className="p-2 bg-status-success/10 rounded-lg w-fit mb-3">
              <CheckCircle className="w-5 h-5 text-status-success" />
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">
              {alerts?.filter((a) => a.status === 'resolved').length || 0}
            </p>
            <p className="text-sm text-text-secondary">已解决</p>
          </div>
          <div className="bg-surface rounded-xl p-5 border border-border hover:border-primary/30 transition-all">
            <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">{alerts?.length || 0}</p>
            <p className="text-sm text-text-secondary">总计</p>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">告警列表</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="搜索告警..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary"
                />
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="all">所有级别</option>
                <option value="critical">严重</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="all">所有状态</option>
                <option value="new">新</option>
                <option value="acknowledged">已确认</option>
                <option value="resolved">已解决</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-border">
            {serverSideFilteredAlerts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-xl bg-surface border border-border mb-3">
                  <Bell className="w-8 h-8 text-text-secondary opacity-50" />
                </div>
                <p className="text-sm text-text-secondary mb-1">暂无告警</p>
                <p className="text-xs text-text-tertiary">系统运行正常，没有告警信息</p>
              </div>
            ) : (
              serverSideFilteredAlerts?.map((alert: Alert) => (
              <div key={alert.id} className="p-6 hover:bg-background/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium',
                          alert.severity === 'critical' && 'bg-status-failed/10 text-status-failed',
                          alert.severity === 'high' && 'bg-status-warning/10 text-status-warning',
                          alert.severity === 'medium' && 'bg-primary/10 text-primary',
                          alert.severity === 'low' && 'bg-status-pending/10 text-status-pending'
                        )}
                      >
                        {getSeverityLabel(alert.severity)}
                      </span>
                      <span
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium',
                          alert.status === 'new' && 'bg-status-failed/10 text-status-failed',
                          alert.status === 'acknowledged' && 'bg-status-warning/10 text-status-warning',
                          alert.status === 'resolved' && 'bg-status-success/10 text-status-success'
                        )}
                      >
                        {alert.status === 'new' && '新'}
                        {alert.status === 'acknowledged' && '已确认'}
                        {alert.status === 'resolved' && '已解决'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-text-primary mb-1">{sanitizeText(alert.title)}</h3>
                    <p className="text-sm text-text-secondary mb-2">{sanitizeText(alert.content)}</p>
                    <div className="flex items-center gap-4 text-xs text-text-secondary">
                      <span>来源: {sanitizeText(alert.source)}</span>
                      <span>
                        {safeFormatDistance(alert.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {alert.status !== 'resolved' && (
                      <button
                        onClick={() => processMutation.mutate(alert.id)}
                        disabled={processMutation.isPending}
                        className="px-3 py-1 text-sm bg-purple-600/10 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-600/20 transition-colors flex items-center gap-1"
                        title="手动触发匹配映射+修复策略+根因分析"
                      >
                        <Play className="w-3.5 h-3.5" />
                        处理
                      </button>
                    )}
                    {alert.status === 'new' && (
                      <button
                        onClick={() => acknowledgeMutation.mutate(alert.id)}
                        className="px-3 py-1 text-sm bg-status-warning/10 text-status-warning rounded-lg hover:bg-status-warning/20"
                      >
                        确认
                      </button>
                    )}
                    {alert.status !== 'resolved' && (
                      <button
                        onClick={() => resolveMutation.mutate(alert.id)}
                        className="px-3 py-1 text-sm bg-status-success/10 text-status-success rounded-lg hover:bg-status-success/20"
                      >
                        解决
                      </button>
                    )}
                  </div>
                </div>

                {/* ── 关联操作 ── */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                  {analysisMap[alert.id] && (
                    <button
                      onClick={() => navigate(`/alert-auto-analysis?alertId=${alert.id}`)}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded bg-emerald-500/5 hover:bg-emerald-500/10"
                    >
                      <Zap className="w-3 h-3" />
                      AI 分析
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/remediation-executions?alertId=${alert.id}`)}
                    className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors px-2 py-1 rounded bg-orange-500/5 hover:bg-orange-500/10"
                  >
                    <Wrench className="w-3 h-3" />
                    修复记录
                  </button>
                  <button
                    onClick={() => navigate(`/inspection-center?alertId=${alert.id}`)}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded bg-blue-500/5 hover:bg-blue-500/10"
                  >
                    <Wifi className="w-3 h-3" />
                    巡检结果
                  </button>
                  <button
                    onClick={() => navigate(`/root-cause-analysis?alertId=${alert.id}`)}
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded bg-purple-500/5 hover:bg-purple-500/10"
                  >
                    <Search className="w-3 h-3" />
                    根因分析
                  </button>
                  {analysisMap[alert.id]?.status === 'completed' && (
                    <span className="ml-auto text-xs text-emerald-500/60">
                      ✅ 已自动诊断
                    </span>
                  )}
                </div>
              </div>
            ))
            )}
          </div>
        </div>
      </div>

      {/* 处理结果弹窗 */}
      {processResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col">
            {/* 头部 */}
            <div className={`p-4 border-b border-border flex items-center justify-between rounded-t-xl ${
              processResult.error
                ? 'bg-gradient-to-r from-amber-500/10 to-red-500/10'
                : processResult.matchedPolicies.length > 0
                  ? 'bg-gradient-to-r from-green-500/10 to-blue-500/10'
                  : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10'
            }`}>
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                {processResult.error ? (
                  <AlertCircle2 className="w-5 h-5 text-red-500" />
                ) : processResult.matchedPolicies.length > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Play className="w-5 h-5 text-blue-500" />
                )}
                告警处理结果
              </h3>
              <button
                onClick={() => setProcessResult(null)}
                className="p-1.5 rounded-lg hover:bg-background transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-auto flex-1">
              {/* 状态 */}
              <div className={`p-3 rounded-lg border ${
                processResult.error
                  ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                  : processResult.matchedPolicies.length > 0
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
              }`}>
                <p className="text-sm font-medium">
                  {processResult.error
                    ? '⚠️ 执行遇到错误: ' + processResult.error
                    : processResult.matchedPolicies.length > 0
                      ? `✅ 成功匹配 ${processResult.matchedPolicies.length} 条修复策略，${processResult.executionIds.length} 个执行已触发`
                      : 'ℹ️ 未匹配到任何修复策略（告警级别/关键词不满足已有策略条件）'}
                </p>
              </div>

              {/* 策略列表 */}
              {processResult.matchedPolicies.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-primary" />
                    匹配的策略
                  </h4>
                  <div className="space-y-2">
                    {processResult.matchedPolicies.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm text-text-primary">{p.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.execution_mode === 'auto' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                          p.execution_mode === 'approval' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                          'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {p.execution_mode === 'auto' ? '自动' : p.execution_mode === 'approval' ? '需审批' : '仅建议'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 执行ID */}
              {processResult.executionIds.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-2">执行记录 ID</h4>
                  <div className="space-y-1">
                    {processResult.executionIds.map(eid => (
                      <code key={eid} className="block text-xs bg-background px-2 py-1 rounded border border-border text-text-secondary truncate">
                        {eid}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 底部操作 */}
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setProcessResult(null)}
                className="px-4 py-2 bg-background border border-border rounded-lg text-text-primary hover:bg-surface transition-colors font-medium text-sm"
              >
                关闭
              </button>
              {processResult.executionIds.length > 0 && (
                <button
                  onClick={() => {
                    setProcessResult(null);
                    navigate('/remediation-executions');
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  查看执行记录
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 处理中遮罩 */}
      {processMutation.isPending && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl border border-border p-6 shadow-2xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-text-primary font-medium">正在处理告警...</span>
          </div>
        </div>
      )}
    </div>
  );
}
