/**
 * =============================================================================
 * 虚拟机管理 - 路由聚合入口
 * =============================================================================
 */

import { Router } from 'express';
import platformRoutes from './platformRoutes';
import vmRoutes from './vmRoutes';
import snapshotRoutes from './snapshotRoutes';
import templateRoutes from './templateRoutes';
import infrastructureRoutes from './infrastructureRoutes';
import auditRoutes from './auditRoutes';

const router = Router();

router.use(platformRoutes);
router.use(vmRoutes);
router.use(snapshotRoutes);
router.use(templateRoutes);
router.use(infrastructureRoutes);
router.use(auditRoutes);

export default router;