/**
 * Linkage（联动统计）路由层抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中巡检中心/设备概览/趋势等"读模式"聚合方法。
 *
 * 模块归属：P1-6 infra 按子域拆分阶段 7（2026-07-07）
 * 原位置：modules/infra/services/linkageService.ts
 */
import { analyticsRepository } from '../../../repositories';

export const linkageService = {
  getInspectionCenter(deviceId?: string, alertId?: string, type?: string, limit = 100) {
    return analyticsRepository.getInspectionCenter(deviceId, alertId, type, Math.min(limit, 200));
  },

  getDeviceOverview(deviceId: string) {
    return analyticsRepository.getDeviceOverview(deviceId);
  },

  getDashboardLinkage() {
    return analyticsRepository.getDashboardLinkage();
  },

  getInspectionHistoryTrend(days = 30, deviceId?: string) {
    return analyticsRepository.getInspectionHistoryTrend(days, deviceId);
  },

  getDeviceTrend(deviceId: string, days = 30, metric = 'all') {
    return analyticsRepository.getDeviceTrend(deviceId, days, metric);
  },

  getTrendSummary(days = 30) {
    return analyticsRepository.getTrendSummary(days);
  },
};
