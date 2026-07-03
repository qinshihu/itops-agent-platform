import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle, XCircle, Filter, Search, Clock } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string | null;
  recipient: string | null;
  status: string;
  related_alert_id: string | null;
  related_task_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', page, selectedType, selectedStatus],
    queryFn: async () => {
      const params: any = { page, limit };
      if (selectedType) params.type = selectedType;
      if (selectedStatus) params.status = selectedStatus;
      
      const res = await api.get('/api/notifications', { params });
      return res.data.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['notificationStats'],
    queryFn: async () => {
      const res = await api.get('/api/notifications/stats/summary');
      return res.data.data;
    },
  });

  const markAsSentMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/api/notifications/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
    },
  });

  const filteredNotifications = notificationsData?.notifications?.filter((notif: Notification) =>
    !searchQuery || 
    notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notif.content?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const notificationTypes = Array.from(
    new Set((notificationsData?.notifications || []).map((n: Notification) => n.type))
  ) as string[];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'alert':
        return '🔔';
      case 'task':
        return '📋';
      case 'system':
        return '⚙️';
      case 'report':
        return '📊';
      default:
        return '📧';
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">通知系统</h1>
            <p className="text-text-secondary">管理系统通知和告警推送</p>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">待发送</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.pendingCount}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">今日发送</p>
                  <p className="text-2xl font-bold text-green-500">{stats.todaySent}</p>
                </div>
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">通知类型</p>
                  <p className="text-2xl font-bold text-purple-500">
                    {Array.from(new Set((stats.typeStats || []).map((t: any) => t.type))).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Bell className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {/* 筛选区域 */}
          <div className="p-4 border-b border-border bg-background">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="搜索通知..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-text-secondary" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">所有类型</option>
                  {notificationTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">所有状态</option>
                  <option value="pending">待发送</option>
                  <option value="sent">已发送</option>
                </select>
              </div>
            </div>
          </div>

          {/* 通知列表 */}
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-text-secondary">
                加载中...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                暂无通知
              </div>
            ) : (
              filteredNotifications.map((notification: Notification) => (
                <div key={notification.id} className="p-4 hover:bg-background transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl mt-1">
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-text-primary">{notification.title}</h3>
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            notification.status === 'sent'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          )}>
                            {notification.status === 'sent' ? '已发送' : '待发送'}
                          </span>
                        </div>
                        {notification.content && (
                          <p className="text-sm text-text-secondary mb-2">{notification.content}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-text-tertiary">
                          <span>创建: {formatDate(notification.created_at)}</span>
                          {notification.sent_at && (
                            <span>发送: {formatDate(notification.sent_at)}</span>
                          )}
                          {notification.recipient && (
                            <span>收件人: {notification.recipient}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {notification.status === 'pending' && (
                        <button
                          onClick={() => markAsSentMutation.mutate(notification.id)}
                          disabled={markAsSentMutation.isPending}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="标记为已发送"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(notification.id)}
                        disabled={deleteMutation.isPending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="删除"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 分页 */}
          {notificationsData?.total > limit && (
            <div className="p-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                共 {notificationsData.total} 条通知
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded bg-background border border-border text-sm text-text-primary hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span className="text-sm text-text-secondary">
                  第 {page} 页 / 共 {Math.ceil(notificationsData.total / limit)} 页
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * limit >= notificationsData.total}
                  className="px-3 py-1 rounded bg-background border border-border text-sm text-text-primary hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
