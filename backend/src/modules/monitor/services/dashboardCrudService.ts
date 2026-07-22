/**
 * Dashboard 路由层读模式抽象（v3 报告 P1-5 第二批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 是纯只读聚合，把 analyticsRepository 的多种聚合方法集中暴露。
 *
 * 区分：dashboardRoutes（聚合统计）、reportRoutes（报表生成）。
 */
import { analyticsRepository } from '../../../repositories';

export const dashboardCrudService = {
  getDashboardStats() {
    return analyticsRepository.getDashboardStats();
  },

  getAlertTrends(hours: number) {
    return analyticsRepository.getAlertTrends(hours);
  },

  getTaskTrends(hours: number) {
    return analyticsRepository.getTaskTrends(hours);
  },

  getAgentStats() {
    return analyticsRepository.getAgentStats();
  },

  getTaskDistribution() {
    return analyticsRepository.getTaskDistribution();
  },

  getRemediationStats() {
    return analyticsRepository.getRemediationStats();
  },

  getSlaStats() {
    return analyticsRepository.getSlaStats();
  },

  getServerMetrics(serverId?: string, opts: { autoSelectLocal?: boolean } = {}) {
    return analyticsRepository.getServerMetricsDashboard(serverId, opts);
  },

  getFullDashboard() {
    return analyticsRepository.getFullDashboard();
  },

  getAlertSourceStats() {
    return analyticsRepository.getAlertSourceStats();
  },

  /**
   * 报表分析（综合告警趋势/分析统计/修复统计/Top 诊断）
   */
  getReportAnalytics() {
    return analyticsRepository.getReportAnalytics();
  },
};
