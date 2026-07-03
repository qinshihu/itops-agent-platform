import { lazy } from 'react';

const Scripts = lazy(() => import('./pages/Scripts'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Settings = lazy(() => import('./pages/Settings'));
const ToolLinks = lazy(() => import('./pages/ToolLinks'));
const Tools = lazy(() => import('./pages/Tools'));

export const infraRoutes = [
  { path: 'scripts', element: Scripts },
  { path: 'audit', element: AuditLogs },
  { path: 'settings', element: Settings },
  { path: 'tool-links', element: ToolLinks },
  { path: 'tools', element: Tools },
];
