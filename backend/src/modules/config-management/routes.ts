import { Router } from 'express';
import configTemplateRoutes from './routes/configTemplateRoutes';
import configRepairRoutes from './routes/configRepairRoutes';
import composeRoutes from './routes/composeRoutes';

const router = Router();

router.use('/config-templates', configTemplateRoutes);
router.use('/config-repair', configRepairRoutes);
router.use('/compose', composeRoutes);

export default router;
