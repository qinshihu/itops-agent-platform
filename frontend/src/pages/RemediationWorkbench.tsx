import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { 
  CheckCircle, 
  XCircle, 
  Play,
  RefreshCw,
  Clock,
  AlertTriangle,
  Eye,
  RotateCcw,
  Shield
} from 'lucide-react';

export default function RemediationWorkbench() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['remediation-audits', page],
    queryFn: async () => {
      const res = await api.get('/api/remediation-audits', {
        params: { page: String(page), limit: String(limit) }
      });
      return res.data.data;
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await api.post(`/api/remediation-audits/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-audits'] });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      await api.post(`/api/remediation-audits/${id}/approve`, { action: 'reject', comment: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-audits'] });
    }
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/remediation-audits/${id}/execute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-audits'] });
    }
  });

  const rollbackMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/remediation-audits/${id}/rollback`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-audits'] });
    }
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/remediation-audits/${id}/verify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-audits'] });
    }
  });

  const { data: auditDetail } = useQuery({
    queryKey: ['remediation-audit-detail', selectedAuditId],
    queryFn: async () => {
      if (!selectedAuditId) return null;
      const res = await api.get(`/api/remediation-audits/${selectedAuditId}`);
      return res.data.data;
    },
    enabled: !!selectedAuditId
  });

  const handleViewDetail = (id: string) => {
    setSelectedAuditId(id);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedAuditId(null);
  };

  const getStatusIcon = (status: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'pending': <Clock className="w-4 h-4 text-blue-500" />,
      'approved': <CheckCircle className="w-4 h-4 text-green-500" />,
      'rejected': <XCircle className="w-4 h-4 text-red-500" />,
      'executing': <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
      'success': <CheckCircle className="w-4 h-4 text-green-500" />,
      'failed': <XCircle className="w-4 h-4 text-red-500" />
    };
    return iconMap[status] || <Clock className="w-4 h-4 text-slate-500" />;
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      'pending': '待审批',
      'approved': '已批准',
      'rejected': '已拒绝',
      'executing': '执行中',
      'success': '成功',
      'failed': '失败'
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'approved': 'bg-green-500/10 text-green-400 border-green-500/20',
      'rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
      'executing': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'success': 'bg-green-500/10 text-green-400 border-green-500/20',
      'failed': 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return map[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  const getRiskLevelColor = (level: string) => {
    const map: Record<string, string> = {
      'low': 'bg-green-500/10 text-green-400',
      'medium': 'bg-yellow-500/10 text-yellow-400',
      'high': 'bg-red-500/10 text-red-400'
    };
    return map[level] || 'bg-slate-500/10 text-slate-400';
  };

  const getRiskLevelText = (level: string) => {
    const map: Record<string, string> = {
      'low': '低',
      'medium': '中',
      'high': '高'
    };
    return map[level] || level;
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const pendingAudits = data?.audits?.filter((a: any) => a.status === 'pending') || [];
  const recentExecutions = data?.audits?.filter((a: any) => a.status !== 'pending') || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">自愈工作台</h2>
            <p className="text-slate-400 text-sm">管理自愈策略的审批和执行</p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['remediation-audits'] })}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>

        {pendingAudits.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              待审批项
              <span className="ml-auto text-sm font-normal text-slate-400">{pendingAudits.length} 项</span>
            </h3>
            <div className="grid gap-4">
              {pendingAudits.map((audit: any) => (
                <div key={audit.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(audit.risk_level)}`}>
                          {getRiskLevelText(audit.risk_level)}风险
                        </span>
                        <span className="text-sm text-slate-300">{audit.rca_title || audit.rca_id?.slice(0, 8)}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        策略: {audit.policy_name || audit.policy_id?.slice(0, 8)} | 
                        创建时间: {formatTime(audit.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => approveMutation.mutate({ id: audit.id })}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        批准
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ id: audit.id })}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        拒绝
                      </button>
                      <button
                        onClick={() => executeMutation.mutate(audit.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        执行
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-slate-400" />
            最近执行记录
          </h3>

          {isLoading ? (
            <div className="text-center py-12 text-slate-400">加载中...</div>
          ) : !data?.audits?.length ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">暂无记录</p>
            </div>
          ) : (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">创建时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">根因分析</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">策略</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">风险等级</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">状态</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audits.map((audit: any) => (
                    <tr key={audit.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="py-3 px-4 text-sm text-white">{formatTime(audit.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-300">{audit.rca_title || audit.rca_id?.slice(0, 8)}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-300">{audit.policy_name || audit.policy_id?.slice(0, 8)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(audit.risk_level)}`}>
                          {getRiskLevelText(audit.risk_level)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(audit.status)}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(audit.status)}`}>
                            {getStatusText(audit.status)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewDetail(audit.id)}
                            className="p-1.5 text-slate-400 hover:text-white transition-colors"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(audit.status === 'success' || audit.status === 'failed') && !audit.is_rollback && (
                            <button
                              onClick={() => {
                                if (window.confirm(`确认要回滚此自愈操作吗？`)) {
                                  rollbackMutation.mutate(audit.id);
                                }
                              }}
                              disabled={rollbackMutation.isPending}
                              className="p-1.5 text-yellow-400 hover:text-yellow-300 transition-colors disabled:opacity-50"
                              title="回滚"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {(audit.status === 'success' || audit.status === 'completed') && (
                            <button
                              onClick={() => verifyMutation.mutate(audit.id)}
                              disabled={verifyMutation.isPending}
                              className="p-1.5 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                              title="验证效果"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.total > limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-slate-400">共 {data.total} 条记录</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/50 transition-colors"
                >
                  上一页
                </button>
                <span className="text-slate-400 text-sm">{page}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white hover:bg-slate-700/50 transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDetailModal && auditDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <h3 className="text-lg font-semibold text-white">审计详情</h3>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700/50"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-slate-900/50 rounded-lg p-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">根因分析</div>
                  <div className="text-sm text-white">{auditDetail.rca_title || auditDetail.rca_id?.slice(0, 8)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">策略</div>
                  <div className="text-sm text-white">{auditDetail.policy_name || auditDetail.policy_id?.slice(0, 8)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">风险等级</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(auditDetail.risk_level)}`}>
                    {getRiskLevelText(auditDetail.risk_level)}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">状态</div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(auditDetail.status)}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(auditDetail.status)}`}>
                      {getStatusText(auditDetail.status)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">创建时间</div>
                  <div className="text-sm text-white">{formatTime(auditDetail.created_at)}</div>
                </div>
                {auditDetail.approved_at && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">审批时间</div>
                    <div className="text-sm text-white">{formatTime(auditDetail.approved_at)}</div>
                  </div>
                )}
              </div>

              {auditDetail.recommendations && (
                <div>
                  <div className="text-xs text-slate-500 mb-2">建议措施</div>
                  <div className="bg-slate-900/50 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap">
                    {typeof auditDetail.recommendations === 'string'
                      ? auditDetail.recommendations
                      : JSON.stringify(auditDetail.recommendations, null, 2)}
                  </div>
                </div>
              )}

              {auditDetail.execution_log && (
                <div>
                  <div className="text-xs text-slate-500 mb-2">执行日志</div>
                  <pre className="bg-slate-900/50 rounded-lg p-4 text-xs text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                    {typeof auditDetail.execution_log === 'string'
                      ? auditDetail.execution_log
                      : JSON.stringify(auditDetail.execution_log, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-700/50 flex justify-between">
              <div className="flex gap-2">
                {(auditDetail.status === 'success' || auditDetail.status === 'failed') && !auditDetail.is_rollback && (
                  <button
                    onClick={() => {
                      if (window.confirm('确认要回滚此自愈操作吗？')) {
                        rollbackMutation.mutate(auditDetail.id);
                      }
                    }}
                    disabled={rollbackMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {rollbackMutation.isPending ? '回滚中...' : '回滚'}
                  </button>
                )}
                {(auditDetail.status === 'success' || auditDetail.status === 'completed') && (
                  <button
                    onClick={() => {
                      verifyMutation.mutate(auditDetail.id);
                    }}
                    disabled={verifyMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Shield className="w-4 h-4" />
                    {verifyMutation.isPending ? '验证中...' : '验证效果'}
                  </button>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
