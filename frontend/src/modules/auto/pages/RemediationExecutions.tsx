import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  RefreshCw,
  Filter,
  Eye,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FileText,
  CheckSquare,
  ArrowLeftRight
} from 'lucide-react';

export default function RemediationExecutions() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['remediation-executions', statusFilter, page],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await api.get('/api/remediation-executions', { params });
      return res.data.data;
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      await api.post(`/api/remediation-executions/${id}/approve`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-executions'] });
    }
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/remediation-executions/${id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-executions'] });
    }
  });

  const { data: executionDetail } = useQuery({
    queryKey: ['remediation-execution-detail', selectedExecutionId],
    queryFn: async () => {
      if (!selectedExecutionId) return null;
      const res = await api.get(`/api/remediation-executions/${selectedExecutionId}`);
      return res.data.data;
    },
    enabled: !!selectedExecutionId
  });

  const handleViewDetail = useCallback((id: string) => {
    setSelectedExecutionId(id);
    setShowDetailModal(true);
    setExpandedLogs({});
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowDetailModal(false);
    setSelectedExecutionId(null);
  }, []);

  const toggleLog = useCallback((key: string) => {
    setExpandedLogs(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDetailModal) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDetailModal, handleCloseModal]);

  const getStatusIcon = (status: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'success': <CheckCircle className="w-4 h-4 text-green-500" />,
      'failed': <XCircle className="w-4 h-4 text-red-500" />,
      'rolled_back': <RefreshCw className="w-4 h-4 text-yellow-500" />,
      'waiting_approval': <Clock className="w-4 h-4 text-blue-500" />,
      'running': <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
      'skipped': <AlertTriangle className="w-4 h-4 text-text-tertiary" />,
      'rejected': <XCircle className="w-4 h-4 text-orange-500" />
    };
    return iconMap[status] || <Clock className="w-4 h-4 text-text-tertiary" />;
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      'pending': '待处理',
      'checking': '检查中',
      'waiting_approval': '待审批',
      'approved': '已批准',
      'rejected': '已拒绝',
      'running': '执行中',
      'verifying': '验证中',
      'success': '成功',
      'failed': '失败',
      'rolled_back': '已回滚',
      'skipped': '已跳过'
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'success': 'bg-green-500/10 text-green-400 border-green-500/20',
      'failed': 'bg-red-500/10 text-red-400 border-red-500/20',
      'rolled_back': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'waiting_approval': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'running': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'skipped': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      'rejected': 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    };
    return map[status] || 'bg-slate-500/10 text-text-secondary border-slate-500/20';
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-text-primary mb-1">修复执行记录</h2>
          <p className="text-text-secondary text-sm">查看所有自动修复策略的执行历史和结果</p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
              <option value="rolled_back">已回滚</option>
              <option value="waiting_approval">待审批</option>
              <option value="running">执行中</option>
              <option value="skipped">已跳过</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-text-secondary">加载中...</div>
        ) : !data?.executions?.length ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary">暂无执行记录</p>
          </div>
        ) : (
          <div className="bg-surface/30 border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">策略</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">耗时</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">验证</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.executions.map((execution: any) => (
                  <tr key={execution.id} className="border-b border-border/30 hover:bg-slate-700/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="text-sm text-text-primary">{formatTime(execution.created_at)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-text-primary">策略 ID: {execution.policy_id?.slice(0, 8)}...</div>
                      <div className="text-xs text-text-tertiary">告警 ID: {execution.alert_id?.slice(0, 8)}...</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(execution.status)}`}>
                          {getStatusText(execution.status)}
                        </span>
                      </div>
                      {execution.status_reason && (
                        <div className="text-xs text-text-tertiary mt-1">{execution.status_reason}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-primary">
                      {formatDuration(execution.execution_duration_ms)}
                    </td>
                    <td className="py-3 px-4">
                      {execution.verification_status ? (
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.verification_status)}
                          <span className="text-xs text-text-primary">
                            {getStatusText(execution.verification_status)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-tertiary">未验证</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {execution.status === 'waiting_approval' && (
                          <>
                            <button
                              onClick={() => approveMutation.mutate({ id: execution.id, action: 'approve' })}
                              className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition-colors"
                            >
                              批准
                            </button>
                            <button
                              onClick={() => approveMutation.mutate({ id: execution.id, action: 'reject' })}
                              className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
                            >
                              拒绝
                            </button>
                          </>
                        )}
                        {(execution.status === 'failed' || execution.status === 'rejected') && (
                          <button
                            onClick={() => retryMutation.mutate(execution.id)}
                            className="p-1.5 text-text-secondary hover:text-blue-400 transition-colors"
                            title="重试"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                          title="查看详情"
                          onClick={() => handleViewDetail(execution.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
            <div className="text-sm text-text-secondary">共 {data.total} 条记录</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-surface border border-border rounded-lg text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/50 transition-colors"
              >
                上一页
              </button>
              <span className="text-text-secondary text-sm">{page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 bg-surface border border-border rounded-lg text-text-primary hover:bg-slate-700/50 transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {showDetailModal && executionDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-surface border border-border rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <h3 className="text-lg font-semibold text-text-primary">执行详情</h3>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  基本信息
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-surface rounded-lg p-4">
                  <div>
                    <div className="text-xs text-text-tertiary mb-1">策略名称</div>
                    <div className="text-sm text-text-primary">{executionDetail.policy_name || executionDetail.policy_id?.slice(0, 8) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-tertiary mb-1">执行状态</div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(executionDetail.status)}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(executionDetail.status)}`}>
                        {getStatusText(executionDetail.status)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-tertiary mb-1">执行时间</div>
                    <div className="text-sm text-text-primary">{formatTime(executionDetail.created_at)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-tertiary mb-1">耗时</div>
                    <div className="text-sm text-text-primary">{formatDuration(executionDetail.execution_duration_ms)}</div>
                  </div>
                  {executionDetail.status_reason && (
                    <div className="col-span-2">
                      <div className="text-xs text-text-tertiary mb-1">状态原因</div>
                      <div className="text-sm text-text-primary">{executionDetail.status_reason}</div>
                    </div>
                  )}
                </div>
              </div>

              {executionDetail.execution_result && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    执行结果
                  </h4>
                  <div className="bg-surface rounded-lg p-4">
                    <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                      {typeof executionDetail.execution_result === 'string' 
                        ? executionDetail.execution_result 
                        : JSON.stringify(executionDetail.execution_result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {executionDetail.verification_status && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    验证结果
                  </h4>
                  <div className="bg-surface rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {getStatusIcon(executionDetail.verification_status)}
                      <span className="text-sm text-text-primary">
                        验证 {getStatusText(executionDetail.verification_status)}
                      </span>
                    </div>
                    {executionDetail.verification_completed_at && (
                      <div className="text-xs text-text-tertiary mb-2">
                        验证完成时间: {formatTime(executionDetail.verification_completed_at)}
                      </div>
                    )}
                    {executionDetail.verification_result && (
                      <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto bg-surface/50 rounded p-3">
                        {typeof executionDetail.verification_result === 'string'
                          ? executionDetail.verification_result
                          : JSON.stringify(executionDetail.verification_result, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {executionDetail.rollback_triggered === 1 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4" />
                    回滚信息
                  </h4>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-yellow-300">已触发回滚</span>
                    </div>
                    {executionDetail.rollback_completed_at && (
                      <div className="text-xs text-text-secondary mb-2">
                        回滚完成时间: {formatTime(executionDetail.rollback_completed_at)}
                      </div>
                    )}
                    {executionDetail.rollback_result && (
                      <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto bg-surface/50 rounded p-3">
                        {typeof executionDetail.rollback_result === 'string'
                          ? executionDetail.rollback_result
                          : JSON.stringify(executionDetail.rollback_result, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {executionDetail.approval_comment && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    审批信息
                  </h4>
                  <div className="bg-surface rounded-lg p-4">
                    {executionDetail.approved_at && (
                      <div className="text-xs text-text-tertiary mb-2">
                        审批时间: {formatTime(executionDetail.approved_at)}
                      </div>
                    )}
                    <div className="text-sm text-text-primary">{executionDetail.approval_comment}</div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  完整日志
                </h4>
                <div className="bg-surface rounded-lg divide-y divide-slate-700/30">
                  {[
                    { key: 'execution', label: '执行日志', content: executionDetail.execution_result },
                    { key: 'verification', label: '验证日志', content: executionDetail.verification_result },
                    { key: 'rollback', label: '回滚日志', content: executionDetail.rollback_result },
                    { key: 'status_reason', label: '状态说明', content: executionDetail.status_reason }
                  ].filter(item => item.content).map(item => (
                    <div key={item.key} className="py-2">
                      <button
                        onClick={() => toggleLog(item.key)}
                        className="flex items-center justify-between w-full px-4 text-sm text-text-primary hover:text-text-primary transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {expandedLogs[item.key] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          {item.label}
                        </span>
                      </button>
                      {expandedLogs[item.key] && (
                        <div className="px-4 py-2">
                          <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto bg-surface/30 rounded p-3">
                            {typeof item.content === 'string' ? item.content : JSON.stringify(item.content, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border/50 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-slate-700/50 text-text-primary rounded-lg hover:bg-slate-700 transition-colors text-sm"
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
