import type { Request, Response } from 'express';
import { Router } from 'express';
import { registryService } from '../services/registryService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// GET / — 列出所有仓库
router.get('/', (_req: Request, res: Response) => {
  try {
    const registries = registryService.listRegistries();
    res.json({ success: true, data: registries });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /:id — 获取仓库详情
router.get('/:id', (req: Request, res: Response) => {
  try {
    const registry = registryService.getRegistry(req.params.id);
    if (!registry) return res.status(404).json({ success: false, message: '仓库不存在' });
    res.json({ success: true, data: registry });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST / — 添加仓库
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, type, url, username, password } = req.body;
    if (!name || !type || !url) return res.status(400).json({ success: false, message: '名称、类型、地址必填' });
    const registry = await registryService.addRegistry({ name, type, url, username, password });
    res.json({ success: true, data: registry });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// PUT /:id — 更新仓库
router.put('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, type, url, username, password } = req.body;
    const updated = await registryService.updateRegistry(req.params.id, { name, type, url, username, password });
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// DELETE /:id — 删除仓库
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await registryService.deleteRegistry(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /:id/test — 测试连接
router.post('/:id/test', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const result = await registryService.testConnection(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /:id/images — 列出镜像
router.get('/:id/images', async (req: Request, res: Response) => {
  try {
    const project = req.query.project as string;
    const images = await registryService.listImages(req.params.id, project);
    res.json({ success: true, data: images });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

export default router;
