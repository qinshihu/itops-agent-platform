import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers, AlertCircle, CheckCircle2, Loader2, Search,
  Plus, Link2, Unlink, X, Clock, Eye, ChevronRight,
  Shield, Trash2, Wrench, Bell, ExternalLink, Zap
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import { safeFormatDistance } from '../../../lib/date';

interface CorrelationGroup {
  id: string;
  title: string;
  status: string;
  severity: string;
  alert_count: number;
  device_ids: string;
  root_alert_id?: string;
  auto_detected: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  member_count: number;
}

interface GroupMember {
  id: string;
  group_id: string;
  alert_id: string;
  title?: string;
  content?: string;
  severity?: string;
  source?: string;
  status?: string;
  is_root: number;
  alert_created_at?: string;
}

export default function AlertCorrelationGroups() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showGroupDetail, setShowGroupDetail] = useState(false);

  // 关联组列表
  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['alert-correlation-groups', statusFilter],
    queryFn: () => api.get('/api/alert-correlation/groups', {
      params: { status: statusFilter === 'all' ? undefined : statusFilter, limit: 50 }
    }).then(r => ({ groups: r.data.data as CorrelationGroup[], total: r.data.total as number })),
  });

  const groups = groupsData?.groups || [];
  const total = groupsData?.total || 0;

  // 统计数据
  const { data: stats } = useQuery({
    queryKey: ['alert-correlation-stats'],
    queryFn: () => api.get('/api/alert-correlation/stats').then(r => r.data.data),
  });

  // 选中组详情
  const { data: groupDetail } = useQuery({
    queryKey: ['alert-correlation-group-detail', selectedGroupId],
    queryFn: () => api.get(`/api/alert-correlation/groups/${selectedGroupId}`).then(r => r.data.data),
    enabled: !!selectedGroupId,
  });

  // 解决组
  const resolveGroup = useMutation({
    mutationFn: (groupId: string) => api.post(`/api/alert-correlation/groups/${groupId}/resolve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-correlation-groups'] });
      queryClient.invalidateQueries({ queryKey: ['alert-correlation-stats'] });
      toast.success('关联组已标记为已解决');
    },
  });

  // 删除组
  const deleteGroup = useMutation({
    mutationFn: (groupId: string) => api.delete(`/api/alert-correlation/groups/${groupId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-correlation-groups'] });
      queryClient.invalidateQueries({ queryKey: ['alert-correlation-stats'] });
      setSelectedGroupId(null);
      setShowGroupDetail(false);
      toast.success('关联组已删除');
    },
  });

  // 触发自动关联
  const triggerAuto = useMutation({
    mutationFn: () => api.post('/api/alert-correlation/auto'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['alert-correlation-groups'] });
      queryClient.invalidateQueries({ queryKey: ['alert-correlation-stats'] });
      toast.success(`自动关联完成: ${res.data.data?.grouped || 0} 条告警已分组`);
    },
  });

  const severityColors: Record<string, string> = {
    critical: 'bg-status-failed/10 text-status-failed border-status-failed/30',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };

  const statusLabels: Record<string, string> = {
    open: '待处理',
    resolved: '已解决',
    closed: '已关闭',
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <Layers className="w-7 h-7 text-purple-400" />
              告警关联聚合
            </h1>
            <p className="text-text-secondary">将相关告警自动归组，快速定位故障根因</p>
          </div>
        </div>

        {/* 统计 + 操作 */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: '总关联组', value: stats?.total_groups || 0, color: 'text-blue-400' },
            { label: '待处理', value: stats?.open_groups || 0, color: 'text-status-failed' },
            { label: '已解决', value: stats?.resolved_groups || 0, color: 'text-status-success' },
            { label: '自动发现', value: stats?.auto_detected || 0, color: 'text-purple-400' },
            { label: '平均组大小', value: stats?.avg_group_size || 0, color: 'text-emerald-400' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-surface rounded-xl p-4 border border-border">
              <p className={clsx('text-2xl font-bold', stat.color)}>{stat.value}</p>
              <p className="text-xs text-text-secondary mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* 筛选 + 操作 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {['all', 'open', 'resolved'].map(status => (
              <button key={status}
                onClick={() => setStatusFilter(status)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  statusFilter === status
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    : 'text-text-secondary hover:text-text-primary border border-transparent'
                )}
              >
                {status === 'all' ? '全部' : status === 'open' ? '待处理' : '已解决'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => triggerAuto.mutate()}
              disabled={triggerAuto.isPending}
              className="px-3 py-1.5 text-xs bg-surface border border-border text-text-secondary rounded-lg hover:bg-surface/80 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {triggerAuto.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              立即关联
            </button>
          </div>
        </div>

        {/* 关联组列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Layers className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{statusFilter === 'open' ? '暂无待处理的关联组' : '暂无关联组'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {groups.map((group: CorrelationGroup) => (
              <div key={group.id}
                onClick={() => { setSelectedGroupId(group.id); setShowGroupDetail(true); }}
                className={clsx(
                  'bg-surface rounded-xl border p-4 cursor-pointer transition-all hover:border-purple-400/30',
                  group.status === 'open' ? 'border-border' : 'border-border/50 opacity-75'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      group.status === 'open' ? 'bg-purple-500/10' : 'bg-slate-500/10'
                    )}>
                      {group.auto_detected ? (
                        <Zap className={clsx('w-5 h-5', group.status === 'open' ? 'text-purple-400' : 'text-slate-400')} />
                      ) : (
                        <Link2 className={clsx('w-5 h-5', group.status === 'open' ? 'text-purple-400' : 'text-slate-400')} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-text-primary truncate">{group.title}</p>
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full border',
                          severityColors[group.severity] || 'bg-slate-500/10 text-slate-400'
                        )}>
                          {group.severity}
                        </span>
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full',
                          group.status === 'open' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-emerald-500/10 text-emerald-400'
                        )}>
                          {group.status === 'open' ? '待处理' : '已解决'}
                        </span>
                        {group.auto_detected === 1 && (
                          <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                            自动发现
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          {group.member_count || group.alert_count} 条告警
                        </span>
                        <span>{group.created_at ? new Date(group.created_at).toLocaleString() : ''}</span>
                        {group.device_ids && <span>设备: {group.device_ids}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 详情模态框 */}
      {showGroupDetail && groupDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-medium text-text-primary text-lg">
                <span className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  {groupDetail.group?.title}
                </span>
              </h3>
              <button onClick={() => setShowGroupDetail(false)}
                className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 组信息 */}
              <div className="flex flex-wrap gap-3">
                <span className={clsx(
                  'text-xs px-2.5 py-1 rounded-full border',
                  severityColors[groupDetail.group?.severity] || 'bg-slate-500/10 text-slate-400'
                )}>{groupDetail.group?.severity}</span>
                <span className={clsx(
                  'text-xs px-2.5 py-1 rounded-full',
                  groupDetail.group?.status === 'open' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-emerald-500/10 text-emerald-400'
                )}>{statusLabels[groupDetail.group?.status] || groupDetail.group?.status}</span>
                <span className="text-xs text-text-secondary bg-background px-2.5 py-1 rounded-full">
                  {groupDetail.members?.length || 0} 条告警
                </span>
                {groupDetail.group?.auto_detected === 1 && (
                  <span className="text-xs text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full">自动关联</span>
                )}
                <span className="text-xs text-text-secondary bg-background px-2.5 py-1 rounded-full">
                  创建于 {groupDetail.group?.created_at ? new Date(groupDetail.group.created_at).toLocaleString() : ''}
                </span>
              </div>

              {/* 成员告警列表 */}
              <h4 className="text-sm font-medium text-text-primary mt-4">关联告警</h4>
              <div className="space-y-2">
                {(groupDetail.members || []).map((member: GroupMember) => (
                  <div key={member.id}
                    className={clsx(
                      'p-3 rounded-lg border',
                      member.is_root ? 'bg-purple-500/5 border-purple-500/30' : 'bg-background border-border/50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {member.is_root && (
                          <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                            根因
                          </span>
                        )}
                        <div className={clsx(
                          'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                          severityColors[member.severity || 'low']
                        )}>
                          {member.severity}
                        </div>
                        <p className="text-sm text-text-primary truncate">{member.title}</p>
                      </div>
                      <button
                        onClick={() => navigate(`/alerts?highlight=${member.alert_id}`)}
                        className="flex-shrink-0 p-1 text-text-tertiary hover:text-primary transition-colors"
                        title="查看告警"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {member.content && (
                      <p className="text-xs text-text-secondary mt-1 ml-1 line-clamp-2">{member.content}</p>
                    )}
                    <div className="text-xs text-text-tertiary mt-1 ml-1">
                      {member.alert_created_at ? new Date(member.alert_created_at).toLocaleString() : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
              {groupDetail.group?.status === 'open' && (
                <button onClick={() => resolveGroup.mutate(groupDetail.group.id)}
                  className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all text-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  标记已解决
                </button>
              )}
              <button onClick={() => deleteGroup.mutate(groupDetail.group.id)}
                className="px-4 py-2 bg-status-failed/10 border border-status-failed/30 text-status-failed rounded-lg hover:bg-status-failed/20 transition-all text-sm flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                删除组
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
