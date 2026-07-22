/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { dockerService } from '../services/dockerService';
import { multiHostDockerService } from '../services/multiHostDockerService';
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

function getDocker(req: Request): Docker {
  const endpointId = req.query.endpointId as string | undefined;
  if (endpointId) {
    try {
      return multiHostDockerService.getDockerClient(endpointId);
    } catch {
      throw Object.assign(new Error('指定的 Docker 端点不可用'), { statusCode: 503 });
    }
  }
  return docker;
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
    const { imageName, endpointId } = req.body;
    if (!imageName) {
      return res.status(400).json({ success: false, message: '缺少镜像名称' });
    }

    // 多主机：endpointId 指定时走目标主机；不指定时走默认本地 socket
    if (endpointId) {
      const d = multiHostDockerService.getDockerClient(endpointId);
      await new Promise<void>((resolve, reject) => {
        d.pull(imageName, {}, (err: Error | null) => err ? reject(err) : resolve());
      });
    } else {
      await dockerService.pullImage(imageName);
    }
    res.json({ success: true, message: `镜像 ${imageName} 拉取成功` });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /sync — 同步镜像数据
// 接受 serverId/endpointId，明确目标主机
router.post('/sync', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const { serverId, endpointId } = req.body as { serverId?: string; endpointId?: string };
    const targetEndpoint = endpointId || serverId;

    if (targetEndpoint) {
      // 多主机：拉取目标主机的镜像列表
      const d = multiHostDockerService.getDockerClient(targetEndpoint);
      const imgs = await d.listImages();
      // 简单映射到标准结构
      const mapped = imgs.map((img: any) => ({
        id: img.Id,
        tags: img.RepoTags || [],
        repository: img.RepoTags?.[0]?.split(':')[0] || '<none>',
        tag: img.RepoTags?.[0]?.split(':')[1] || '<none>',
        size: img.Size,
        created: img.Created,
        virtualSize: img.VirtualSize,
        labels: img.Labels,
      }));
      res.json({
        success: true,
        message: `同步完成（目标端点: ${targetEndpoint}）`,
        data: mapped,
        endpointId: targetEndpoint,
      });
    } else {
      const allImages = await dockerService.listImages();
      res.json({ success: true, message: '镜像数据同步完成', data: allImages });
    }
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /prune — 批量清理未使用镜像
router.post('/prune', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const d = getDocker(req);
    const result = await (d as any).pruneImages({ filters: { dangling: { 'true': true } } });
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
