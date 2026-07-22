/**
 * Scripts 模块路由
 *
 * 从原 infra/routes.ts 抽离（2026-07-08 增量-12）。
 */

import { lazy } from 'react';

const Scripts = lazy(() => import('./pages/Scripts'));

export const scriptsRoutes = [
  { path: 'scripts', element: Scripts },
];
