/**
 * =============================================================================
 * Agent 路由聚合入口（2026-07-21 拆分）
 * =============================================================================
 *
 * 从原 agentRoutes.ts 单文件拆分为 6 个子路由文件：
 * - crudRoutes          (list / get / create / update / delete + executions list)
 * - statsRoutes         (stats summary + test-input)
 * - executionRoutes     (POST /:id/test - 测试执行)
 * - importExportRoutes  (import + export)
 * - toolRoutes          (tools/list + tools/test + tools/descriptions)
 * - presetTestInputs    (共享常量)
 *
 * 全部通过 router.use() 聚合到主 router：
 * - routes.ts 调用方：import agentRoutes from './agent' 仍兼容（agentRoutes.ts 是 re-export）
 * - HTTP 路径完全不变（架构 §3.3.1 第 1 条）
 */

import { Router } from 'express';
import crudRoutes from './crudRoutes';
import statsRoutes from './statsRoutes';
import executionRoutes from './executionRoutes';
import importExportRoutes from './importExportRoutes';
import toolRoutes from './toolRoutes';

const router = Router();

router.use(crudRoutes);
router.use(statsRoutes);
router.use(executionRoutes);
router.use(importExportRoutes);
router.use(toolRoutes);

export default router;
