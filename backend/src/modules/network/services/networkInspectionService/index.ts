/**
 * networkInspectionService 子模块 barrel export（2026-07-21 拆分）
 *
 * 主导出：inspectDevice + batchInspect（2 个公开入口）
 * 其余私有 helpers（executionOps / shellOps / summaryOps）仅在子模块内部使用，
 * 不通过 barrel 暴露（保持主类 private 语义）。
 */
export { inspectDevice, batchInspect } from './inspectionOps';
