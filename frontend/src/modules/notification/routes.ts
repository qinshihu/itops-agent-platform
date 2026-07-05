import { lazy } from 'react';

const Notifications = lazy(() => import('./pages/Notifications'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));

export const notificationRoutes = [
  { path: 'notifications', element: Notifications },
  { path: 'notifications/settings', element: NotificationSettings },
];
