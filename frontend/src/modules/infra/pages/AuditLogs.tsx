import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, User, Database, FileText, Eye, Search } from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';

interface AuditLog {
  id: string;
  user_id: string | null;
  username: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  result: string | null;
  status: string;
  created_at: string;
  completed_at: string;
}

export default function AuditLogs() {
  const [page] = useState(1);
  const [limit] = useState(20);
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedResource, setSelectedResource] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['auditLogs', page, selectedAction, selectedResource],
    queryFn: async () => {
      const params: any = { page, limit };
      if (selectedAction) params.action = selectedAction;
      if (selectedResource) params.resource_type = selectedResource;
      
      const res = await api.get('/api/audit', { params });
      return res.data.data;
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['auditStats'],
    queryFn: async () => {
      const res = await api.get('/api/audit/stats/summary');
      return res.data.data;
    },
  });

  const filteredLogs = logsData?.logs?.filter((log: AuditLog) =>
    !searchQuery || 
    log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.resource_type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const actions = Array.from(new Set((logsData?.logs || []).map((l: AuditLog) => l.action))) as string[];
  const resources = Array.from(new Set((logsData?.logs || []).map((l: AuditLog) => l.resource_type))) as string[];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getActionIcon = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('create')) return '➕';
    if (lowerAction.includes('update') || lowerAction.includes('edit')) return '✏️';
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) return '🗑️';
    if (lowerAction.includes('execute') || lowerAction.includes('run')) return '▶️';
    if (lowerAction.includes('alert')) return '🔔';
    return '📋';
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">审计日志</h1>
            <p className="text-text-secondary">系统操作记录和审计追踪</p>
          </div>
        </div>

        {/* 统计卡片 */}
        {statsData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">今日操作</p>
                  <p className="text-2xl font-bold text-blue-500">{statsData.todayCount}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">操作失败</p>
                  <p className="text-2xl font-bold text-red-500">{statsData.failureCount}</p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">操作类型</p>
                  <p className="text-2xl font-bold text-green-500">{statsData.actionStats?.length || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Database className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">资源类型</p>
                  <p className="text-2xl font-bold text-purple-500">{statsData.resourceStats?.length || 0}</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 搜索和筛选 */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex items-center gap-2">
              <Search className="w-5 h-5 text-text-secondary" />
              <input
                type="text"
                placeholder="搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="">所有操作</option>
                {actions.map((action: string) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="">所有资源</option>
                {resources.map((resource: string) => (
                  <option key={resource} value={resource}>{resource}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 日志列表 */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">时间</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">操作</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">资源</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">用户</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">状态</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    加载中...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    暂无日志
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: AuditLog) => (
                  <tr key={log.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      <span className="flex items-center gap-2">
                        <span>{getActionIcon(log.action)}</span>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {log.resource_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {log.username}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={clsx(
                        "px-2 py-1 rounded text-xs font-medium",
                        log.status === 'success' ? "bg-green-500/10 text-green-500" :
                        log.status === 'failure' ? "bg-red-500/10 text-red-500" :
                        "bg-yellow-500/10 text-yellow-500"
                      )}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 text-text-secondary hover:text-primary transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 详情模态框 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-text-primary">日志详情</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-text-secondary mb-1">操作</p>
                  <p className="text-text-primary">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary mb-1">用户</p>
                  <p className="text-text-primary">{selectedLog.username}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary mb-1">资源</p>
                  <p className="text-text-primary">{selectedLog.resource_type}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary mb-1">时间</p>
                  <p className="text-text-primary">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary mb-1">状态</p>
                  <span className={clsx(
                  "px-2 py-1 rounded text-xs font-medium",
                  selectedLog.status === 'success' ? "bg-green-500/10 text-green-500" :
                  selectedLog.status === 'failure' ? "bg-red-500/10 text-red-500" :
                  "bg-yellow-500/10 text-yellow-500"
                )}>
                    {selectedLog.status}
                  </span>
                </div>
                {selectedLog.details && (
                  <div>
                    <p className="text-sm text-text-secondary mb-1">详情</p>
                    <pre className="bg-background p-3 rounded text-sm text-text-primary overflow-x-auto">
                      {selectedLog.details}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
