import type { Request, Response } from 'express';
import { Router } from 'express';
import { containerMonitorService } from '../../containers/services/containerMonitorService';
import { containerLogService } from '../../containers/services/containerLogService';
import { dockerService } from '../../containers/services/dockerService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// GET /cluster-snapshot - 获取所有运行容器的摘要统计
router.get('/cluster-snapshot', async (_req: Request, res: Response) => {
  try {
    if (!dockerService.isAvailable()) {
      return res.status(503).json({ success: false, message: 'Docker 服务不可用' });
    }
    const snapshot = await containerMonitorService.getClusterSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /monitored - 获取正在被监控的容器列表
router.get('/monitored', (_req: Request, res: Response) => {
  res.json({ success: true, data: containerMonitorService.getMonitoredContainers() });
});

// POST /start/:containerId - 开始监控容器
router.post('/start/:containerId', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { containerId } = req.params;
    const intervalMs = parseInt(req.body.intervalMs as string) || 5000;
    containerMonitorService.startMonitoring(containerId, intervalMs);
    res.json({ success: true, message: `已开始监控容器 ${containerId}` });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /stop/:containerId - 停止监控容器
router.post('/stop/:containerId', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    containerMonitorService.stopMonitoring(req.params.containerId);
    res.json({ success: true, message: '已停止监控' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /logs/active - 获取活跃日志流数量
router.get('/logs/active', (_req: Request, res: Response) => {
  res.json({ success: true, data: containerLogService.getActiveStreamCount() });
});

export default router;
