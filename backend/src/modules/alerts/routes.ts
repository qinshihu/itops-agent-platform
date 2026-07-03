import { Router } from 'express';
import alertRoutes from './routes/alertRoutes';
import alertMappingRoutes from './routes/alertMappingRoutes';
import alertNoiseRoutes from './routes/alertNoiseRoutes';
import alertAutoResponseRoutes from './routes/alertAutoResponseRoutes';
import alertAutoRoutes from './routes/alertAutoRoutes';
import alertCorrelationRoutes from './routes/alertCorrelationRoutes';

const router = Router();

router.use('/alerts', alertRoutes);
router.use('/alert-mappings', alertMappingRoutes);
router.use('/alert-noise', alertNoiseRoutes);
router.use('/alert-auto-response', alertAutoResponseRoutes);

export default router;
export const alertAutoRouter = alertAutoRoutes;
export const alertCorrelationRouter = alertCorrelationRoutes;
