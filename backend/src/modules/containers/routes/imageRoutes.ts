/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { dockerService } from '../services/dockerService';
import { requireRole } from '../../../middleware/auth';
import Docker from 'dockerode';
import { getErrorMessage, getErrorStatusCode } from '../../../utils/errorHelpers';

const router = Router();

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

function checkDockerAvailable(res: Response): boolean {
  if (!dockerService.isAvailable()) {
    res.status(503).json({ success: false, message: 'Docker 服务不可用' });
    return false;
  }
  return true;
}

// GET / — 获取镜像列表
router.get('/', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = (req.query.search as string || '').toLowerCase();

    const allImages = await dockerService.listImages();

    let filtered = allImages;
    if (search) {
      filtered = filtered.filter(img =>
        img.repository.toLowerCase().includes(search) ||
        img.tag.toLowerCase().includes(search) ||
        (img.tags || []).some((t: string) => t.toLowerCase().includes(search))
      );
    }

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const data = filtered.slice(offset, offset + pageSize);

    res.json({ success: true, data, total });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /pull — 拉取镜像
router.post('/pull', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const { imageName } = req.body;
    if (!imageName) {
      return res.status(400).json({ success: false, message: '缺少镜像名称' });
    }

    await dockerService.pullImage(imageName);
    res.json({ success: true, message: `镜像 ${imageName} 拉取成功` });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /sync — 同步镜像数据
router.post('/sync', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const allImages = await dockerService.listImages();
    res.json({ success: true, message: '镜像数据同步完成', data: allImages });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /prune — 批量清理未使用镜像
router.post('/prune', requireRole('admin', 'operator'), async (_req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const result = await (docker as any).pruneImages({ filters: { dangling: { 'true': true } } });
    res.json({
      success: true,
      data: {
        imagesDeleted: result.ImagesDeleted || [],
        spaceReclaimed: result.SpaceReclaimed || 0,
      },
    });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /:id — 镜像详情
router.get('/:id', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const image = await dockerService.getImageInfo(req.params.id);
    res.json({ success: true, data: image });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 404;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /:id — 删除镜像
router.delete('/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    await dockerService.removeImage(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
