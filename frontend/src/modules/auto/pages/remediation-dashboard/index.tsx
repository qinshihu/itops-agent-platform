import { OverallStatsCards } from './OverallStatsCards';
import { ExecutionTrendChart } from './ExecutionTrendChart';
import { PolicySuccessRanking } from './PolicySuccessRanking';
import { AlertSourceStatsComponent } from './AlertSourceStats';
import { RecentExecutionsTable } from './RecentExecutionsTable';
import { useRemediationDashboard } from './useRemediationDashboard';

export default function RemediationDashboardPage() {
  const {
    trendPeriod,
    setTrendPeriod,
    remediationStats,
    policiesWithStats,
    alertSourceStats,
    executionTrend,
    stats,
    sortedPoliciesBySuccessRate,
    maxTriggers,
    loading,
  } = useRemediationDashboard();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">修复效果仪表盘</h1>
            <p className="text-text-secondary text-sm">自动修复策略执行效果与统计分析</p>
          </div>
          <div className="flex items-center gap-2 bg-surface/50 border border-border rounded-lg p-1">
            <button
              onClick={() => setTrendPeriod('24h')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                trendPeriod === '24h'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              最近24小时
            </button>
            <button
              onClick={() => setTrendPeriod('7d')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                trendPeriod === '7d'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              最近7天
            </button>
          </div>
        </div>

        {/* Overall Stats Cards */}
        <OverallStatsCards
          loading={loading}
          remediationStats={remediationStats}
          stats={stats}
        />

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ExecutionTrendChart
            executionTrend={executionTrend}
            maxTriggers={maxTriggers}
            trendPeriod={trendPeriod}
          />
          <PolicySuccessRanking policies={sortedPoliciesBySuccessRate} />
        </div>

        {/* Alert Source Stats */}
        <AlertSourceStatsComponent sources={alertSourceStats} />

        {/* Recent Executions */}
        <RecentExecutionsTable executions={remediationStats?.recent_executions} />
      </div>
    </div>
  );
}
