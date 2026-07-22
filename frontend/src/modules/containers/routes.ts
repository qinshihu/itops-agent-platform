import { lazy } from 'react';

const Containers = lazy(() => import('./pages/Containers'));
const ContainerMonitor = lazy(() => import('./pages/ContainerMonitor'));
const ContainerLogs = lazy(() => import('./pages/ContainerLogs'));
const Images = lazy(() => import('./pages/Images'));
const VirtualMachines = lazy(() => import('./pages/VirtualMachines'));
const Volumes = lazy(() => import('./pages/Volumes'));
const ComposeEditor = lazy(() => import('./pages/ComposeEditor'));
const SnapshotPolicies = lazy(() => import('./pages/SnapshotPolicies'));
const ImageRegistry = lazy(() => import('./pages/ImageRegistry'));
const VMMigrations = lazy(() => import('./pages/VMMigrations'));

export const containerRoutes = [
  { path: 'containers', element: Containers },
  { path: 'container-monitor', element: ContainerMonitor },
  { path: 'container-logs', element: ContainerLogs },
  { path: 'images', element: Images },
  { path: 'virtual-machines', element: VirtualMachines },
  { path: 'volumes', element: Volumes },
  { path: 'compose', element: ComposeEditor },
  { path: 'snapshot-policies', element: SnapshotPolicies },
  { path: 'image-registry', element: ImageRegistry },
  { path: 'vm-migrations', element: VMMigrations },
];
