import { Router } from 'express';
import linkageRoutes from './routes/linkageRoutes';

const router = Router();
router.use('/', linkageRoutes);

export default router;
