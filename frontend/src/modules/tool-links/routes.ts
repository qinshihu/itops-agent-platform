/**
 * Tool-links 模块路由
 *
 * 从原 infra/routes.ts 抽离（2026-07-08 增量-12）。
 *
 * 注：包含两个页面：
 * - /tool-links：工具链接展示页（公共访问）
 * - /tool-links-manage：工具链接管理页（管理员）
 */

import { lazy } from 'react';

const ToolLinks = lazy(() => import('./pages/ToolLinks'));
const ToolLinksManage = lazy(() => import('./pages/tool-links-manage/index'));

export const toolLinksRoutes = [
  { path: 'tool-links', element: ToolLinks },
  { path: 'tool-links-manage', element: ToolLinksManage },
];
