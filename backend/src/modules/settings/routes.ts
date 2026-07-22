import { Router } from 'express';
import settingsRoutes from './routes/settingsRoutes';

const router = Router();
router.use('/settings', settingsRoutes);

export default router;
