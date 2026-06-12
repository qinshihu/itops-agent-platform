import { Router, Request, Response } from 'express';
import { networkDiscoveryService } from '../services/networkDiscoveryService';
import { requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// ====================== 扫描任务管理 ======================

// 获取所有扫描任务
router.get('/network-discovery/jobs', (_req: Request, res: Response) => {
  try {
    const jobs = networkDiscoveryService.getJobs();
    res.json({ success: true, data: jobs });
  } catch (err: any) {
    logger.error('Failed to get discovery jobs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取单个任务详情
router.get('/network-discovery/jobs/:id', (req: Request, res: Response) => {
  try {
    const job = networkDiscoveryService.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: '任务不存在' });
    res.json({ success: true, data: job });
  } catch (err: any) {
    logger.error('Failed to get discovery job:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 创建并启动扫描任务
router.post('/network-discovery/jobs', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, start_ip, end_ip, credential_ids } = req.body;
    if (!name || !start_ip || !end_ip) {
      return res.status(400).json({ success: false, error: 'name, start_ip, end_ip are required' });
    }

    const job = networkDiscoveryService.createJob(name, start_ip, end_ip, credential_ids || []);

    // 异步启动扫描
    networkDiscoveryService.startJob(job.id).catch(err => {
      logger.error(`Discovery job ${job.id} failed:`, err);
    });

    res.json({ success: true, data: job });
  } catch (err: any) {
    logger.error('Failed to create discovery job:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 取消扫描任务
router.post('/network-discovery/jobs/:id/cancel', requireRole('admin'), (req: Request, res: Response) => {
  try {
    networkDiscoveryService.cancelJob(req.params.id);
    res.json({ success: true, message: '任务已取消' });
  } catch (err: any) {
    logger.error('Failed to cancel discovery job:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除扫描任务
router.delete('/network-discovery/jobs/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    networkDiscoveryService.deleteJob(req.params.id);
    res.json({ success: true, message: '任务已删除' });
  } catch (err: any) {
    logger.error('Failed to delete discovery job:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== 扫描结果管理 ======================

// 获取扫描结果
router.get('/network-discovery/results', (req: Request, res: Response) => {
  try {
    const jobId = req.query.jobId as string;
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const { results, total } = networkDiscoveryService.getResults({ jobId, status, limit, offset });
    res.json({ success: true, data: results, total });
  } catch (err: any) {
    logger.error('Failed to get discovery results:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 将发现结果导入设备库
router.post('/network-discovery/import', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { result_ids, ssh_username, ssh_password, ssh_port } = req.body;
    if (!result_ids || !Array.isArray(result_ids) || result_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'result_ids array is required' });
    }

    const result = networkDiscoveryService.importToDevices(result_ids, ssh_username, ssh_password, ssh_port);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to import discovery results:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
