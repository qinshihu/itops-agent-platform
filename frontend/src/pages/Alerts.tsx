import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { Bell, CheckCircle, Clock, AlertCircle, Search } from 'lucide-react';
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

export default function Alerts() {
  const { token } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [_wsConnected, setWsConnected] = useState(false);
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
              </div>
            ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
