import { Router } from 'express';
import settingsRoutes from './routes/settingsRoutes';
import scriptRoutes from './routes/scriptRoutes';
import auditRoutes from './routes/auditRoutes';
import notificationRoutes from './routes/notificationRoutes';
import notificationConfigRoutes from './routes/notificationConfigRoutes';
import backupRoutes from './routes/backupRoutes';
import changeRoutes from './routes/changeRoutes';
import approvalRoutes from './routes/approvalRoutes';
import importExportRouter from './routes/importExportRoutes';
import configRepairRoutes from './routes/configRepairRoutes';
import configTemplateRoutes from './routes/configTemplateRoutes';
import toolLinkRoutes from './routes/toolLinkRoutes';
import composeRoutes from './routes/composeRoutes';
import snapshotPolicyRoutes from './routes/snapshotPolicyRoutes';
import linkageRoutes from './routes/linkageRoutes';
import webhookRoutes from './routes/webhookRoutes';

const router = Router();

router.use('/settings', settingsRoutes);
router.use('/scripts', scriptRoutes);
router.use('/audit', auditRoutes);
router.use('/notifications', notificationRoutes);
router.use('/notification-config', notificationConfigRoutes);
router.use('/backups', backupRoutes);
router.use('/changes', changeRoutes);
router.use('/approvals', approvalRoutes);
router.use('/import-export', importExportRouter);
router.use('/config-repair', configRepairRoutes);
router.use('/config-templates', configTemplateRoutes);
router.use('/tool-links', toolLinkRoutes);
router.use('/compose', composeRoutes);
router.use('/snapshot-policies', snapshotPolicyRoutes);

export default router;
export const linkageRouter = linkageRoutes;
export const webhookRouter = webhookRoutes;
