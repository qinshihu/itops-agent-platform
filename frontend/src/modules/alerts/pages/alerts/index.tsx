/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { useAlertSocket } from './useAlertSocket';
import AlertFilterBar from './AlertFilterBar';
import AlertList from './AlertList';
import AlertDetailPanel from './AlertDetailPanel';
import AutomationLogPanel from './AutomationLogPanel';
import type { Alert, ProcessResult, AutomationLog, AnalysisItem } from './types';

export default function Alerts() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [automationLogAlert, setAutomationLogAlert] = useState<Alert | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  const { data: alerts, refetch } = useQuery({
    queryKey: ['alerts', statusFilter, severityFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      const { data } = await api.get('/alerts', { params });
      return data as Alert[];
    },
    staleTime: 30000,
  });

  const { wsConnected: _wsConnected } = useAlertSocket(token, refetch);

  // 关联数据：AI 分析结果 + 修复执行记录
  const { data: analysisMap = {} } = useQuery({
    queryKey: ['alert-auto-analysis-map'],
    queryFn: async () => {
      const { data } = await api.get('/alert-auto-analysis?limit=200');
      const items = (data || []) as AnalysisItem[];
      const map: Record<string, AnalysisItem> = {};
      items.forEach((item) => { if (item.alert_id && !map[item.alert_id]) map[item.alert_id] = item; });
      return map;
    },
    refetchInterval: 30000,
  });

  const { data: automationLogs = [], isLoading: automationLogsLoading } = useQuery({
    queryKey: ['alert-automation-logs', automationLogAlert?.id],
    enabled: !!automationLogAlert,
    queryFn: async () => {
      const { data } = await api.get(`/alerts/${automationLogAlert!.id}/automation-logs`);
      return (data || []) as AutomationLog[];
    },
  });

  const serverSideFilteredAlerts = useMemo(() => {
    if (!alerts) return [];
    if (!searchQuery) return alerts;
    return alerts.filter((alert) => {
      return alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.source.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [alerts, searchQuery]);

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.put(`/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => refetch(),
  });

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.put(`/alerts/${alertId}/resolve`);
    },
    onSuccess: () => refetch(),
  });

  const processMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { data } = await api.post(`/alerts/${alertId}/process`);
      return data;
    },
    onSuccess: (data) => {
      // axios 拦截器已解包 → data 本身就是后端 data 字段
      if (data) {
        setProcessResult(data);
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
          <AlertFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            severityFilter={severityFilter}
            onSeverityChange={setSeverityFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />
          <AlertList
            alerts={serverSideFilteredAlerts}
            analysisMap={analysisMap}
            onProcess={(alertId) => processMutation.mutate(alertId)}
            processPending={processMutation.isPending}
            onAcknowledge={(alertId) => acknowledgeMutation.mutate(alertId)}
            onResolve={(alertId) => resolveMutation.mutate(alertId)}
            navigate={(path) => navigate(path)}
            onViewAutomationLog={setAutomationLogAlert}
          />
        </div>
      </div>

      {processResult && (
        <AlertDetailPanel
          processResult={processResult}
          onClose={() => setProcessResult(null)}
          navigate={(path) => navigate(path)}
        />
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

      {automationLogAlert && (
        <AutomationLogPanel
          alert={automationLogAlert}
          onClose={() => setAutomationLogAlert(null)}
          logs={automationLogs}
          loading={automationLogsLoading}
        />
      )}
    </div>
  );
}