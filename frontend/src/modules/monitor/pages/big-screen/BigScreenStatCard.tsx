/**
 * BigScreenDashboard 子组件：StatCard + helpers
 * 2026-07-21 P1-#16a：从 BigScreenDashboard.tsx（935 行）拆分抽出
 *
 * 包含：
 *   - <StatCard>：单个统计卡片
 *   - getStatusColor()：任务状态 → tailwind class
 *   - getSeverityBadge()：告警严重级别 → tailwind class
 *   - getSystemStatusIcon()：系统状态 → Icon component
 *
 * 关联：v2 报告 §9.2 #16、AGENTS.md §铁律 3
 */

import type { ComponentType, SVGProps } from 'react';
import { AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';

export interface StatCardColor {
  bg: string;
  fg: string;
}

export interface StatCardProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
  subValue?: string;
  color: StatCardColor;
  onClick?: () => void;
}

export const StatCard = ({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  onClick,
}: StatCardProps) => (
  <div
    className={`bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border cursor-pointer transition-all hover:border-slate-600/50 hover:bg-slate-800/60 ${onClick ? '' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${color.fg}`} />
      </div>
      {onClick && <ChevronRight className="w-4 h-4 text-slate-500" />}
    </div>
    <div className="text-2xl font-bold text-text-primary">{value}</div>
    <div className="text-xs text-text-secondary mt-1">{label}</div>
    {subValue && <div className="text-xs text-slate-500 mt-0.5">{subValue}</div>}
  </div>
);

/**
 * 任务状态 → tailwind text color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-status-success';
    case 'running':
      return 'text-status-running';
    case 'failed':
      return 'text-status-failed';
    case 'pending':
      return 'text-status-pending';
    default:
      return 'text-text-secondary';
  }
}

/**
 * 告警严重级别 → tailwind badge class
 */
export function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-status-failed/20 text-status-failed border border-status-failed/30';
    case 'high':
      return 'bg-status-warning/20 text-status-warning border border-status-warning/30';
    default:
      return 'bg-status-pending/20 text-status-pending border border-status-pending/30';
  }
}

/**
 * 系统状态 → Icon component
 */
export function getSystemStatusIcon(status: string): JSX.Element {
  if (status === 'critical')
    return <AlertCircle className="w-3 h-3 text-status-failed" />;
  if (status === 'warning')
    return <AlertCircle className="w-3 h-3 text-status-warning" />;
  return <CheckCircle className="w-3 h-3 text-status-success" />;
}

/**
 * 系统状态 → 中文文案（用于 footer）
 */
export function getStatusFooterText(status: string, waitingApproval: number): string {
  if (status === 'critical') return '严重告警中';
  if (status === 'warning') return '存在高等级告警';
  if (waitingApproval > 0) return '有待审批修复';
  return '系统运行正常';
}

/**
 * 系统状态 → tailwind text color（用于 footer）
 */
export function getStatusFooterColor(status: string): string {
  if (status === 'critical') return 'text-red-400';
  if (status === 'warning') return 'text-yellow-400';
  return 'text-status-success';
}
