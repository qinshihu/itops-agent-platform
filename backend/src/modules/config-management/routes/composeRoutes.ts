import type { Request, Response } from 'express';
import { Router } from 'express';
import { composeService } from '../services/composeService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// GET / — 列出所有项目（支持分页和搜索）
router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = (req.query.search as string || '').toLowerCase();

    let projects = composeService.listProjects();
    if (search) {
      projects = projects.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.description || '').toLowerCase().includes(search)
      );
    }
    const total = projects.length;
    const data = projects.slice((page - 1) * pageSize, page * pageSize);
    res.json({ success: true, data, total });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /:id — 获取项目详情
router.get('/:id', (req: Request, res: Response) => {
  try {
    const project = composeService.getProject(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' });
    res.json({ success: true, data: project });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST / — 创建项目
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, composeContent, description, tags } = req.body;
    if (!name || !composeContent) return res.status(400).json({ success: false, message: '名称和compose内容必填' });
    const project = composeService.createProject(name, composeContent, description, tags);
    res.json({ success: true, data: project });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// PUT /:id — 更新项目
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const project = composeService.updateProject(req.params.id, req.body);
    res.json({ success: true, data: project });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// DELETE /:id — 删除项目
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await composeService.deleteProject(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /:id/up — 启动项目
router.post('/:id/up', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const output = await composeService.upProject(req.params.id);
    res.json({ success: true, data: { output } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /:id/down — 停止项目
router.post('/:id/down', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const output = await composeService.downProject(req.params.id);
    res.json({ success: true, data: { output } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /:id/restart — 重启项目
router.post('/:id/restart', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const output = await composeService.restartProject(req.params.id);
    res.json({ success: true, data: { output } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /:id/services — 获取服务列表
router.get('/:id/services', async (req: Request, res: Response) => {
  try {
    const services = await composeService.listServices(req.params.id);
    res.json({ success: true, data: services });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /:id/logs — 获取日志
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const logs = await composeService.getLogs(req.params.id, tail);
    res.json({ success: true, data: { logs } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /validate — 验证 docker-compose 语法
router.post('/validate', (req: Request, res: Response) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ success: false, message: '需要compose内容' });
  composeService.validate(content).then(result => {
    res.json({ success: true, data: result });
  }).catch(err => {
    res.status(500).json({ success: false, message: err.message });
  });
});

export default router;
