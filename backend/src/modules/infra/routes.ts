import { Router } from 'express';
import settingsRoutes from './routes/settingsRoutes';
import scriptRoutes from './routes/scriptRoutes';
import auditRoutes from './routes/auditRoutes';
import importExportRouter from './routes/importExportRoutes';
import toolLinkRoutes from './routes/toolLinkRoutes';
import linkageRoutes from './routes/linkageRoutes';

const router = Router();

router.use('/settings', settingsRoutes);
router.use('/scripts', scriptRoutes);
router.use('/audit', auditRoutes);
router.use('/import-export', importExportRouter);
router.use('/tool-links', toolLinkRoutes);

export default router;
export const linkageRouter = linkageRoutes;
