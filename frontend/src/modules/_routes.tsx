/**
 * 前端路由聚合（18 个 DDD 限界上下文模块）
 * 
 * 所有模块路由在此统一导出，App.tsx 只需导入此文件
 * 新增模块路由只需：
 * 1. 在模块目录下创建 routes.ts
 * 2. 在此文件中添加一行 import 和展开
 */

import { aiRoutes } from './ai/routes';
import { alertRoutes } from './alerts/routes';
import { authRoutes, publicRoutes } from './auth/routes';
import { autoRoutes } from './auto/routes';
import { backupRoutes } from './backup/routes';
import { changeManagementRoutes } from './change-management/routes';
import { configManagementRoutes } from './config-management/routes';
import { containerRoutes } from './containers/routes';
import { databaseRoutes } from './database/routes';
import { dcRoutes } from './dc/routes';
import { infraRoutes } from './infra/routes';
import { kubernetesRoutes } from './kubernetes/routes';
import { mcpRoutes } from './mcp/routes';
import { monitorRoutes } from './monitor/routes';
import { networkRoutes } from './network/routes';
import { notificationRoutes } from './notification/routes';
import { serverRoutes } from './servers/routes';
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
  ...autoRoutes,
  ...backupRoutes,
  ...changeManagementRoutes,
  ...configManagementRoutes,
  ...containerRoutes,
  ...databaseRoutes,
  ...dcRoutes,
  ...infraRoutes,
  ...kubernetesRoutes,
  ...mcpRoutes,
  ...monitorRoutes,
  ...networkRoutes,
  ...notificationRoutes,
  ...serverRoutes,
  ...workflowRoutes,
  { path: 'frontend-tests', element: <FrontendTests /> },
];

/**
 * 公开路由（不需要登录）
 */
export { publicRoutes };
