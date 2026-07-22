import { Router } from 'express';
import auditRoutes from './routes/auditRoutes';

const router = Router();
router.use('/', auditRoutes);

export default router;
