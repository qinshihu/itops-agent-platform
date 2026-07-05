import { Router } from 'express';
import changeRoutes from './routes/changeRoutes';
import approvalRoutes from './routes/approvalRoutes';

const router = Router();

router.use('/changes', changeRoutes);
router.use('/approvals', approvalRoutes);

export default router;
