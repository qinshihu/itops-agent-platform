import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import { scriptsRepo } from '../../../repositories';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const scripts = scriptsRepo.list({
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
    const categories = scriptsRepo.listCategories();
    res.json({ success: true, data: categories });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const script = scriptsRepo.getById(req.params.id);
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
    const { name, description, type, content, parameters, category } = req.body;
    const id = randomUUID();

    scriptsRepo.create({ id, name, description, type, content, parameters, category });

    const script = scriptsRepo.getById(id);
    res.status(201).json({ success: true, data: script });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create script' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, description, type, content, parameters, category } = req.body;

    scriptsRepo.update(req.params.id, { name, description, type, content, parameters, category });

    const script = scriptsRepo.getById(req.params.id);
    res.json({ success: true, data: script });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update script' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const script = scriptsRepo.getById(req.params.id);
    if (!script) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }

    scriptsRepo.delete(req.params.id);
    res.json({ success: true, message: 'Script deleted successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete script' });
  }
});

export default router;
