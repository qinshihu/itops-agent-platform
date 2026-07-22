/**
 * selfMonitorService 子模块 barrel export（2026-07-21 拆分）
 *
 * 主导出：SelfMonitorService 类 + selfMonitorService 单例 + 类型
 */
export { SelfMonitorService, selfMonitorService } from './selfMonitorService';
export type { MonitorCheck, SelfMonitorReport } from './types';
export type { MonitorConfig } from './config';
export { DEFAULT_CONFIG } from './config';
