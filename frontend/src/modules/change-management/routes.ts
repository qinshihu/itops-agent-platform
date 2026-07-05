import { lazy } from 'react';

const Approvals = lazy(() => import('./pages/Approvals'));

export const changeManagementRoutes = [
  { path: 'approvals', element: Approvals },
];
