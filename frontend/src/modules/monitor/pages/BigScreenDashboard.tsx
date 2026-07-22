/**
 * BigScreenDashboard 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 BigScreenDashboard.tsx 910 行（git HEAD 369 + workspace 910）包含：
 *   - 1 个 export default function BigScreenDashboard()
 *   - 巨大 JSX 树（L79-908），含 6 个 panel（critical banner + header + 3 cols + footer）
 *
 * 拆分后行为：
 *   - 6 个独立 panel widget（big-screen/ 子目录）：
 *     1. CriticalAlertBanner.tsx    — 顶部严重告警条
 *     2. BigScreenHeader.tsx        — 主标题 / 快捷入口 / 资源统计
 *     3. BigScreenLeftColumn.tsx    — 系统资源监控 + 趋势图 + 自动修复
 *     4. BigScreenStatCardRow.tsx   — 4 StatCard + 4 SLA mini-card
 *     5. BigScreenTrendCharts.tsx   — CPU/内存/网络/磁盘 4 趋势图
 *     6. BigScreenRecentTasksList.tsx — 最近任务列表
 *     7. BigScreenRightColumn.tsx   — 告警 / Agent 统计 / 任务分布
 *     8. BigScreenFooter.tsx        — 底部状态栏
 *   - 主组件保留 layout 编排 + hook 调用，从 910 行精简到 ~70 行
 *   - 桶兼容：原 `import BigScreenDashboard from '.../pages/BigScreenDashboard'` 仍可用
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { useBigScreenData } from './big-screen/useBigScreenData';
import CriticalAlertBanner from './big-screen/CriticalAlertBanner';
import BigScreenHeader from './big-screen/BigScreenHeader';
import BigScreenLeftColumn from './big-screen/BigScreenLeftColumn';
import BigScreenStatCardRow from './big-screen/BigScreenStatCardRow';
import BigScreenTrendCharts from './big-screen/BigScreenTrendCharts';
import BigScreenRecentTasksList from './big-screen/BigScreenRecentTasksList';
import BigScreenRightColumn from './big-screen/BigScreenRightColumn';
import BigScreenFooter from './big-screen/BigScreenFooter';
import ParticleBackground from '../components/ParticleBackground';

export default function BigScreenDashboard() {
  const data = useBigScreenData();
  const navigate = (path: string) => data.navigate(path);

  return (
    <div className="big-screen-scope">
      <div
        ref={data.containerRef}
        className={`relative ${data.isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'h-screen'} overflow-y-auto bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950 ${data.criticalAlertCount > 0 ? 'before:content-[""] before:absolute before:inset-0 before:z-5 before:pointer-events-none before:border-4 before:border-red-500/40 before:rounded-lg before:animate-pulse' : ''}`}
      >
        <ParticleBackground />

        <div className="relative z-10 flex flex-col p-4 min-h-screen">
          <CriticalAlertBanner
            criticalAlertCount={data.criticalAlertCount}
            isStatsError={data.isStatsError}
            onViewAlerts={() => navigate('/alerts')}
            onRefresh={data.refreshData}
          />

          <BigScreenHeader
            titleEditing={{
              isEditingTitle: data.isEditingTitle,
              titleInputValue: data.titleInputValue,
              onTitleInputChange: data.setTitleInputValue,
              onTitleEnter: data.handleSaveTitle,
              onTitleEscape: data.handleCancelEditTitle,
              onTitleEditClick: () => data.setIsEditingTitle(true),
              onTitleSave: data.handleSaveTitle,
              onTitleCancel: data.handleCancelEditTitle,
            }}
            dashboardTitle={data.dashboardTitle}
            stats={data.stats}
            currentTime={data.currentTime}
            isFullscreen={data.isFullscreen}
            onNavigate={navigate}
            onToggleFullscreen={data.toggleFullscreen}
            onRefresh={data.refreshData}
          />

          <div className="grid grid-cols-12 gap-4">
            <BigScreenLeftColumn
              selectedServerId={data.selectedServerId}
              setSelectedServerId={data.setSelectedServerId}
              aggregatedMetrics={data.aggregatedMetrics}
              serverMetricsData={data.serverMetricsData}
              alertTrendData={data.alertTrendData}
              taskTrendData={data.taskTrendData}
              remediationStats={data.remediationStats}
              onNavigate={navigate}
            />

            <div className="col-span-6 flex flex-col gap-4">
              <BigScreenStatCardRow
                stats={data.stats}
                slaStats={data.slaStats}
                onNavigate={navigate}
              />
              <BigScreenTrendCharts
                cpuData={data.cpuData}
                memoryData={data.memoryData}
                networkData={data.networkData}
                diskIOData={data.diskIOData}
              />
              <BigScreenRecentTasksList tasks={data.tasks} onViewAll={() => navigate('/tasks')} />
            </div>

            <BigScreenRightColumn
              stats={data.stats}
              alerts={data.alerts}
              hasCriticalAlerts={data.hasCriticalAlerts}
              agentStats={data.agentStats}
              taskDistData={data.taskDistData}
              onNavigate={navigate}
            />
          </div>

          <BigScreenFooter
            systemHealthStatus={data.systemHealthStatus}
            waitingApproval={data.remediationStats?.waiting_approval || 0}
            isStatsError={data.isStatsError}
          />
        </div>
      </div>
    </div>
  );
}
