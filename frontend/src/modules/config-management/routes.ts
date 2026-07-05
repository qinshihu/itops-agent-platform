import { lazy } from 'react';

const ConfigTemplates = lazy(() => import('./pages/ConfigTemplates'));

export const configManagementRoutes = [
  { path: 'config-templates', element: ConfigTemplates },
];
