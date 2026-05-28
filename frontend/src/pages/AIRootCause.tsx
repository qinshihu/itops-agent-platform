import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Zap, CheckCircle, XCircle, Eye, Play, Flag, Clock, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';

interface RCAItem {
  id: string;
  alert_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms?: string[];
  timeline?: Array<{ time: string; event: string }>;
  evidence?: string[];
  recommendations?: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface RCAStats {
  todayCount: number;
  avgConfidence: number;
  autoRemediations: number;
  falsePositives: number;
  totalCompleted: number;
}

export default function AIRootCause() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.post(`/api/root-cause-analysis/auto-analyze/${alertId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['root-cause-analysis'] });
    }
  });

  const handleNewAnalysis = () => {
    const alertId = prompt('请输入告警 ID 以触发根因分析：');
    if (alertId && alertId.trim()) {
      analyzeMutation.mutate(alertId.trim());
    }
  };

  const { data: rcaItems, isLoading } = useQuery({
    queryKey: ['root-cause-analysis'],
    queryFn: async () => {
      const res = await api.get('/api/root-cause-analysis');
      return res.data.data as RCAItem[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['root-cause-analysis', 'stats'],
    queryFn: async () => {
      const res = await api.get('/api/root-cause-analysis/stats');
      return res.data.data as RCAStats;
    },
  });

  const statusLabels: Record<string, string> = {
    pending: '待分析',
    analyzing: '分析中',
    completed: '已完成',
    failed: '分析失败'
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    analyzing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700'
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Search className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-text-primary">AI 智能根因分析</h1>
              <p className="text-text-secondary text-sm mt-0.5">基于 AI 的自动化根因定位与分析</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-lg flex items-center gap-2 text-sm transition-colors">
              <Clock className="w-4 h-4" />
              历史
            </button>
            <button onClick={handleNewAnalysis} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors">
              <Zap className="w-4 h-4" />
              新建分析
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">今日分析</span>
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div className="text-2xl font-bold text-text-primary">{stats.todayCount}</div>
              <div className="text-xs text-text-secondary mt-1">总计完成 {stats.totalCompleted}</div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">平均置信度</span>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">{Math.round(stats.avgConfidence * 100)}%</div>
              <div className="text-xs text-text-secondary mt-1">LLM分析准确率</div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">自动修复</span>
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-text-primary">{stats.autoRemediations}</div>
              <div className="text-xs text-text-secondary mt-1">可自动执行方案</div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">误报数</span>
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-text-primary">{stats.falsePositives}</div>
              <div className="text-xs text-text-secondary mt-1">标记为误报</div>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {rcaItems?.map((item) => (
            <div key={item.id} className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-semibold text-text-primary truncate">{item.title}</h3>
                    <span className={clsx(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium',
                      statusColors[item.status] || 'bg-gray-100 text-gray-700'
                    )}>
                      {statusLabels[item.status]}
                    </span>
                  </div>

                  <p className="text-text-secondary text-sm mb-3 line-clamp-2">{item.root_cause || item.description || '暂无分析结果'}</p>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <AlertTriangle className="w-4 h-4" />
                      <span>症状: {(item.symptoms || []).length} 个</span>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <BarChart3 className="w-4 h-4" />
                      <span>建议: {(item.recommendations || []).length} 个</span>
                    </div>
                    <div className="text-text-secondary">
                      {new Date(item.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => navigate(`/ai-root-cause/${item.id}`)}
                    className="p-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-lg transition-colors"
                    title="查看详情"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {item.status === 'completed' && (
                    <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="执行修复">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="标记误报">
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {rcaItems?.length === 0 && (
            <div className="text-center py-20 bg-surface rounded-xl border border-border">
              <Search className="w-16 h-16 text-text-secondary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">暂无根因分析记录</h3>
              <p className="text-text-secondary mb-6">创建一个新的 AI 根因分析来开始</p>
              <button onClick={handleNewAnalysis} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                创建第一个分析
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
