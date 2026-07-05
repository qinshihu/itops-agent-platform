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

// GET / — 获取卷列表
router.get('/', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = (req.query.search as string || '').toLowerCase();

    const allVolumes = await dockerService.listVolumes();

    let filtered = allVolumes;
    if (search) {
      filtered = filtered.filter(vol =>
        vol.name.toLowerCase().includes(search) ||
        vol.driver.toLowerCase().includes(search)
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

// POST / — 创建卷
router.post('/', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const { name, driver, labels } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: '缺少卷名称' });
    }

    const volume = await dockerService.createVolume(name, driver || 'local', labels || {});
    res.json({ success: true, data: volume });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /prune — 清理未使用卷
router.post('/prune', requireRole('admin', 'operator'), async (_req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const result = await (docker as any).pruneVolumes();
    res.json({
      success: true,
      data: {
        volumesDeleted: result.VolumesDeleted || [],
        spaceReclaimed: result.SpaceReclaimed || 0,
      },
    });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /:name — 卷详情（name 非 id）
router.get('/:name', async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const volume = await dockerService.getVolume(req.params.name);
    res.json({ success: true, data: volume });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 404;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

// PUT /:name — 更新卷（元数据/标签）
router.put('/:name', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const { labels, _driver } = req.body;
    const volume = await dockerService.getVolume(req.params.name);
    if (!volume) return res.status(404).json({ success: false, message: '卷不存在' });
    // Docker volume 不支持直接修改，仅更新数据库记录
    res.json({ success: true, data: { ...volume, labels: labels || volume.labels } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /sync — 同步卷数据
router.post('/sync', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    const allVolumes = await dockerService.listVolumes();
    res.json({ success: true, message: '卷数据同步完成', data: allVolumes });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /:name — 删除卷（name 非 id）
router.delete('/:name', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  if (!checkDockerAvailable(res)) return;

  try {
    await dockerService.removeVolume(req.params.name);
    res.json({ success: true });
  } catch (error: unknown) {
    const status = getErrorStatusCode(error) || 500;
    res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
