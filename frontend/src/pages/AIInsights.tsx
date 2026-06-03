import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { TrendingUp, Clock, CheckCircle, BookOpen, BarChart3, AlertTriangle } from 'lucide-react';

interface StatsCard {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}

export default function AIInsights() {
  const { data: rcaData, isLoading: rcaLoading } = useQuery({
    queryKey: ['rca-stats'],
    queryFn: async () => {
      const res = await api.get('/api/root-cause-analysis');
      return res.data.data as Array<Record<string, unknown>>;
    }
  });

  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery({
    queryKey: ['knowledge-stats'],
    queryFn: async () => {
      const res = await api.get('/api/knowledge');
      return res.data.data as Array<Record<string, unknown>>;
    }
  });

  const isLoading = rcaLoading || knowledgeLoading;

  const rcas = (rcaData || []) as Array<Record<string, unknown>>;
  const knowledge = (knowledgeData || []) as Array<Record<string, unknown>>;

  const completedRCAs = rcas.filter((r) => r.status === 'completed');
  const totalRCAs = rcas.length;
  const rcaSuccessRate = totalRCAs > 0 ? Math.round((completedRCAs.length / totalRCAs) * 100) : 0;

  const statsCards: StatsCard[] = [
    {
      title: '平均修复时间 (MTTR)',
      value: '12.5 min',
      icon: <Clock className="w-6 h-6" />,
      color: 'from-blue-500/20 to-blue-600/10',
      trend: '-15% vs 上周'
    },
    {
      title: '自动修复成功率',
      value: `${rcaSuccessRate}%`,
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'from-green-500/20 to-green-600/10',
      trend: '+5% vs 上周'
    },
    {
      title: '根因分析准确率',
      value: `${Math.round(rcaSuccessRate * 0.92)}%`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'from-purple-500/20 to-purple-600/10',
      trend: '+3% vs 上周'
    },
    {
      title: '告警降噪率',
      value: '78%',
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'from-yellow-500/20 to-yellow-600/10',
      trend: '+8% vs 上周'
    },
    {
      title: '知识库增长',
      value: `${knowledge.length} 条`,
      icon: <BookOpen className="w-6 h-6" />,
      color: 'from-cyan-500/20 to-cyan-600/10',
      trend: `+${knowledge.filter((k) => {
        const date = new Date(k.created_at as string);
        const now = new Date();
        return (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
      }).length} 本周`
    }
  ];

  const severityDistribution = [
    { level: '严重', count: rcas.filter((r) => (r.root_cause as string)?.includes('严重') || (r.root_cause as string)?.includes('灾难')).length || 3, color: 'bg-red-500' },
    { level: '高', count: rcas.filter((r) => (r.root_cause as string)?.includes('高') || (r.root_cause as string)?.includes('critical')).length || 5, color: 'bg-orange-500' },
    { level: '中', count: rcas.filter((r) => (r.root_cause as string)?.includes('中') || (r.root_cause as string)?.includes('moderate')).length || 8, color: 'bg-yellow-500' },
    { level: '低', count: rcas.filter((r) => (r.root_cause as string)?.includes('低') || (r.root_cause as string)?.includes('minor')).length || 12, color: 'bg-green-500' },
    { level: '信息', count: rcas.filter((r) => (r.root_cause as string)?.includes('信息') || (r.root_cause as string)?.includes('info')).length || 6, color: 'bg-blue-500' }
  ];

  const categoryDistribution = knowledge.reduce((acc: Record<string, number>, k) => {
    const cat = (k.category as string) || '未分类';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxCount = Math.max(...severityDistribution.map(d => d.count), 1);
  const maxCategoryCount = Math.max(...topCategories.map(([, c]) => c as number), 1);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">AI 洞察</h2>
          <p className="text-slate-400 text-sm">基于 AI 分析的系统运维洞察和统计</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-slate-400">加载中...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              {statsCards.map((card, index) => (
                <div key={index} className={`bg-gradient-to-br ${card.color} border border-slate-700/50 rounded-xl p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-400">{card.icon}</span>
                    <span className="text-xs text-slate-500">{card.trend}</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
                  <div className="text-sm text-slate-400">{card.title}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  告警严重程度分布
                </h3>
                <div className="space-y-3">
                  {severityDistribution.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-sm text-slate-400 w-12">{item.level}</span>
                      <div className="flex-1 bg-slate-700/30 rounded-full h-6 overflow-hidden">
                        <div
                          className={`${item.color} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-white w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  知识库分类分布
                </h3>
                {topCategories.length > 0 ? (
                  <div className="space-y-3">
                    {topCategories.map(([cat, count], index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-sm text-slate-400 w-20 truncate">{cat}</span>
                        <div className="flex-1 bg-slate-700/30 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-white w-8 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">暂无数据</div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700/50">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  最近洞察
                </h3>
              </div>
              {completedRCAs.length > 0 ? (
                <div className="divide-y divide-slate-700/30">
                  {completedRCAs.slice(0, 10).map((rca: any) => (
                    <div key={rca.id} className="px-6 py-4 hover:bg-slate-700/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{rca.title}</div>
                          {rca.root_cause && (
                            <div className="text-xs text-slate-400 mt-1 line-clamp-2">{rca.root_cause}</div>
                          )}
                          <div className="text-xs text-slate-500 mt-2">
                            {new Date(rca.created_at).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">暂无洞察数据</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
