/**
 * Import-export 模块路由
 *
 * 从原 infra/components/ImportExport.tsx 抽离（2026-07-08 增量-12）。
 *
 * 注：ImportExport 是个有状态组件，被其他模块页面引用（如 Servers/Alerts 页）。
 * 本模块提供一个"导入导出"演示页 + 组件导出，供其他模块复用。
 */

import { lazy } from 'react';

const ImportExportDemo = lazy(() => import('./pages/ImportExportDemo'));

export const importExportRoutes = [
  { path: 'import-export-demo', element: ImportExportDemo },
];
