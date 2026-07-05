import { Router } from 'express';
import notificationRoutes from './routes/notificationRoutes';
import notificationConfigRoutes from './routes/notificationConfigRoutes';

const router = Router();

router.use('/notifications', notificationRoutes);
router.use('/notification-config', notificationConfigRoutes);

export default router;
