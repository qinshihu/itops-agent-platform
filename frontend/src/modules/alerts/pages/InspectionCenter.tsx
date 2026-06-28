import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, Search, Loader2, Zap, Wifi, FileText, Server, Eye, Bell, Clock, CheckCircle2, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import TrendCharts from '../../../modules/monitor/components/TrendCharts';
import clsx from 'clsx';
import api from '../../../lib/api';
import { safeFormatDistance } from '../../../lib/date';

interface InspectionItem {
  id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  source: 'inspection' | 'analysis';
  type: string;
  status: 'success' | 'failed' | 'partial';
  summary: string;
  duration_ms: number;
  created_at: string;
  raw: any;
}

export default function InspectionCenter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('alertId') || searchParams.get('deviceId') || '');
  const [filter, setFilter] = useState<'all' | 'inspection' | 'analysis'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'network_device' | 'server'>('all');
  const [showTrends, setShowTrends] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inspection-center', filter, typeFilter],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '200' };
      if (searchParams.get('deviceId')) params.deviceId = searchParams.get('deviceId')!;
      const res = await api.get('/api/inspection-center', { params });
      return (res.data.data || []) as InspectionItem[];
    },
    refetchInterval: 30000,
  });

  const { data: counts } = useQuery({
    queryKey: ['dashboard-linkage'],
    queryFn: () => api.get('/api/dashboard/linkage').then(r => r.data.data || {}),
    refetchInterval: 60000,
  });

  const filtered = items.filter(item => {
    if (filter !== 'all' && item.source !== filter) return false;
    if (typeFilter !== 'all') {
      const type = item.type.includes('network_device') ? 'network_device' : 'server';
      if (type !== typeFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (item.device_name?.toLowerCase().includes(q) || item.device_ip?.toLowerCase().includes(q) || item.summary?.toLowerCase().includes(q));
    }
    return true;
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      default: return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const sourceIcon = (source: string) => {
    if (source === 'analysis') return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
    return <Wifi className="w-3.5 h-3.5 text-blue-400" />;
  };

  const sourceLabel = (source: string, type: string) => {
    if (source === 'analysis') return 'AI 分析';
    if (type === 'snmp') return 'SNMP 巡检';
    if (type === 'compliance') return '合规巡检';
    return 'SSH 巡检';
  };

  const handleItemClick = (item: InspectionItem) => {
    if (item.source === 'analysis') {
      navigate(`/alert-auto-analysis?alertId=${item.raw?.alert_id || ''}`);
    } else if (item.source === 'inspection') {
      navigate(`/network-devices?deviceId=${item.device_id}`);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-400" />
              巡检中心
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              统一查看所有设备的巡检结果与 AI 分析记录
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-surface/60 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-bold text-text-primary">{items.length}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">总记录</p>
          </div>
          <div className="bg-surface/60 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-bold text-text-primary">{items.filter(i => i.source === 'inspection').length}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">巡检次数</p>
          </div>
          <div className="bg-surface/60 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              <span className="text-2xl font-bold text-text-primary">{items.filter(i => i.source === 'analysis').length}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">AI 分析次数</p>
          </div>
          <div className="bg-surface/60 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              <span className="text-2xl font-bold text-text-primary">{(counts as any)?.remediations?.total || 0}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">修复执行</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索设备名称 / IP / 摘要..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-secondary/50"
            />
          </div>

          <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
            {([
              { key: 'all' as const, label: '全部', icon: Activity },
              { key: 'inspection' as const, label: '巡检', icon: Wifi },
              { key: 'analysis' as const, label: 'AI 分析', icon: Zap },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
                  filter === key ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowTrends(!showTrends)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
              showTrends ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-surface border-border text-text-secondary hover:text-text-primary'
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            趋势
          </button>

          {!showTrends && (
            <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
              {([
                { key: 'all' as const, label: '全部设备', icon: Server },
                { key: 'network_device' as const, label: '网络设备', icon: Wifi },
                { key: 'server' as const, label: '服务器', icon: Server },
              ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
                  typeFilter === key ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          )}
        </div>

        {/* Show TrendCharts when active */}
        {showTrends && (
          <div className="bg-surface rounded-xl border border-border p-5">
            <TrendCharts />
          </div>
        )}

        {/* Items */}
        {!showTrends && (
          isLoading ? <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-text-secondary" />
          </div>
        : filtered.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Activity className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无记录</p>
          </div>
        : <div className="space-y-1">
            {filtered.map(item => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="flex items-center gap-4 px-4 py-3 bg-surface/40 border border-border rounded-lg hover:bg-surface/60 hover:border-primary/30 transition-all cursor-pointer"
              >
                {sourceIcon(item.source)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{item.device_name || item.device_ip || '未知设备'}</span>
                    {item.device_ip && <span className="text-xs text-text-secondary">{item.device_ip}</span>}
                    <span className={clsx(
                      'text-xs px-1.5 py-0.5 rounded font-medium',
                      item.source === 'analysis' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                    )}>
                      {sourceLabel(item.source, item.type)}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 truncate">{item.summary || '(无摘要)'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusIcon(item.status)}
                  {item.duration_ms > 0 && (
                    <span className="text-xs text-text-secondary">{(item.duration_ms / 1000).toFixed(1)}s</span>
                  )}
                  <span className="text-xs text-text-secondary">{safeFormatDistance(item.created_at)}</span>
                  <Eye className="w-3.5 h-3.5 text-text-secondary/50" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
