import { Router, Request, Response } from 'express';
import { configBackupService } from '../services/configBackupService';
import { lldpDiscoveryService } from '../services/lldpDiscoveryService';
import { logger } from '../utils/logger';

const router = Router();

// ================================================================
// 配置备份 API
// ================================================================

// 备份指定设备
router.post('/backup/:deviceId', async (req: Request, res: Response) => {
  try {
    const result = await configBackupService.backupDevice(req.params.deviceId);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 批量备份所有在线设备
router.post('/backup-all', async (_req: Request, res: Response) => {
  try {
    const result = await configBackupService.backupAllOnlineDevices();
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 获取设备备份历史
router.get('/backup-history/:deviceId', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 30;
  const history = configBackupService.getBackupHistory(req.params.deviceId, limit);
  res.json({ code: 0, data: history });
});

// 读取备份内容
router.get('/backup-content/:backupId', (req: Request, res: Response) => {
  const content = configBackupService.getBackupContent(req.params.backupId);
  if (content === null) {
    return res.status(404).json({ code: -1, message: 'Backup not found' });
  }
  res.json({ code: 0, data: content });
});

// 对比两个备份版本
router.get('/backup-diff/:backupIdA/:backupIdB', (req: Request, res: Response) => {
  const diff = configBackupService.diffBackups(req.params.backupIdA, req.params.backupIdB);
  res.json({ code: 0, data: diff });
});

// 检查配置变更
router.post('/check-change/:deviceId', async (req: Request, res: Response) => {
  try {
    const result = await configBackupService.checkConfigChange(req.params.deviceId);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// ================================================================
// LLDP 邻居发现 API
// ================================================================

// 发现指定设备邻居
router.post('/lldp/:deviceId', async (req: Request, res: Response) => {
  try {
    const neighbors = await lldpDiscoveryService.discoverNeighbors(req.params.deviceId);
    res.json({ code: 0, data: neighbors });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 批量发现邻居
router.post('/lldp-batch', async (req: Request, res: Response) => {
  try {
    const { deviceIds } = req.body as { deviceIds: string[] };
    if (!deviceIds || !Array.isArray(deviceIds)) {
      return res.status(400).json({ code: -1, message: 'deviceIds array required' });
    }
    const result = await lldpDiscoveryService.batchDiscover(deviceIds);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 发现所有在线设备邻居
router.post('/lldp-all', async (_req: Request, res: Response) => {
  try {
    const result = await lldpDiscoveryService.discoverAll();
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  }
});

// 获取拓扑链路
router.get('/topology', (req: Request, res: Response) => {
  const deviceId = req.query.deviceId as string | undefined;
  const links = lldpDiscoveryService.getTopologyLinks(deviceId);
  res.json({ code: 0, data: links });
});

// 获取设备影响路径
router.get('/impact-path/:deviceId', (req: Request, res: Response) => {
  const maxHops = parseInt(req.query.maxHops as string) || 3;
  const path = lldpDiscoveryService.getImpactPath(req.params.deviceId, maxHops);
  res.json({ code: 0, data: path });
});

export default router;
