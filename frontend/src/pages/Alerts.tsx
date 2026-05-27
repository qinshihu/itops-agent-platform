import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { Bell, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import api from '../lib/api';
import { ImportExport } from '../components/ImportExport';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeText } from '../lib/xss';

const wsUrl = window.location.origin;

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

  const { data: alerts, refetch } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await api.get('/api/alerts');
      return res.data.data as Alert[];
    },
  });

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
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-failed/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-status-failed" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {alerts?.filter((a) => a.status === 'new').length || 0}
                </p>
                <p className="text-sm text-text-secondary">新告警</p>
              </div>
            </div>
          </div>
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-warning/10 rounded-lg">
                <Clock className="w-5 h-5 text-status-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {alerts?.filter((a) => a.status === 'acknowledged').length || 0}
                </p>
                <p className="text-sm text-text-secondary">已确认</p>
              </div>
            </div>
          </div>
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-success/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-status-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {alerts?.filter((a) => a.status === 'resolved').length || 0}
                </p>
                <p className="text-sm text-text-secondary">已解决</p>
              </div>
            </div>
          </div>
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{alerts?.length || 0}</p>
                <p className="text-sm text-text-secondary">总计</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">告警列表</h2>
          </div>
          <div className="divide-y divide-border">
            {alerts?.map((alert) => (
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
                        {alert.severity}
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
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
