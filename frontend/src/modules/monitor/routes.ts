import { lazy } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Reports = lazy(() => import('./pages/Reports'));
const BigScreenDashboard = lazy(() => import('./pages/BigScreenDashboard'));
const CostAnalysis = lazy(() => import('./pages/CostAnalysis'));
const PrometheusQuery = lazy(() => import('./pages/PrometheusQuery'));
const ZabbixQuery = lazy(() => import('./pages/ZabbixQuery'));

export const monitorRoutes = [
  { path: 'dashboard', element: Dashboard },
  { path: 'reports', element: Reports },
  { path: 'big-screen', element: BigScreenDashboard },
  { path: 'cost-analysis', element: CostAnalysis },
  { path: 'prometheus', element: PrometheusQuery },
  { path: 'zabbix', element: ZabbixQuery },
];
