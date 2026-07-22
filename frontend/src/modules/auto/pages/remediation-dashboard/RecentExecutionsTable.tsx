import { ListChecks } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { RemediationStats } from './types';
import { getSeverityBadge, getStatusBadge } from './utils';

interface RecentExecutionsTableProps {
  executions?: RemediationStats['recent_executions'];
}

export function RecentExecutionsTable({ executions }: RecentExecutionsTableProps) {
  return (
    <div className="bg-surface/30 border border-border/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-cyan-400" />
          最近修复执行记录
        </h2>
        <span className="text-xs text-text-secondary">
          共 {executions?.length || 0} 条
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">执行ID</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">策略</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">告警</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">状态</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">执行时间</th>
            </tr>
          </thead>
          <tbody>
            {executions && executions.length > 0 ? (
              executions.map((exec) => (
                <tr
                  key={exec.id}
                  className="border-b border-border/30 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="text-xs text-text-tertiary font-mono">
                      {exec.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-text-primary font-medium">{exec.policy_name}</div>
                    <div className="text-xs text-text-tertiary">{exec.execution_mode}</div>
                  </td>
                  <td className="py-3 px-4">
                    {exec.alert_title ? (
                      <div>
                        <div className="text-sm text-text-primary truncate max-w-[200px]">
                          {exec.alert_title}
                        </div>
                        {getSeverityBadge(exec.alert_severity)}
                      </div>
                    ) : (
                      <span className="text-xs text-text-tertiary">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(exec.status)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-text-secondary">
                      {formatDistanceToNow(parseISO(exec.created_at), { addSuffix: true })}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-tertiary">
                  暂无执行记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RecentExecutionsTable;
