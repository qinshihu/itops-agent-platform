import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, Clock, AlertTriangle, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';

interface TimelineEvent {
  time: string;
  event: string;
}

interface RCADetail {
  id: string;
  alert_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms: string[];
  timeline: TimelineEvent[];
  evidence: string[];
  recommendations: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  analyzing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  pending: '待分析',
  analyzing: '分析中',
  completed: '已完成',
  failed: '分析失败',
};

export default function RCADetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['root-cause-analysis', id],
    queryFn: async () => {
      const res = await api.get(`/api/root-cause-analysis/${id}`);
      return res.data.data as RCADetail;
    },
    enabled: !!id,
  });

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : detail ? (
          <div className="grid gap-6">
            <div className="bg-surface rounded-xl border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-text-primary">{detail.title}</h1>
                    <span className={clsx(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium',
                      statusColors[detail.status]
                    )}>
                      {statusLabels[detail.status]}
                    </span>
                  </div>
                  {detail.description && <p className="text-text-secondary">{detail.description}</p>}
                </div>
                <div className="text-right">
                  <div className="text-sm text-text-secondary mb-1">症状数</div>
                  <div className="text-3xl font-bold text-primary">{detail.symptoms.length}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                    <Search className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">证据数</div>
                    <div className="font-medium text-text-primary">{detail.evidence.length} 个</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">建议数</div>
                    <div className="font-medium text-text-primary">{detail.recommendations.length} 条</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                    <Clock className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">创建时间</div>
                    <div className="font-medium text-text-primary">
                      {new Date(detail.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {detail.symptoms.length > 0 && (
              <div className="bg-surface rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  故障症状
                </h2>
                <div className="space-y-2">
                  {detail.symptoms.map((symptom, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-background rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      <span className="text-sm text-text-primary">{symptom}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.evidence.length > 0 && (
              <div className="bg-surface rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-600" />
                  分析证据
                </h2>
                <div className="space-y-2">
                  {detail.evidence.map((ev, idx) => (
                    <div key={idx} className="p-3 bg-background rounded-lg text-sm text-text-primary font-mono">
                      {ev}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.timeline?.length > 0 && (
              <div className="bg-surface rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  事件时间线
                </h2>
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border"></div>
                  <div className="space-y-6">
                    {detail.timeline.map((event, idx) => (
                      <div key={idx} className="relative pl-10">
                        <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-primary"></div>
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm text-text-secondary whitespace-nowrap">
                            {event.time}
                          </span>
                          <span className="text-sm text-text-primary">{event.event}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {detail.recommendations?.length > 0 && (
              <div className="bg-surface rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  修复建议
                </h2>
                <div className="space-y-3">
                  {detail.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-4 bg-background rounded-lg">
                      <p className="text-sm text-text-primary">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.root_cause && (
              <div className="bg-surface rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  根因分析
                </h2>
                <div className="bg-background rounded-lg p-4 text-text-primary text-sm leading-relaxed">
                  {detail.root_cause}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 bg-surface rounded-xl border border-border">
            <Search className="w-16 h-16 text-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">未找到分析记录</h3>
            <p className="text-text-secondary">该分析记录可能已被删除</p>
          </div>
        )}
      </div>
    </div>
  );
}
