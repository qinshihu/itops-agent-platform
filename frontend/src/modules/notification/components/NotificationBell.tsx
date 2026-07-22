/**
 * NotificationBell — 侧边栏通知铃铛组件
 *
 * 功能：
 * 1. 显示未处理通知的角标（pending + failed）
 * 2. 点击展开 Popover，下拉显示最近 10 条通知
 * 3. 跨模块入口：点击单条通知跳转到对应模块（workflow → /tasks?taskId=...）
 * 4. 提供"查看全部"链接到通知中心
 * 5. 30s 自动轮询，保证 workflow 失败/审批待办等事件能即时出现
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Popover, Badge, Empty, Spin } from 'antd';
import {
  Bell,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  FileText,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { notificationApi, type NotificationRecord as Notification } from '../api';
import { useTheme } from '@/contexts/ThemeContext';

const TYPE_ICONS: Record<string, typeof Bell> = {
  workflow_failed: XCircle,
  workflow_completed: CheckCircle2,
  approval_pending: ShieldCheck,
  alert_firing: AlertTriangle,
  report_ready: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  workflow_failed: 'text-red-400',
  workflow_completed: 'text-green-400',
  approval_pending: 'text-amber-400',
  alert_firing: 'text-orange-400',
  report_ready: 'text-blue-400',
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // 最近通知列表（取前 10 条，全部状态混合）
  const { data: recent, isLoading } = useQuery({
    queryKey: ['notifications-recent'],
    queryFn: async () => {
      const { notifications } = await notificationApi.list({ page: 1, limit: 10 });
      return notifications as Notification[];
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  // 未处理统计（pending + failed）用于角标
  const unreadCount = useMemo(() => {
    if (!recent) return 0;
    return recent.filter((n) => n.status === 'pending' || n.status === 'failed').length;
  }, [recent]);

  const goToRelated = (n: Notification) => {
    // 跨模块路由跳转
    if (n.related_task_id) {
      navigate(`/tasks?taskId=${n.related_task_id}`);
      return;
    }
    if (n.related_alert_id) {
      navigate(`/alerts`);
      return;
    }
    navigate('/notifications');
  };

  const content = (
    <div
      className={clsx(
        'w-96 max-h-[480px] overflow-hidden flex flex-col',
        isDark ? 'bg-slate-900' : 'bg-white',
      )}
    >
      <div
        className={clsx(
          'flex items-center justify-between px-4 py-3 border-b',
          isDark ? 'border-slate-700' : 'border-gray-200',
        )}
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">最近通知</span>
          {unreadCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-status-failed/15 text-status-failed font-medium">
              {unreadCount} 未处理
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/notifications')}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          查看全部 <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : !recent || recent.length === 0 ? (
          <div className="py-8">
            <Empty
              description={
                <span className={clsx('text-xs', isDark ? 'text-slate-500' : 'text-gray-500')}>
                  暂无通知
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((n) => {
              const Icon = TYPE_ICONS[n.type] || Clock;
              const color = TYPE_COLORS[n.type] || 'text-text-secondary';
              const isUnread = n.status === 'pending' || n.status === 'failed';
              return (
                <button
                  key={n.id}
                  onClick={() => goToRelated(n)}
                  className={clsx(
                    'w-full text-left px-4 py-3 flex gap-3 transition-colors',
                    isDark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50',
                    isUnread && (isDark ? 'bg-slate-800/30' : 'bg-blue-50/40'),
                  )}
                >
                  <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={clsx(
                          'text-sm font-medium truncate',
                          isDark ? 'text-white' : 'text-gray-900',
                        )}
                      >
                        {n.title}
                      </p>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-status-failed flex-shrink-0" />
                      )}
                    </div>
                    {n.content && (
                      <p
                        className={clsx(
                          'text-xs mt-0.5 line-clamp-2',
                          isDark ? 'text-slate-400' : 'text-gray-600',
                        )}
                      >
                        {n.content}
                      </p>
                    )}
                    <p
                      className={clsx(
                        'text-[10px] mt-1',
                        isDark ? 'text-slate-500' : 'text-gray-400',
                      )}
                    >
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      {n.status === 'failed' && (
                        <span className="ml-2 text-status-failed">
                          <AlertCircle className="w-3 h-3 inline" /> 发送失败
                        </span>
                      )}
                      {n.status === 'pending' && (
                        <span className="ml-2 text-amber-500">待发送</span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      overlayInnerStyle={{ padding: 0 }}
      destroyTooltipOnHide
    >
      <button
        className={clsx(
          'relative p-2 rounded-lg transition-all',
          isDark
            ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
        )}
        title="通知中心"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <Badge
            count={unreadCount > 99 ? '99+' : unreadCount}
            size="small"
            offset={[-2, 2]}
            style={{
              backgroundColor: '#ef4444',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
              fontSize: 10,
              minWidth: 16,
              height: 16,
              lineHeight: '16px',
            }}
          />
        )}
      </button>
    </Popover>
  );
}
