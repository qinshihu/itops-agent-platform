/**
 * BigScreenDashboard - Footer 状态栏（2026-07-21 拆分）
 *
 * 从原 BigScreenDashboard.tsx L884-904 抽出
 * Footer 显示：系统健康状态 + 数据刷新间隔 + 后端连接 + 版本信息
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import {
  getStatusFooterColor,
  getSystemStatusIcon,
  getStatusFooterText,
} from './BigScreenStatCard';

export interface BigScreenFooterProps {
  systemHealthStatus: string;
  waitingApproval: number;
  isStatsError: boolean;
}

export default function BigScreenFooter({
  systemHealthStatus,
  waitingApproval,
  isStatsError,
}: BigScreenFooterProps) {
  return (
    <footer className="mt-4 px-2 flex items-center justify-between text-xs text-slate-500">
      <div className="flex items-center gap-4">
        <span className={`flex items-center gap-1 ${getStatusFooterColor(systemHealthStatus)}`}>
          {getSystemStatusIcon(systemHealthStatus)}
          {getStatusFooterText(systemHealthStatus, waitingApproval)}
        </span>
        <span>数据刷新: 30秒</span>
        <span
          className={`flex items-center gap-1 ${isStatsError ? 'text-red-400' : 'text-green-400'}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isStatsError ? 'bg-red-400' : 'bg-green-400'}`}
          />
          {isStatsError ? '连接断开' : '连接正常'}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>AIOps Agent Platform v3.0.1</span>
        <span>© 2026</span>
      </div>
    </footer>
  );
}
