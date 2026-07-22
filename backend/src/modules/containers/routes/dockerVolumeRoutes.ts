/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Docker Volume 管理 - 路由
 *
 * Docker daemon 管理的容器卷（与 storage_volumes 表的"存储卷"是不同概念）。
 * 挂载在 /docker-volumes。
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import Docker from 'dockerode';
import { dockerService } from '../services/dockerService';
import { multiHostDockerService } from '../services/multiHostDockerService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage, getErrorStatusCode } from '../../../utils/errorHelpers';

const router = Router();

const localDocker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

function getDocker(req: Request): Docker {
  const endpointId = req.query.endpointId as string | undefined;
  if (endpointId) {
    try {
      return multiHostDockerService.getDockerClient(endpointId);
    } catch {
      throw Object.assign(new Error('指定的 Docker 端点不可用'), { statusCode: 503 });
    }
  }
  return localDocker;
}

function checkDockerAvailable(res: Response): boolean {
  if (!dockerService.isAvailable()) {
    res.status(503).json({ success: false, message: 'Docker 服务不可用' });
    return false;
  }
  return true;
}

// GET / — Docker Volume 列表
router.get('/', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;
  try {
    const d = getDocker(req);
    const result = await d.listVolumes();
    res.json({ success: true, data: result.Volumes || [] });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST / — 创建 Docker Volume
router.post('/', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;
  try {
    const { name, driver, labels } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '缺少卷名称' });
    const d = getDocker(req);
    const volume = await d.createVolume({
      Name: name,
      Driver: driver || 'local',
      Labels: labels || {},
    });
    res.json({ success: true, data: volume });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error) || 500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /prune — 清理未使用卷
router.post('/prune', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;
  try {
    const d = getDocker(req);
    const result = await (d as any).pruneVolumes();
    res.json({
      success: true,
      data: {
        volumesDeleted: result.VolumesDeleted || [],
        spaceReclaimed: result.SpaceReclaimed || 0,
      },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error) || 500).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /:name — Docker Volume 详情
router.get('/:name', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;
  try {
    const d = getDocker(req);
    const volume = d.getVolume(req.params.name);
    const data = await volume.inspect();
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error) || 404).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /:name — 删除 Docker Volume
router.delete('/:name', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;
  try {
    const d = getDocker(req);
    const vol = d.getVolume(req.params.name);
    const force = req.query.force === 'true';
    await vol.remove({ force });
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error) || 500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
