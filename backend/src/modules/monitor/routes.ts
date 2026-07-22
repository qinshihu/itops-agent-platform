import { Router } from 'express';
import reportRoutes from './routes/reportRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import monitorRoutes from './routes/monitorRoutes';
import costAnalysisRoutes from './routes/costAnalysisRoutes';
import prometheusRoutes from './routes/prometheusRoutes';
import zabbixRoutes from './routes/zabbixRoutes';

const router = Router();

router.use('/reports', reportRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/docker-monitor', monitorRoutes);
router.use('/cost-analysis', costAnalysisRoutes);
// 修复 READ-ME-001（2026-07-22）：prometheus/zabbix 子路由此前未挂载，导致前端 /monitor/prometheus 与 /monitor/zabbix API 404
router.use('/monitor/prometheus', prometheusRoutes);
router.use('/monitor/zabbix', zabbixRoutes);

export default router;
