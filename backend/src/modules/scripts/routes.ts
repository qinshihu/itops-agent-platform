import { Router } from 'express';
import scriptRoutes from './routes/scriptRoutes';

const router = Router();
router.use('/', scriptRoutes);

export default router;
