/**
 * 模块路由自动注册器
 *
 * 约定：每个模块的 routes.ts 导出 default router（主受保护路由）
 * 以及 named exports（需要不同中间件的特殊路由：public/webhook/special）。
 * _registry.ts 仅 import 各模块的 routes.ts，不直接钻 routes/ 子文件。
 */

import type { Express, Router } from 'express';
import { rateLimiter } from '../middleware/rateLimiter';
import { webhookIpFilter } from '../middleware/rateLimiter';
import { authenticateToken, requirePasswordChange } from '../middleware/auth';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';

// === 模块路由导入（仅从各模块的 routes.ts 导入）===
import aiRoutes from './ai/routes';
import alertRoutes, { alertAutoRouter, alertCorrelationRouter } from './alerts/routes';
import autoRoutes from './auto/routes';
import containerRoutes from './containers/routes';
import databaseRoutes from './database/routes';
import dcRoutes from './dc/routes';
import infraRoutes, { linkageRouter, webhookRouter } from './infra/routes';
import kubernetesRoutes from './kubernetes/routes';
import monitorRoutes from './monitor/routes';
import networkRoutes, { networkDiscoveryRouter } from './network/routes';
import serverRoutes from './servers/routes';
import workflowRoutes from './workflow/routes';

// === Auth 模块：auth 路由公开，user 路由受保护 ===
import { authOnlyRouter, userRouter } from './auth/routes';

interface ModuleConfig {
  path: string;
  router: Router;
  options?: { public?: boolean; webhook?: boolean; noRateLimit?: boolean };
}

/**
 * 模块路由配置表
 */
const modules: ModuleConfig[] = [
  // === 公开路由：auth + webhook ===
  { path: '/api/auth', router: authOnlyRouter, options: { public: true } },
  { path: '/api/webhooks', router: webhookRouter, options: { webhook: true } },

  // === 受保护路由（需要认证） ===
  { path: '/api', router: aiRoutes },
  { path: '/api', router: alertRoutes },
  { path: '/api', router: autoRoutes },
  { path: '/api', router: containerRoutes },
  { path: '/api', router: databaseRoutes },
  { path: '/api', router: dcRoutes },
  { path: '/api', router: infraRoutes },
  { path: '/api', router: kubernetesRoutes },
  { path: '/api', router: monitorRoutes },
  { path: '/api', router: networkRoutes },
  { path: '/api', router: serverRoutes },
  { path: '/api', router: workflowRoutes },
  { path: '/api/users', router: userRouter },

  // === 受保护特殊路由 ===
  { path: '/api', router: alertAutoRouter },
  { path: '/api', router: linkageRouter },
  { path: '/api', router: networkDiscoveryRouter },
  { path: '/api', router: alertCorrelationRouter },
];

/**
 * 注册所有模块路由到 Express 应用
 * 正确顺序：先公开路由，再加认证，再加受保护路由，最后挂载 errorHandler
 */
export function registerAllModules(app: Express): void {
  // 1. 注册公开/webhook 路由，无需认证！
  for (const mod of modules) {
    if (mod.options?.webhook) {
      app.use(mod.path, webhookIpFilter, rateLimiter, mod.router);
    } else if (mod.options?.public) {
      app.use(mod.path, rateLimiter, mod.router);
    }
  }

  // 2. 添加认证中间件，对后续所有受保护路由生效！
  app.use(authenticateToken);

  // 3. 添加密码变更检查中间件！
  app.use(requirePasswordChange);

  // 4. 注册所有受保护路由！
  for (const mod of modules) {
    if (!mod.options?.public && !mod.options?.webhook) {
      if (mod.options?.noRateLimit) {
        app.use(mod.path, mod.router);
      } else {
        app.use(mod.path, rateLimiter, mod.router);
      }
    }
  }

  // 5. 全局错误处理中间件（必须在所有路由之后）
  app.use(notFoundHandler);
  app.use(errorHandler);
}
