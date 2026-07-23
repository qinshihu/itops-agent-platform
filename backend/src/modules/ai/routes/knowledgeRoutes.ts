/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authenticateToken, requireRole } from '../../../middleware/auth';
import { knowledgeCrudService } from '../services/knowledgeCrudService';
import { logger } from '../../../utils/logger';

const router = Router();

router.use(authenticateToken);

// 解析 tags/solutions/related_alerts（JSON 字符串 → 对象），单条损坏时不影响整体
function parseKnowledgeJson<
  T extends { tags?: string | null; solutions?: string | null; related_alerts?: string | null },
>(k: T): T {
  const result = { ...k };
  for (const key of ['tags', 'solutions', 'related_alerts'] as const) {
    const val = result[key];
    if (typeof val === 'string' && val.length > 0) {
      try {
        (result as Record<string, unknown>)[key] = JSON.parse(val);
      } catch (err) {
        logger.warn(
          `Failed to parse knowledge.${key} JSON (id=${(result as { id?: string }).id ?? '?'}):`,
          err,
        );
        (result as Record<string, unknown>)[key] = [];
      }
    }
  }
  return result;
}

router.get('/', (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const knowledge = knowledgeCrudService.listKnowledge({
      category: category as string | undefined,
      search: search as string | undefined,
    });
    const parsed = knowledge.map(parseKnowledgeJson);
    res.json({ success: true, data: parsed });
  } catch (error: unknown) {
    logger.error('GET /knowledge failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch knowledge';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { title, category, tags, content, solutions, related_alerts } = req.body;
    const id = randomUUID();

    knowledgeCrudService.createKnowledge({
      id,
      title,
      category,
      tags: JSON.stringify(tags || []),
      content,
      solutions: JSON.stringify(solutions || []),
      related_alerts: JSON.stringify(related_alerts || []),
    });

    const knowledge = knowledgeCrudService.getKnowledgeById(id);
    res.status(201).json({ success: true, data: knowledge });
  } catch (error: unknown) {
    logger.error('POST /knowledge failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to create knowledge';
    res.status(500).json({ success: false, error: message });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { title, category, tags, content, solutions, related_alerts } = req.body;

    knowledgeCrudService.updateKnowledge(req.params.id, {
      title,
      category,
      tags: JSON.stringify(tags || []),
      content,
      solutions: JSON.stringify(solutions || []),
      related_alerts: JSON.stringify(related_alerts || []),
    });

    const knowledge = knowledgeCrudService.getKnowledgeById(req.params.id);
    res.json({ success: true, data: knowledge });
  } catch (error: unknown) {
    logger.error('PUT /knowledge/:id failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to update knowledge';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    knowledgeCrudService.deleteKnowledge(req.params.id);
    res.json({ success: true, message: 'Knowledge entry deleted' });
  } catch (error: unknown) {
    logger.error('DELETE /knowledge/:id failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete knowledge';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/search', (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const knowledge = knowledgeCrudService.searchKnowledge(q as string);
    const parsed = knowledge.map(parseKnowledgeJson);

    res.json({ success: true, data: parsed });
  } catch (error: unknown) {
    logger.error('GET /knowledge/search failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to search knowledge';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
