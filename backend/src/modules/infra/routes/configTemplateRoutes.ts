import type { Request, Response } from 'express';
import { Router } from 'express';
import crypto from 'crypto';
import { requireRole } from '../../../middleware/auth';
import { configTemplatesRepo } from '../../../repositories';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// GET /
router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;
    const type = req.query.type as string || '';
    const target = req.query.target_type as string || '';
    const search = req.query.search as string || '';

    const { data, total } = configTemplatesRepo.list({
      type: type || undefined,
      target_type: target || undefined,
      search: search || undefined,
      pageSize,
      offset,
    });
    res.json({ success: true, data, total });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// GET /:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const item = configTemplatesRepo.getById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: '未找到' });
    res.json({ success: true, data: item });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, type, content, variables, target_type, tags, created_by } = req.body;
    const id = crypto.randomUUID();
    configTemplatesRepo.create({
      id,
      name: name || '',
      description: description || '',
      type: type || 'generic',
      content: content || '',
      variables: variables || [],
      target_type: target_type || 'server',
      tags: tags || [],
      created_by: created_by || '',
    });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// PUT /:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, description, type, content, variables, target_type, tags } = req.body;
    configTemplatesRepo.update(req.params.id, {
      name: name || '',
      description: description || '',
      type: type || 'generic',
      content: content || '',
      variables: variables || [],
      target_type: target_type || 'server',
      tags: tags || [],
    });
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// DELETE /:id
router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    configTemplatesRepo.delete(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /:id/render — 渲染模板
router.post('/:id/render', (req: Request, res: Response) => {
  try {
    const tmpl = configTemplatesRepo.getById(req.params.id);
    if (!tmpl) return res.status(404).json({ success: false, message: '未找到' });

    const variables = req.body.variables || {};
    let rendered = tmpl.content;
    const tmplVars = JSON.parse(tmpl.variables || '[]') as string[];
    for (const v of tmplVars) {
      rendered = rendered.replace(new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`, 'g'), variables[v] || '');
    }
    res.json({ success: true, data: { rendered } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// POST /:id/apply — 应用到目标
router.post('/:id/apply', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const targetIds = req.body.target_ids || [];
    const result = configTemplatesRepo.apply(req.params.id, targetIds);
    if (!result) return res.status(404).json({ success: false, message: '未找到' });

    res.json({ success: true, data: { taskId: result.taskId, targetIds: result.targetIds } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
