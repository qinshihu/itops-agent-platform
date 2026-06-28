import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, CheckCircle, XCircle, Clock, AlertCircle, Check, X } from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

interface ApprovalRequest {
  id: string;
  task_id: string;
  node_id: string;
  node_label: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  reject_reason?: string;
  timeout_at?: string;
  timeout_action: 'reject' | 'wait';
  created_at: string;
  updated_at: string;
}

export default function Approvals() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [rejectModal, setRejectModal] = useState<{ open: boolean; approvalId: string | null }>({
    open: false,
    approvalId: null,
  });
  const [rejectReason, setRejectReason] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['approvals', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await api.get(`/api/approvals${params}`);
      return res.data.data as ApprovalRequest[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      await api.post(`/api/approvals/${approvalId}/approve`, { comment: '审批通过' });
    },
    onSuccess: () => {
      toast.success('审批已通过');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: () => {
      toast.error('审批失败');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ approvalId, reason }: { approvalId: string; reason: string }) => {
      await api.post(`/api/approvals/${approvalId}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success('审批已拒绝');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setRejectModal({ open: false, approvalId: null });
      setRejectReason('');
    },
    onError: () => {
      toast.error('拒绝失败');
    },
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', label: '待审批' },
      approved: { icon: CheckCircle, color: 'bg-green-500/10 text-green-500 border-green-500/30', label: '已通过' },
      rejected: { icon: XCircle, color: 'bg-red-500/10 text-red-500 border-red-500/30', label: '已拒绝' },
      timeout: { icon: AlertCircle, color: 'bg-gray-500/10 text-gray-500 border-gray-500/30', label: '已超时' },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">审批中心</h1>
            <p className="text-sm text-text-secondary">管理工作流审批请求</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { key: 'pending', label: '待审批' },
          { key: 'approved', label: '已通过' },
          { key: 'rejected', label: '已拒绝' },
          { key: 'all', label: '全部' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              filter === tab.key
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Approval List */}
      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">加载中...</div>
      ) : !approvals || approvals.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无审批记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="bg-surface border border-border rounded-lg p-4 hover:border-orange-500/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-text-primary truncate">
                      {approval.node_label}
                    </h3>
                    {getStatusBadge(approval.status)}
                  </div>
                  <p className="text-sm text-text-secondary mb-2">{approval.description}</p>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span>任务ID: {approval.task_id.slice(0, 8)}...</span>
                    <span>发起人: {approval.requested_by || '系统'}</span>
                    <span>发起时间: {formatTime(approval.created_at)}</span>
                    {approval.timeout_at && approval.status === 'pending' && (
                      <span className="text-yellow-500">
                        超时: {formatTime(approval.timeout_at)}
                      </span>
                    )}
                  </div>
                  {approval.approved_by && (
                    <div className="mt-2 text-xs text-text-secondary">
                      {approval.status === 'approved' ? (
                        <span className="text-green-500">
                          ✓ 由 {approval.approved_by} 于 {formatTime(approval.approved_at!)} 通过
                        </span>
                      ) : approval.status === 'rejected' ? (
                        <span className="text-red-500">
                          ✗ 由 {approval.approved_by} 于 {formatTime(approval.approved_at!)} 拒绝
                          {approval.reject_reason && `: ${approval.reject_reason}`}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                {approval.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveMutation.mutate(approval.id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      通过
                    </button>
                    <button
                      onClick={() => setRejectModal({ open: true, approvalId: approval.id })}
                      disabled={rejectMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      拒绝
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-lg font-semibold text-text-primary">拒绝审批</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-red-500 focus:outline-none resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setRejectModal({ open: false, approvalId: null });
                  setRejectReason('');
                }}
                className="px-4 py-2 text-text-secondary hover:bg-background rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (rejectModal.approvalId && rejectReason.trim()) {
                    rejectMutation.mutate({
                      approvalId: rejectModal.approvalId,
                      reason: rejectReason,
                    });
                  }
                }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
