/**
 * selfMonitorService 桶导出（2026-07-21 拆分后重构）
 *
 * 拆分动机：原 selfMonitorService.ts 676 行混合了 2 interface + 1 default config + 1 主类 +
 * 9 个检查/辅助方法，违反 architecture.md §3.3.1「按职责拆分」原则。
 *
 * 拆分后行为：
 * - 保留 `'./selfMonitorService'` import 路径不变（通过本文件 barrel 重新导出）
 * - 上层调用方式不变（serviceRegistry.ts / mcp/monitorTools.ts / monitor/healthService.ts 全部零改动）
 * - 真实实现已分散到 4 个子文件，最大单文件 280 行
 *
 * 拆分原则遵循 architecture.md §3.3.1：
 * - 第 1 条「路由路径不变」——HTTP 路由完全不变
 * - 第 3 条「向后兼容的 import 路径」——上层 0 改动
 */
export * from './selfMonitorService/index';
