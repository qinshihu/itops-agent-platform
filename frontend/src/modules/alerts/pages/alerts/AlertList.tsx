import { Bell, Play, Clock, Zap, Wrench, Search, Terminal, Wifi } from 'lucide-react';
import clsx from 'clsx';
import { safeFormatDistance } from '../../../../lib/date';
import { sanitizeText } from '../../../../lib/xss';
import type { Alert, AnalysisItem } from './types';

function getSeverityLabel(severity: string) {
  const labels: Record<string, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
  };
  return labels[severity] || severity;
}

interface AlertListProps {
  alerts: Alert[];
  analysisMap: Record<string, AnalysisItem>;
  onProcess: (alertId: string) => void;
  processPending: boolean;
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
  navigate: (path: string) => void;
  onViewAutomationLog: (alert: Alert) => void;
}

export default function AlertList({
  alerts,
  analysisMap,
  onProcess,
  processPending,
  onAcknowledge,
  onResolve,
  navigate,
  onViewAutomationLog,
}: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-xl bg-surface border border-border mb-3">
          <Bell className="w-8 h-8 text-text-secondary opacity-50" />
        </div>
        <p className="text-sm text-text-secondary mb-1">暂无告警</p>
        <p className="text-xs text-text-tertiary">系统运行正常，没有告警信息</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {alerts.map((alert) => (
        <div key={alert.id} className="p-6 hover:bg-background/50 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium',
                    alert.severity === 'critical' && 'bg-status-failed/10 text-status-failed',
                    alert.severity === 'high' && 'bg-status-warning/10 text-status-warning',
                    alert.severity === 'medium' && 'bg-primary/10 text-primary',
                    alert.severity === 'low' && 'bg-status-pending/10 text-status-pending'
                  )}
                >
                  {getSeverityLabel(alert.severity)}
                </span>
                <span
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium',
                    alert.status === 'new' && 'bg-status-failed/10 text-status-failed',
                    alert.status === 'acknowledged' && 'bg-status-warning/10 text-status-warning',
                    alert.status === 'resolved' && 'bg-status-success/10 text-status-success'
                  )}
                >
                  {alert.status === 'new' && '新'}
                  {alert.status === 'acknowledged' && '已确认'}
                  {alert.status === 'resolved' && '已解决'}
                </span>
              </div>
              <h3 className="font-semibold text-text-primary mb-1">{sanitizeText(alert.title)}</h3>
              <p className="text-sm text-text-secondary mb-2">{sanitizeText(alert.content)}</p>
              <div className="flex items-center gap-4 text-xs text-text-secondary">
                <span>来源: {sanitizeText(alert.source)}</span>
                <span>
                  {safeFormatDistance(alert.created_at)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              {alert.status !== 'resolved' && (
                <button
                  onClick={() => onProcess(alert.id)}
                  disabled={processPending}
                  className="px-3 py-1 text-sm bg-purple-600/10 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-600/20 transition-colors flex items-center gap-1"
                  title="手动触发匹配映射+修复策略+根因分析"
                >
                  <Play className="w-3.5 h-3.5" />
                  处理
                </button>
              )}
              {alert.status === 'new' && (
                <button
                  onClick={() => onAcknowledge(alert.id)}
                  className="px-3 py-1 text-sm bg-status-warning/10 text-status-warning rounded-lg hover:bg-status-warning/20"
                >
                  确认
                </button>
              )}
              {alert.status !== 'resolved' && (
                <button
                  onClick={() => onResolve(alert.id)}
                  className="px-3 py-1 text-sm bg-status-success/10 text-status-success rounded-lg hover:bg-status-success/20"
                >
                  解决
                </button>
              )}
            </div>
          </div>

          {/* ── 关联操作 ── */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
            {analysisMap[alert.id] && (
              <button
                onClick={() => navigate(`/alert-auto-analysis?alertId=${alert.id}`)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded bg-emerald-500/5 hover:bg-emerald-500/10"
              >
                <Zap className="w-3 h-3" />
                AI 分析
              </button>
            )}
            <button
              onClick={() => navigate(`/remediation-executions?alertId=${alert.id}`)}
              className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors px-2 py-1 rounded bg-orange-500/5 hover:bg-orange-500/10"
            >
              <Wrench className="w-3 h-3" />
              修复记录
            </button>
            <button
              onClick={() => onViewAutomationLog(alert)}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors px-2 py-1 rounded bg-slate-500/10 hover:bg-slate-500/20"
            >
              <Clock className="w-3 h-3" />
              自动处理记录
            </button>
            {alert.related_task_id && (
              <button
                onClick={() => navigate(`/tasks?taskId=${encodeURIComponent(alert.related_task_id!)}`)}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-1 rounded bg-cyan-500/5 hover:bg-cyan-500/10"
              >
                <Terminal className="w-3 h-3" />
                工作流任务
              </button>
            )}
            <button
              onClick={() => navigate(`/inspection-center?alertId=${alert.id}`)}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded bg-blue-500/5 hover:bg-blue-500/10"
            >
              <Wifi className="w-3 h-3" />
              巡检结果
            </button>
            <button
              onClick={() => navigate(`/root-cause-analysis?alertId=${alert.id}`)}
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded bg-purple-500/5 hover:bg-purple-500/10"
            >
              <Search className="w-3 h-3" />
              根因分析
            </button>
            {analysisMap[alert.id]?.status === 'completed' && (
              <span className="ml-auto text-xs text-emerald-500/60">
                ✅ 已自动诊断
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}