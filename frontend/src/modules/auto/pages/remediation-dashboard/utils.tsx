import {
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  Activity,
  AlertCircle,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react';
import type { StatusBadgeItem, StatusBadgeMap } from './types';

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

const STATUS_BADGE_CONFIG: StatusBadgeMap = {
  success: {
    text: '成功',
    className: 'bg-green-500/10 text-green-400 border-green-500/20',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  failed: {
    text: '失败',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  rolled_back: {
    text: '已回滚',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
  pending: {
    text: '等待中',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  running: {
    text: '执行中',
    className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: <Activity className="w-3.5 h-3.5" />,
  },
  waiting_approval: {
    text: '待审批',
    className: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  skipped: {
    text: '已跳过',
    className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    icon: <ArrowDown className="w-3.5 h-3.5" />,
  },
  rejected: {
    text: '已拒绝',
    className: 'bg-slate-500/10 text-text-secondary border-slate-500/20',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

const DEFAULT_BADGE: StatusBadgeItem = {
  text: '',
  className: 'bg-slate-500/10 text-text-secondary border-slate-500/20',
  icon: <AlertTriangle className="w-3.5 h-3.5" />,
};

export function getStatusBadge(status: string) {
  const item: StatusBadgeItem = STATUS_BADGE_CONFIG[status] || {
    ...DEFAULT_BADGE,
    text: status,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${item.className}`}>
      {item.icon}
      {item.text}
    </span>
  );
}

const SEVERITY_CONFIG: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-green-500/10 text-green-400',
};

export function getSeverityBadge(severity: string) {
  if (!severity) return null;
  const className = SEVERITY_CONFIG[severity] || 'bg-gray-500/10 text-gray-400';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {severity}
    </span>
  );
}
