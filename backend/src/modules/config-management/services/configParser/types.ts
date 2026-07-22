/**
 * configParser 类型 barrel（2026-07-21 拆分）
 *
 * Re-export 来自 configRepair 公共类型，避免子模块重复书写导入路径。
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */
export type { ConfigBlock, ConfigIssue, ConfigTemplate } from '../../../../types/configRepair';
