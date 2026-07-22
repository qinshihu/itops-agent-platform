/**
 * monitorRepository — monitor 模块的数据访问聚合入口
 *
 * 组合 server_metrics 子仓库。
 * 注意：baseline_metrics 已有 snmpRepository.baselineMetricsRepo，
 *       仪表盘分析通过 analyticsRepository 实现，
 *       reports/report_schedules 已有 infraRepository 子仓库。
 */

import { serverMetricsRepo } from './serverMetricsRepo';
export { serverMetricsRepo };
export type { ServerMetricRecord, ServerMetricInsertInput } from './serverMetricsRepo';

export const monitorRepository = {
  serverMetrics: serverMetricsRepo,
};