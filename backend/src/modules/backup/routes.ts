import { Router } from 'express';
import backupRoutes from './routes/backupRoutes';

const router = Router();

router.use('/backups', backupRoutes);

export default router;
