import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Play, Eye, Trash2, AlertTriangle, CheckCircle, Clock, Zap, Lightbulb } from 'lucide-react';
import api from '../../../lib/api';

interface RootCauseAnalysis {
  id: string;
  alert_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms: string[];
  timeline: Array<{ time: string; event: string }>;
  evidence: string[];
  recommendations: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export default function RootCauseAnalysisPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRca, setSelectedRca] = useState<RootCauseAnalysis | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    alert_id: ''
  });

  const { data: rcas, isLoading } = useQuery({
    queryKey: ['rootCauseAnalyses'],
    queryFn: async () => {
      const res = await api.get('/api/root-cause-analysis');
      return res.data.data || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (rca: any) => {
      const res = await api.post('/api/root-cause-analysis', rca);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rootCauseAnalyses'] });
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', alert_id: '' });
    }
  });

  const analyzeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/root-cause-analysis/${id}/analyze`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rootCauseAnalyses'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/root-cause-analysis/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rootCauseAnalyses'] });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'analyzing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'analyzing': return <Zap className="w-4 h-4 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待分析';
      case 'analyzing': return '分析中';
      case 'completed': return '已完成';
      case 'failed': return '分析失败';
      default: return status;
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">故障根因分析</h1>
            <p className="text-text-secondary mt-1">自动分析告警的根本原因，提供解决方案</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建分析
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {rcas?.map((rca: RootCauseAnalysis) => (
              <div key={rca.id} className="bg-surface rounded-xl border border-border p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-text-primary">{rca.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(rca.status)}`}>
                        {getStatusIcon(rca.status)}
                        {getStatusText(rca.status)}
                      </span>
                    </div>
                    {rca.description && (
                      <p className="text-text-secondary text-sm mb-3">{rca.description}</p>
                    )}
                    {rca.status === 'completed' && rca.root_cause && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1">
                          <Lightbulb className="w-4 h-4 text-yellow-600" />
                          根本原因
                        </div>
                        <p className="text-text-secondary text-sm bg-background p-3 rounded-lg">
                          {rca.root_cause}
                        </p>
                      </div>
                    )}
                    <div className="text-xs text-text-secondary">
                      创建于 {new Date(rca.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedRca(rca);
                        setShowDetailModal(true);
                      }}
                      className="p-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-lg"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {rca.status === 'pending' && (
                      <button
                        onClick={() => analyzeMutation.mutate(rca.id)}
                        disabled={analyzeMutation.isPending}
                        className="p-2 text-text-secondary hover:text-primary hover:bg-background rounded-lg disabled:opacity-50"
                        title="开始分析"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(rca.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-text-secondary hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {rcas?.length === 0 && (
              <div className="text-center py-20">
                <Search className="w-16 h-16 text-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">暂无根因分析</h3>
                <p className="text-text-secondary mb-6">创建一个新的根因分析来开始</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  创建第一个分析
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 创建分析模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-text-primary mb-4">创建根因分析</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">标题</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary"
                  placeholder="输入分析标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">描述（可选）</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary"
                  rows={3}
                  placeholder="描述要分析的问题"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary"
                >
                  取消
                </button>
                <button
                  onClick={() => createMutation.mutate(createForm)}
                  disabled={!createForm.title || createMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {createMutation.isPending ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 详情模态框 */}
      {showDetailModal && selectedRca && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-surface rounded-xl p-6 w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary">根因分析详情</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{selectedRca.title}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${getStatusColor(selectedRca.status)}`}>
                  {getStatusIcon(selectedRca.status)}
                  {getStatusText(selectedRca.status)}
                </span>
              </div>

              {selectedRca.description && (
                <div>
                  <h4 className="font-medium text-text-primary mb-2">问题描述</h4>
                  <p className="text-text-secondary">{selectedRca.description}</p>
                </div>
              )}

              {selectedRca.status === 'completed' && (
                <>
                  {selectedRca.root_cause && (
                    <div>
                      <h4 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-yellow-600" />
                        根本原因
                      </h4>
                      <p className="text-text-secondary bg-background p-4 rounded-lg">{selectedRca.root_cause}</p>
                    </div>
                  )}

                  {selectedRca.symptoms?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">观察到的症状</h4>
                      <ul className="list-disc list-inside text-text-secondary space-y-1">
                        {selectedRca.symptoms.map((symptom, idx) => (
                          <li key={idx}>{symptom}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedRca.timeline?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">时间线</h4>
                      <div className="space-y-2">
                        {selectedRca.timeline.map((item, idx) => (
                          <div key={idx} className="flex gap-3">
                            <span className="text-text-secondary text-sm whitespace-nowrap">{item.time}</span>
                            <span className="text-text-primary">{item.event}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRca.evidence?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">分析证据</h4>
                      <ul className="list-disc list-inside text-text-secondary space-y-1">
                        {selectedRca.evidence.map((evidence, idx) => (
                          <li key={idx}>{evidence}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedRca.recommendations?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-text-primary mb-2">修复建议</h4>
                      <ul className="list-disc list-inside text-text-secondary space-y-1">
                        {selectedRca.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {selectedRca.status === 'pending' && (
                <div className="text-center py-6">
                  <button
                    onClick={() => {
                      analyzeMutation.mutate(selectedRca.id);
                    }}
                    disabled={analyzeMutation.isPending}
                    className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {analyzeMutation.isPending ? '分析中...' : '开始分析'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
