/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { configTemplateCrudService } from '../services/configTemplateCrudService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const type = (req.query.type as string) || '';
    const target = (req.query.target_type as string) || '';
    const search = (req.query.search as string) || '';

    const { data, total } = configTemplateCrudService.listTemplates({
      page,
      pageSize,
      filters: {
        type: type || undefined,
        target_type: target || undefined,
        search: search || undefined,
      },
    });
    // 把 total 嵌入 data 内（避免被前端 axios 拦截器剥掉兄弟字段）
    res.json({ success: true, data: { items: data, total } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const item = configTemplateCrudService.getTemplateById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: '未找到' });
    res.json({ success: true, data: item });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, type, content, variables, target_type, tags, created_by } = req.body;
    const id = randomUUID();
    configTemplateCrudService.createTemplate({
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

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, description, type, content, variables, target_type, tags } = req.body;
    configTemplateCrudService.updateTemplate(req.params.id, {
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

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    configTemplateCrudService.deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

router.post(
  '/:id/render',
  requireRole('admin', 'operator', 'viewer'),
  (req: Request, res: Response) => {
    try {
      const tmpl: any = configTemplateCrudService.getTemplateById(req.params.id);
      if (!tmpl) return res.status(404).json({ success: false, message: '未找到' });

      const variables = req.body.variables || {};
      let rendered = tmpl.content;
      const tmplVars = JSON.parse(tmpl.variables || '[]') as string[];
      for (const v of tmplVars) {
        rendered = rendered.replace(
          new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`, 'g'),
          variables[v] || '',
        );
      }
      res.json({ success: true, data: { rendered } });
    } catch (error: unknown) {
      res.status(500).json({ success: false, message: getErrorMessage(error) });
    }
  },
);

router.post('/:id/apply', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const targetIds = req.body.target_ids || [];
    const result = configTemplateCrudService.applyTemplate(req.params.id, targetIds);
    if (!result) return res.status(404).json({ success: false, message: '未找到' });
    res.json({
      success: true,
      data: { taskId: (result as any).taskId, targetIds: (result as any).targetIds },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
