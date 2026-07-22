/**
 * =============================================================================
 * Agent API 路由（Re-export，2026-07-21 拆分后）
 * =============================================================================
 *
 * 原 agentRoutes.ts 577 行（含 159 行未提交扩展）已拆分为以下 6 个子路由文件：
 * - crudRoutes / statsRoutes / executionRoutes / importExportRoutes / toolRoutes
 * - index.ts 编排全部 router.use()
 *
 * 保留此文件作为向后兼容的 re-export 入口（架构 §3.3.1 第 3 条）。
 * 调用方：`import agentRoutes from '../routes/agentRoutes'` 仍兼容。
 */
export { default } from './agent';
