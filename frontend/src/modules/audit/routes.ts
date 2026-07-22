/**
 * Audit 模块路由
 *
 * 从原 infra/routes.ts 抽离（2026-07-08 增量-12）。
 */

import { lazy } from 'react';

const AuditLogs = lazy(() => import('./pages/AuditLogs'));

export const auditRoutes = [
  { path: 'audit', element: AuditLogs },
];
