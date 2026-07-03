/**
 * analyticsRepository — barrel re-export + 统一对象组合
 *
 * 将 linkageRoutes.ts / dashboardRoutes.ts / reportRoutes.ts 中复杂聚合查询
 * 封装为语义化方法，从路由层移到 repository 层。
 */

// re-export all types
export type {
  InspectionCenterCounts,
  InspectionCenterResult,
  DeviceOverview,
  DashboardLinkageStats,
  InspectionHistoryTrend,
  DeviceTrend,
  TrendSummary,
  DashboardStats,
  AlertTrendPoint,
  TaskTrendPoint,
  AgentStatItem,
  AgentStatsResult,
  TaskDistribution,
  RemediationStats,
  SlaStats,
  ServerMetricLatest,
  ServerMetricsDashboard,
  FullDashboard,
  AlertSourceStats,
  ReportAnalytics,
} from './types';

import { getInspectionCenter, getDeviceOverview, getDashboardLinkage } from './linkageAnalytics';
import { getInspectionHistoryTrend, getDeviceTrend, getTrendSummary } from './trendAnalytics';
import {
  getDashboardStats,
  getAlertTrends,
  getTaskTrends,
  getAgentStats,
  getTaskDistribution,
  getFullDashboard,
} from './dashboardStats';
import {
  getRemediationStats,
  getSlaStats,
  getServerMetricsDashboard,
  getAlertSourceStats,
  getReportAnalytics,
} from './operationalAnalytics';

export const analyticsRepository = {
  // linkage analytics
  getInspectionCenter,
  getDeviceOverview,
  getDashboardLinkage,
  getInspectionHistoryTrend,
  getDeviceTrend,
  getTrendSummary,
  // dashboard stats
  getDashboardStats,
  getAlertTrends,
  getTaskTrends,
  getAgentStats,
  getTaskDistribution,
  getFullDashboard,
  // operational analytics
  getRemediationStats,
  getSlaStats,
  getServerMetricsDashboard,
  getAlertSourceStats,
  getReportAnalytics,
};
