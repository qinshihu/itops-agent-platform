import type { Request, Response } from 'express';
import { Router } from 'express';
import { dockerService } from '../services/dockerService';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';

const router = Router();

/**
 * 中间件：标记本路由下的接口已弃用，请使用 /api/v1/containers/*
 */
router.use((_req: Request, res: Response, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('X-Deprecated-Notice', '此 /api/v1/docker/* 路径已弃用，请改用 /api/v1/containers/*');
  next();
});

// 检查 Docker 服务是否可用
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const available = dockerService.isAvailable();
    if (!available) {
      const initialized = await dockerService.init();
      return res.json({
        success: true,
        data: {
          available: initialized,
          message: initialized ? 'Docker service is available' : 'Docker socket not accessible'
        }
      });
    }
    res.json({ success: true, data: { available: true, message: 'Docker service is available' } });
  } catch (error) {
    logger.error('Error checking Docker status:', error);
    res.json({ success: true, data: { available: false, message: 'Docker service not available' } });
  }
});

// ==================== 容器管理 API ====================

// 获取容器列表
router.get('/containers', async (req: Request, res: Response) => {
  try {
    const all = req.query.all !== 'false';
    const containers = await dockerService.listContainers(all);
    res.json({ success: true, data: containers });
  } catch (error) {
    logger.error('Error listing containers:', error);
    res.status(500).json({ success: false, error: 'Failed to list containers' });
  }
});

// 获取容器详情
router.get('/containers/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const container = await dockerService.getContainer(req.params.id);
    res.json({ success: true, data: container });
  } catch (error) {
    logger.error('Error getting container:', error);
    res.status(500).json({ success: false, error: 'Failed to get container details' });
  }
});

// 启动容器
router.post('/containers/:id/start', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    await dockerService.startContainer(req.params.id);
    res.json({ success: true, message: 'Container started successfully' });
  } catch (error) {
    logger.error('Error starting container:', error);
    res.status(500).json({ success: false, error: 'Failed to start container' });
  }
});

// 停止容器
router.post('/containers/:id/stop', async (req: Request, res: Response) => {
  try {
    const timeout = req.body.timeout || 10;
    await dockerService.stopContainer(req.params.id, timeout);
    res.json({ success: true, message: 'Container stopped successfully' });
  } catch (error) {
    logger.error('Error stopping container:', error);
    res.status(500).json({ success: false, error: 'Failed to stop container' });
  }
});

// 重启容器
router.post('/containers/:id/restart', async (req: Request, res: Response) => {
  try {
    const timeout = req.body.timeout || 10;
    await dockerService.restartContainer(req.params.id, timeout);
    res.json({ success: true, message: 'Container restarted successfully' });
  } catch (error) {
    logger.error('Error restarting container:', error);
    res.status(500).json({ success: false, error: 'Failed to restart container' });
  }
});

// 删除容器
router.delete('/containers/:id', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const v = req.query.v === 'true';
    await dockerService.removeContainer(req.params.id, force, v);
    res.json({ success: true, message: 'Container removed successfully' });
  } catch (error) {
    logger.error('Error removing container:', error);
    res.status(500).json({ success: false, error: 'Failed to remove container' });
  }
});

// 获取容器日志
router.get('/containers/:id/logs', async (req: Request, res: Response) => {
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const timestamps = req.query.timestamps !== 'false';
    const logs = await dockerService.getContainerLogs(req.params.id, tail, timestamps);
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Error getting container logs:', error);
    res.status(500).json({ success: false, error: 'Failed to get container logs' });
  }
});

// 获取容器统计信息
router.get('/containers/:id/stats', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const stats = await dockerService.getContainerStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error getting container stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get container stats' });
  }
});

// 暂停容器
router.post('/containers/:id/pause', async (req: Request, res: Response) => {
  try {
    await dockerService.pauseContainer(req.params.id);
    res.json({ success: true, message: 'Container paused successfully' });
  } catch (error) {
    logger.error('Error pausing container:', error);
    res.status(500).json({ success: false, error: 'Failed to pause container' });
  }
});

// 恢复容器
router.post('/containers/:id/unpause', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    await dockerService.unpauseContainer(req.params.id);
    res.json({ success: true, message: 'Container unpaused successfully' });
  } catch (error) {
    logger.error('Error unpausing container:', error);
    res.status(500).json({ success: false, error: 'Failed to unpause container' });
  }
});

// ==================== 镜像管理 API ====================

// 获取镜像列表
router.get('/images', async (_req: Request, res: Response) => {
  try {
    const images = await dockerService.listImages();
    res.json({ success: true, data: images });
  } catch (error) {
    logger.error('Error listing images:', error);
    res.status(500).json({ success: false, error: 'Failed to list images' });
  }
});

// 拉取镜像
router.post('/images/pull', async (req: Request, res: Response) => {
  try {
    const { imageName } = req.body;
    if (!imageName) {
      return res.status(400).json({ success: false, error: 'Image name is required' });
    }
    
    await dockerService.pullImage(imageName);
    res.json({ success: true, message: `Image ${imageName} pulled successfully` });
  } catch (error) {
    logger.error('Error pulling image:', error);
    res.status(500).json({ success: false, error: 'Failed to pull image' });
  }
});

// 删除镜像
router.delete('/images/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const noprune = req.query.noprune === 'true';
    await dockerService.removeImage(req.params.id, force, noprune);
    res.json({ success: true, message: 'Image removed successfully' });
  } catch (error) {
    logger.error('Error removing image:', error);
    res.status(500).json({ success: false, error: 'Failed to remove image' });
  }
});

// 获取镜像详情
router.get('/images/:id', async (req: Request, res: Response) => {
  try {
    const image = await dockerService.getImageInfo(req.params.id);
    res.json({ success: true, data: image });
  } catch (error) {
    logger.error('Error getting image info:', error);
    res.status(500).json({ success: false, error: 'Failed to get image details' });
  }
});

// ==================== 卷管理 API ====================

// 获取卷列表
router.get('/volumes', requireRole('admin', 'operator'), async (_req: Request, res: Response) => {
  try {
    const volumes = await dockerService.listVolumes();
    res.json({ success: true, data: volumes });
  } catch (error) {
    logger.error('Error listing volumes:', error);
    res.status(500).json({ success: false, error: 'Failed to list volumes' });
  }
});

// 创建卷
router.post('/volumes', async (req: Request, res: Response) => {
  try {
    const { name, driver = 'local', labels = {} } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Volume name is required' });
    }
    
    const volume = await dockerService.createVolume(name, driver, labels);
    res.json({ success: true, data: volume, message: 'Volume created successfully' });
  } catch (error) {
    logger.error('Error creating volume:', error);
    res.status(500).json({ success: false, error: 'Failed to create volume' });
  }
});

// 删除卷
router.delete('/volumes/:name', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    await dockerService.removeVolume(req.params.name, force);
    res.json({ success: true, message: 'Volume removed successfully' });
  } catch (error) {
    logger.error('Error removing volume:', error);
    res.status(500).json({ success: false, error: 'Failed to remove volume' });
  }
});

// 获取卷详情
router.get('/volumes/:name', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const volume = await dockerService.getVolume(req.params.name);
    res.json({ success: true, data: volume });
  } catch (error) {
    logger.error('Error getting volume:', error);
    res.status(500).json({ success: false, error: 'Failed to get volume details' });
  }
});

// ==================== 网络管理 API ====================

// 获取网络列表
router.get('/networks', async (_req: Request, res: Response) => {
  try {
    const networks = await dockerService.listNetworks();
    res.json({ success: true, data: networks });
  } catch (error) {
    logger.error('Error listing networks:', error);
    res.status(500).json({ success: false, error: 'Failed to list networks' });
  }
});

// 创建网络
router.post('/networks', async (req: Request, res: Response) => {
  try {
    const { name, driver = 'bridge', options = {} } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Network name is required' });
    }
    
    const network = await dockerService.createNetwork(name, driver, options);
    res.json({ success: true, data: network, message: 'Network created successfully' });
  } catch (error) {
    logger.error('Error creating network:', error);
    res.status(500).json({ success: false, error: 'Failed to create network' });
  }
});

// 删除网络
router.delete('/networks/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    await dockerService.removeNetwork(req.params.id);
    res.json({ success: true, message: 'Network removed successfully' });
  } catch (error) {
    logger.error('Error removing network:', error);
    res.status(500).json({ success: false, error: 'Failed to remove network' });
  }
});

// 获取网络详情
router.get('/networks/:id', async (req: Request, res: Response) => {
  try {
    const network = await dockerService.getNetwork(req.params.id);
    res.json({ success: true, data: network });
  } catch (error) {
    logger.error('Error getting network:', error);
    res.status(500).json({ success: false, error: 'Failed to get network details' });
  }
});

// 将容器连接到网络
router.post('/networks/:id/connect', async (req: Request, res: Response) => {
  try {
    const { containerId } = req.body;
    if (!containerId) {
      return res.status(400).json({ success: false, error: 'Container ID is required' });
    }
    
    await dockerService.connectContainerToNetwork(req.params.id, containerId);
    res.json({ success: true, message: 'Container connected to network successfully' });
  } catch (error) {
    logger.error('Error connecting container to network:', error);
    res.status(500).json({ success: false, error: 'Failed to connect container to network' });
  }
});

// 将容器从网络断开
router.post('/networks/:id/disconnect', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { containerId } = req.body;
    if (!containerId) {
      return res.status(400).json({ success: false, error: 'Container ID is required' });
    }
    
    await dockerService.disconnectContainerFromNetwork(req.params.id, containerId);
    res.json({ success: true, message: 'Container disconnected from network successfully' });
  } catch (error) {
    logger.error('Error disconnecting container from network:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect container from network' });
  }
});

// ==================== 系统信息 API ====================

// 获取 Docker 系统信息
router.get('/info', requireRole('admin', 'operator'), async (_req: Request, res: Response) => {
  try {
    const info = await dockerService.getSystemInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    logger.error('Error getting Docker info:', error);
    res.status(500).json({ success: false, error: 'Failed to get Docker system info' });
  }
});

// 获取 Docker 版本信息
router.get('/version', requireRole('admin', 'operator'), async (_req: Request, res: Response) => {
  try {
    const version = await dockerService.getVersion();
    res.json({ success: true, data: version });
  } catch (error) {
    logger.error('Error getting Docker version:', error);
    res.status(500).json({ success: false, error: 'Failed to get Docker version' });
  }
});

export default router;
