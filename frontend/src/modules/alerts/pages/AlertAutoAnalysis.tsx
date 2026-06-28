import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Server, Wifi, Search, Loader2, AlertCircle, CheckCircle2, Clock, ExternalLink, ChevronDown, ChevronRight, Terminal, Cpu, HardDrive, Radio, Zap } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { safeFormatDistance } from '../../../lib/date';

interface AutoAnalysisResult {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: 'network_device' | 'server';
  status: 'pending' | 'running' | 'completed' | 'failed';
  diagnosis: string;
  summary: string;
  raw_output: string;
  commands_executed: string;
  error_message?: string;
  duration_ms: number;
  created_at: string;
}

function AnalysisCard({ item, navigate, highlightId }: { item: AutoAnalysisResult; navigate: (path: string) => void; highlightId?: string | null }) {
  const [expanded, setExpanded] = useState(highlightId === item.alert_id || highlightId === item.device_id);

  const statusBadge = (() => {
    switch (item.status) {
      case 'completed':
        return <span className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> 完成</span>;
      case 'running':
        return <span className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full"><Loader2 className="w-3 h-3 animate-spin" /> 分析中</span>;
      case 'failed':
        return <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> 失败</span>;
      default:
        return <span className="flex items-center gap-1 text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> 等待中</span>;
    }
  })();

  const typeIcon = item.device_type === 'network_device'
    ? <Wifi className="w-4 h-4 text-purple-400" />
    : <Server className="w-4 h-4 text-blue-400" />;

  return (
    <div className="bg-surface/60 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-text-secondary" /> : <ChevronRight className="w-4 h-4 shrink-0 text-text-secondary" />}
          {typeIcon}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-primary text-sm truncate">{item.device_name}</span>
              <span className="text-xs text-text-secondary">{item.device_ip}</span>
              <span className={clsx(
                'text-xs px-1.5 py-0.5 rounded',
                item.device_type === 'network_device' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
              )}>
                {item.device_type === 'network_device' ? '网络设备' : '服务器'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(item.device_type === 'network_device' ? `/network-devices` : `/servers`); }}
                className="text-xs text-text-secondary hover:text-primary underline underline-offset-2"
              >
                查看设备
              </button>
              {item.alert_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/alerts?alertId=${item.alert_id}`); }}
                  className="text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2"
                >
                  查看告警
                </button>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-0.5 truncate">{item.summary || item.error_message || '暂无摘要'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge}
          <span className="text-xs text-text-secondary whitespace-nowrap">{safeFormatDistance(item.created_at)}</span>
          {item.duration_ms > 0 && (
            <span className="text-xs text-text-secondary whitespace-nowrap">{(item.duration_ms / 1000).toFixed(1)}s</span>
          )}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Diagnosis */}
          {item.diagnosis && (
            <div>
              <h4 className="text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> AI 诊断结论
              </h4>
              <div className="text-sm text-text-primary whitespace-pre-wrap bg-surface/40 rounded p-3 border border-border/50 leading-relaxed">
                {item.diagnosis}
              </div>
            </div>
          )}

          {/* Commands Executed */}
          {item.commands_executed && (() => {
            let cmds: string[];
            try { cmds = JSON.parse(item.commands_executed); } catch { cmds = [item.commands_executed]; }
            if (!cmds.length) return null;
            return (
              <div>
                <h4 className="text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> 已执行命令 ({cmds.length} 条)
                </h4>
                <div className="flex flex-wrap gap-1">
                  {cmds.map((cmd, i) => (
                    <span key={i} className="text-xs bg-surface/30 text-text-secondary px-2 py-0.5 rounded border border-border/30 font-mono">
                      {cmd}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Raw Output (collapsible) */}
          {item.raw_output && (
            <details className="group">
              <summary className="text-xs font-medium text-text-secondary cursor-pointer hover:text-text-primary transition-colors flex items-center gap-1">
                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" /> 查看原始输出
              </summary>
              <pre className="mt-2 text-xs text-text-secondary bg-surface/30 rounded p-3 border border-border/50 overflow-x-auto max-h-96 whitespace-pre-wrap font-mono leading-relaxed">
                {item.raw_output.substring(0, 5000)}
                {item.raw_output.length > 5000 && '\n\n... (输出截断)'}
              </pre>
            </details>
          )}

          {/* Error */}
          {item.error_message && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded p-3 border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{item.error_message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertAutoAnalysis() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('alertId') || searchParams.get('deviceId') || '');
  const [typeFilter, setTypeFilter] = useState<'all' | 'network_device' | 'server'>('all');

  // 如果 URL 带 alertId 或 deviceId，自动展开对应卡片
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const alertId = searchParams.get('alertId');
    const deviceId = searchParams.get('deviceId');
    if (alertId) setHighlightId(alertId);
    else if (deviceId) setHighlightId(deviceId);
  }, []);

  const { data: analyses = [], isLoading, refetch } = useQuery({
    queryKey: ['alert-auto-analysis'],
    queryFn: () => api.get('/api/alert-auto-analysis?limit=100').then(r => r.data.data || []),
    refetchInterval: 15000,
  });

  const filtered = (analyses as AutoAnalysisResult[]).filter(item => {
    if (typeFilter !== 'all' && item.device_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.device_name.toLowerCase().includes(q)
        || item.device_ip.toLowerCase().includes(q)
        || item.summary?.toLowerCase().includes(q)
        || item.diagnosis?.toLowerCase().includes(q);
    }
    return true;
  });

  const countByType = (type: 'network_device' | 'server') =>
    (analyses as AutoAnalysisResult[]).filter(a => a.device_type === type).length;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-400" />
              AI 自动分析
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              告警触发后的自动化 AI 诊断分析，按设备类型分类
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface border border-border rounded-lg hover:bg-surface/80 transition-colors text-text-primary"
          >
            <Loader2 className="w-4 h-4" />
            刷新
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface/60 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span className="text-2xl font-bold text-text-primary">{(analyses as AutoAnalysisResult[]).length}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">总分析次数</p>
          </div>
          <div className="bg-surface/60 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-bold text-text-primary">{countByType('server')}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">服务器分析</p>
          </div>
          <div className="bg-surface/60 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-purple-400" />
              <span className="text-2xl font-bold text-text-primary">{countByType('network_device')}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">网络设备分析</p>
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
              placeholder="搜索设备名称 / IP / 诊断摘要..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-secondary/50"
            />
          </div>

          <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
            {([
              { key: 'all', label: '全部', icon: Activity },
              { key: 'server' as const, label: '服务器', icon: Server },
              { key: 'network_device' as const, label: '网络设备', icon: Wifi },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
                  typeFilter === key
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-text-secondary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Activity className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无自动分析记录</p>
            <p className="text-xs mt-1 opacity-60">告警触发后会自动进行分析</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <AnalysisCard key={item.id} item={item} navigate={navigate} highlightId={highlightId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
