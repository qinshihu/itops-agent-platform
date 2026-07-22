import { Router } from 'express';
import toolLinkRoutes from './routes/toolLinkRoutes';

const router = Router();
router.use('/tool-links', toolLinkRoutes);

export default router;
