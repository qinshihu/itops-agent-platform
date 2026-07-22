/**
 * Infra 模块路由（精简版）
 *
 * 原 infra/ 模块在 backend P1-6 拆分后，frontend 同步拆分为 5 个新模块（2026-07-08 增量-12）：
 * - audit / settings / scripts / tool-links / import-export
 *
 * 当前 infra/ 仅保留：
 * - /tools：frontend 特有的"工具"页面（与 backend tool-links/ 不同，是 Agent 工具测试 UI）
 * - /tools/manage：工具管理（待 P1-9 进一步拆分）
 *
 * 注：原 infra/routes.ts 中的 'scripts' / 'audit' / 'settings' / 'tool-links' / 'tool-links-manage'
 * 已迁移到对应新模块的 routes.ts。
 */

import { lazy } from 'react';

const Tools = lazy(() => import('./pages/Tools'));

export const infraRoutes = [
  { path: 'tools', element: Tools },
];
