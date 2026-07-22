/**
 * 自监控服务类型定义（2026-07-21 拆分）
 *
 * 把原 selfMonitorService.ts L29-58 的 MonitorCheck / SelfMonitorReport 抽出
 * 拆分原则遵循 architecture.md §3.3.1 第 1 条「路由路径不变」+
 * 第 3 条「向后兼容的 import 路径」——上层 `from './selfMonitorService'` 仍兼容。
 */

/** 单个监控检查项的结果 */
export interface MonitorCheck {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  latencyMs?: number;
  value?: number;
  threshold?: number;
}

/** 自监控服务的整体报告 */
export interface SelfMonitorReport {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  checks: {
    database: MonitorCheck;
    disk: MonitorCheck;
    memory: MonitorCheck;
    errors: MonitorCheck;
    services: MonitorCheck;
    queue: MonitorCheck;
  };
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;
}
