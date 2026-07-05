import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { knowledgeRepository } from '../../../repositories';
import { authenticateToken } from '../../../middleware/auth';

const router = Router();

router.use(authenticateToken);

// 解析 tags/solutions/related_alerts（JSON 字符串 → 对象）
function parseKnowledgeJson<T extends { tags?: string | null; solutions?: string | null; related_alerts?: string | null }>(k: T): T {
  const result = { ...k };
  if (result.tags) (result as { tags: unknown }).tags = JSON.parse(result.tags);
  if (result.solutions) (result as { solutions: unknown }).solutions = JSON.parse(result.solutions);
  if (result.related_alerts) (result as { related_alerts: unknown }).related_alerts = JSON.parse(result.related_alerts);
  return result;
}

router.get('/', (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const knowledge = knowledgeRepository.list({
      category: category as string | undefined,
      search: search as string | undefined,
    });
    const parsed = knowledge.map(parseKnowledgeJson);
    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { title, category, tags, content, solutions, related_alerts } = req.body;
    const id = randomUUID();

    knowledgeRepository.createFromRest({
      id,
      title,
      category,
      tags: JSON.stringify(tags || []),
      content,
      solutions: JSON.stringify(solutions || []),
      related_alerts: JSON.stringify(related_alerts || []),
    });

    const knowledge = knowledgeRepository.getById(id);
    res.status(201).json({ success: true, data: knowledge });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { title, category, tags, content, solutions, related_alerts } = req.body;

    knowledgeRepository.updateFromRest(req.params.id, {
      title,
      category,
      tags: JSON.stringify(tags || []),
      content,
      solutions: JSON.stringify(solutions || []),
      related_alerts: JSON.stringify(related_alerts || []),
    });

    const knowledge = knowledgeRepository.getById(req.params.id);
    res.json({ success: true, data: knowledge });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    knowledgeRepository.delete(req.params.id);
    res.json({ success: true, message: 'Knowledge entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/search', (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const knowledge = knowledgeRepository.search(q as string);
    const parsed = knowledge.map(parseKnowledgeJson);

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
