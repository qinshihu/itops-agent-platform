import { lazy } from 'react';

const BackupSettings = lazy(() => import('./pages/BackupSettings'));

export const backupRoutes = [
  { path: 'backups', element: BackupSettings },
];
