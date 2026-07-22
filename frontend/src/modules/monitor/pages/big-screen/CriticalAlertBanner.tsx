/**
 * BigScreenDashboard - Critical Alert Banner（2026-07-21 拆分）
 *
 * 从原 BigScreenDashboard.tsx L88-128 抽出：
 * - Critical Alert Banner（当 criticalAlertCount > 0 时显示）
 * - Error Banner（当 isStatsError 时显示后端连接异常）
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { Bell, AlertCircle, ChevronRight, RefreshCcw } from 'lucide-react';

export interface CriticalAlertBannerProps {
  criticalAlertCount: number;
  isStatsError: boolean;
  onViewAlerts: () => void;
  onRefresh: () => void;
}

/**
 * 顶部严重告警 / 错误提示条
 * - 仅在告警数 > 0 或后端异常时渲染
 */
export default function CriticalAlertBanner({
  criticalAlertCount,
  isStatsError,
  onViewAlerts,
  onRefresh,
}: CriticalAlertBannerProps) {
  if (criticalAlertCount <= 0 && !isStatsError) return null;

  return (
    <>
      {/* Critical Alert Banner */}
      {criticalAlertCount > 0 && (
        <div className="mb-3 px-4 py-3 bg-gradient-to-r from-red-900/60 via-red-800/60 to-red-900/60 border border-red-500/60 rounded-xl backdrop-blur-md flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-red-300" />
            <div>
              <span className="text-red-100 font-bold text-lg">严重告警</span>
              <span className="text-red-200 ml-2">
                当前有{' '}
                <span className="text-red-100 font-bold text-xl">
                  {criticalAlertCount}
                </span>{' '}
                个严重级别告警需要处理
              </span>
            </div>
          </div>
          <button
            onClick={onViewAlerts}
            className="px-4 py-2 bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 rounded-lg text-red-100 font-medium text-sm flex items-center gap-2 transition-all"
          >
            立即查看 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {isStatsError && (
        <div className="mb-3 px-4 py-3 bg-red-900/40 border border-red-500/50 rounded-xl backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 animate-pulse" />
            <span className="text-red-200 font-medium">后端服务连接异常</span>
            <span className="text-red-300 text-sm">数据可能不是最新的</span>
          </div>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-center gap-1 transition-all"
          >
            <RefreshCcw className="w-3 h-3" /> 重试
          </button>
        </div>
      )}
    </>
  );
}
