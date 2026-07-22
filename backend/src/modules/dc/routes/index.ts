import { Router } from 'express';
import roomsRouter from './rooms';
import racksRouter from './racks';
import slotsRouter from './slots';
import lifecycleRouter from './lifecycle';
import pdusRouter from './pdus';
import overviewRouter from './overview';
import devicesRouter from './devices';
import { exportRouter, importRouter } from './exportImport';
import manufacturersRouter from './manufacturers';
import deviceTypesRouter from './deviceTypes';
import powerPanelsRouter from './powerPanels';
import powerFeedsRouter from './powerFeeds';
import cablesRouter from './cables';

const router = Router();

// 每个模块挂载到对应的子路径
router.use('/rooms', roomsRouter);
router.use('/racks', racksRouter);
router.use('/slots', slotsRouter);
router.use('/lifecycle', lifecycleRouter);
router.use('/pdus', pdusRouter);
router.use('/overview', overviewRouter);
router.use('/devices', devicesRouter);
router.use('/export', exportRouter);
router.use('/import', importRouter);
router.use('/manufacturers', manufacturersRouter);
router.use('/device-types', deviceTypesRouter);
router.use('/power-panels', powerPanelsRouter);
router.use('/power-feeds', powerFeedsRouter);
router.use('/cables', cablesRouter);

// GET /health — 快速检查路由是否存活
router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'DC routes OK' });
});

export default router;
