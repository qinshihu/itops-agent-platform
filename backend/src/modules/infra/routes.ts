/**
 * infra 模块路由聚合入口
 *
 * 阶段：P1-6 infra 按子域拆分（2026-07-07）
 *
 * 当前状态：infra 模块的所有 HTTP 路由已抽离到独立子域：
 *   - tool-links/    (toolLinkRoutes.ts + toolLinkCrudService.ts)
 *   - linkage/       (linkageRoutes.ts + linkageService.ts)
 *   - import-export/ (importExportRoutes.ts + importExportService.ts)
 *
 * infra/ 模块现在仅保留系统级服务：
 *   - restartService.ts（优雅重启 + 关闭钩子注册）
 *
 * 此文件保留为空路由以兼容 _registry.ts 历史注册，
 * 实际已无任何路由可挂载（mount '/api/v1', 会被 Express 忽略空 router）。
 */
import { Router } from 'express';

const router = Router();

export default router;
