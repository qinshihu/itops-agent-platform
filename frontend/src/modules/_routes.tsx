/**
 * 前端路由聚合（23 个 DDD 限界上下文模块）
 *
 * 所有模块路由在此统一导出，App.tsx 只需导入此文件
 * 新增模块路由只需：
 * 1. 在模块目录下创建 routes.ts（mcp 例外，使用 routes.tsx）
 * 2. 在此文件中添加一行 import 和展开
 *
 * **模块清单（2026-07-08 增量-12：从 18 个扩展到 23 个）**：
 * - 原 18 个模块保留
 * - P1-6 backend 拆分后，新增 5 个 frontend 对应模块：
 *   audit / settings / scripts / tool-links / import-export
 *
 * **mcp/ 例外（ADR-014）**：
 * - 所有 23 个模块中，只有 `mcp/` 使用 `routes.tsx`（其余 22 个均使用 `routes.ts`）
 * - 原因：mcp 模块需要在路由文件中复用 React Context（Portal/Tooltip 等），
 *   而 routes.ts 只导出 Router 实例，无法承载 JSX
 * - 历史决策见 `.trae/adr/014-mcp-routes-tsx-exception.md`
 * - 若未来需重命名或拆分 mcp 模块，可考虑改回 routes.ts（ADR-014 标记为"待评估"）
 */

import { aiRoutes } from './ai/routes';
import { alertRoutes } from './alerts/routes';
import { authRoutes, publicRoutes } from './auth/routes';
import { auditRoutes } from './audit/routes';
import { autoRoutes } from './auto/routes';
import { backupRoutes } from './backup/routes';
import { changeManagementRoutes } from './change-management/routes';
import { configManagementRoutes } from './config-management/routes';
import { containerRoutes } from './containers/routes';
import { databaseRoutes } from './database/routes';
import { dcRoutes } from './dc/routes';
import { importExportRoutes } from './import-export/routes';
import { infraRoutes } from './infra/routes';
import { kubernetesRoutes } from './kubernetes/routes';
import { mcpRoutes } from './mcp/routes';
import { monitorRoutes } from './monitor/routes';
import { networkRoutes } from './network/routes';
import { notificationRoutes } from './notification/routes';
import { scriptsRoutes } from './scripts/routes';
import { serverRoutes } from './servers/routes';
import { settingsRoutes } from './settings/routes';
import { toolLinksRoutes } from './tool-links/routes';
import { workflowRoutes } from './workflow/routes';

// === 共享页面路由 ===
import { lazy } from 'react';
const FrontendTests = lazy(() => import('../shared/pages/FrontendTests'));

/**
 * 受保护的路由（需要登录）
 */
export const protectedRoutes = [
  ...aiRoutes,
  ...alertRoutes,
  ...authRoutes,
  ...auditRoutes,
  ...autoRoutes,
  ...backupRoutes,
  ...changeManagementRoutes,
  ...configManagementRoutes,
  ...containerRoutes,
  ...databaseRoutes,
  ...dcRoutes,
  ...importExportRoutes,
  ...infraRoutes,
  ...kubernetesRoutes,
  ...mcpRoutes,
  ...monitorRoutes,
  ...networkRoutes,
  ...notificationRoutes,
  ...scriptsRoutes,
  ...serverRoutes,
  ...settingsRoutes,
  ...toolLinksRoutes,
  ...workflowRoutes,
  { path: 'frontend-tests', element: <FrontendTests /> },
];

/**
 * 公开路由（不需要登录）
 */
export { publicRoutes };
