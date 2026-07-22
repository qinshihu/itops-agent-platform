/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import { scriptCrudService } from '../services/scriptCrudService';

// 脚本 id 是 UUID。若 `/:id` 段的 id 不是合法 UUID（例如 `/settings`、`/users`），
// 必须穿透到下一个路由（notFoundHandler），不能误吞。scriptsRoutes 挂在 `/api/v1`
// 前缀下，其 `/:id` 是合法的通配，因此显式判断 UUID 格式后决定 next() 还是 handle。
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function onlyUuidId(req: { params: { id?: string } }, _res: unknown, next: (err?: unknown) => void): void {
  if (!req.params.id || !UUID_RE.test(req.params.id)) return next('route');
  return next();
}

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const scripts = scriptCrudService.listScripts({
      category: category as string | undefined,
      search: search as string | undefined,
    });
    res.json({ success: true, data: scripts });
  } catch (error) {
    logger.error('Error fetching scripts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scripts' });
  }
});

router.get('/categories', (_req: Request, res: Response) => {
  try {
    const categories = scriptCrudService.listScriptCategories();
    res.json({ success: true, data: categories });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

router.get('/:id', onlyUuidId, (req: Request, res: Response) => {
  try {
    const script = scriptCrudService.getScriptById(req.params.id);
    if (!script) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }
    res.json({ success: true, data: script });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch script' });
  }
});

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const script = scriptCrudService.createScript(req.body);
    res.status(201).json({ success: true, data: script });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create script' });
  }
});

router.put('/:id', onlyUuidId, requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const script = scriptCrudService.updateScript(req.params.id, req.body);
    res.json({ success: true, data: script });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update script' });
  }
});

router.delete('/:id', onlyUuidId, requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const result = scriptCrudService.deleteScript(req.params.id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }
    res.json({ success: true, message: 'Script deleted successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete script' });
  }
});

export default router;
