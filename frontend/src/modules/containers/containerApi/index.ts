/**
 * containersApi 子模块 barrel export（2026-07-21 拆分）
 *
 * 拆分原则遵循 architecture.md §3.3.1：
 * - 第 2 条「service 导出方式」——集中 routes + service 便于一行导入
 * - 第 3 条「向后兼容的 import 路径」——上层可继续 `from '../api'` 访问
 */

export * from './types';
export { containersApi } from './containersApi';
export { vmMigrationApi } from './vmMigrationApi';
