import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM scripts WHERE 1=1';
    const params: unknown[] = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    const scripts = db.prepare(query).all(...params) as Array<{ parameters?: string; [key: string]: unknown }>;
    const processedScripts = scripts.map(script => ({
      ...script,
      parameters: script.parameters ? JSON.parse(script.parameters) : []
    }));

    res.json({ success: true, data: processedScripts });
  } catch (error) {
    logger.error('Error fetching scripts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scripts' });
  }
});

router.get('/categories', (_req: Request, res: Response) => {
  try {
    const categories = db.prepare('SELECT DISTINCT category FROM scripts WHERE category IS NOT NULL').all() as Array<Record<string, unknown>>;
    res.json({ success: true, data: categories.map(c => c.category) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(req.params.id) as { parameters?: string; [key: string]: unknown };
    if (!script) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }
    const processedScript = {
      ...script,
      parameters: script.parameters ? JSON.parse(script.parameters) : []
    };
    res.json({ success: true, data: processedScript });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch script' });
  }
});

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, description, type, content, parameters, category } = req.body;
    const id = randomUUID();

    db.prepare(`
      INSERT INTO scripts (id, name, description, type, content, parameters, category, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      id,
      name,
      description,
      type,
      content,
      parameters ? JSON.stringify(parameters) : null,
      category
    );

    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id) as { parameters?: string; [key: string]: unknown };
    const processedScript = {
      ...script,
      parameters: script?.parameters ? JSON.parse(script.parameters) : []
    };

    res.status(201).json({ success: true, data: processedScript });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create script' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, description, type, content, parameters, category } = req.body;

    db.prepare(`
      UPDATE scripts
      SET name = ?, description = ?, type = ?, content = ?,
          parameters = ?, category = ?, version = version + 1, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      name,
      description,
      type,
      content,
      parameters ? JSON.stringify(parameters) : null,
      category,
      req.params.id
    );

    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(req.params.id) as { parameters?: string; [key: string]: unknown };
    const processedScript = {
      ...script,
      parameters: script?.parameters ? JSON.parse(script.parameters) : []
    };

    res.json({ success: true, data: processedScript });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update script' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(req.params.id);
    if (!script) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }

    db.prepare('DELETE FROM scripts WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Script deleted successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete script' });
  }
});

export default router;
