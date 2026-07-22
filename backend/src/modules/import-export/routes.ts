import { Router } from 'express';
import importExportRoutes from './routes/importExportRoutes';

const router = Router();
router.use('/import-export', importExportRoutes);

export default router;
