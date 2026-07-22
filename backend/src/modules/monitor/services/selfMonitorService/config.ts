/**
 * 自监控服务配置（2026-07-21 拆分）
 *
 * 把原 selfMonitorService.ts L59-96 的 MonitorConfig interface + DEFAULT_CONFIG 抽出
 */

/** 自监控配置接口 */
export interface MonitorConfig {
  /** 检查间隔（毫秒） */
  intervalMs: number;
  /** 内存使用告警阈值（百分比） */
  memoryWarnPercent: number;
  /** 内存使用严重阈值（百分比） */
  memoryCritPercent: number;
  /** 磁盘使用告警阈值（百分比） */
  diskWarnPercent: number;
  /** 磁盘使用严重阈值（百分比） */
  diskCritPercent: number;
  /** 数据库延迟告警阈值（毫秒） */
  dbLatencyWarnMs: number;
  /** 数据库延迟严重阈值（毫秒） */
  dbLatencyCritMs: number;
  /** 5 分钟内错误数告警阈值 */
  errorRateWarn: number;
  /** 5 分钟内错误数严重阈值 */
  errorRateCrit: number;
  /** 服务降级阈值 */
  degradedServiceThreshold: number;
  /** 服务下线阈值 */
  downServiceThreshold: number;
}

/** 默认自监控配置 */
export const DEFAULT_CONFIG: MonitorConfig = {
  intervalMs: 5 * 60 * 1000, // 5 分钟
  memoryWarnPercent: 75,
  memoryCritPercent: 90,
  diskWarnPercent: 80,
  diskCritPercent: 95,
  dbLatencyWarnMs: 500,
  dbLatencyCritMs: 2000,
  errorRateWarn: 10,
  errorRateCrit: 50,
  degradedServiceThreshold: 1,
  downServiceThreshold: 2,
};
