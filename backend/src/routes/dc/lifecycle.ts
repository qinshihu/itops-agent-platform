import type { Request, Response } from 'express';
import { Router } from 'express';
import { dcRepository } from '../../repositories';
import { getErrorMessage } from '../../utils/errorHelpers';

const router = Router();

// GET /lifecycle — 生命周期记录
router.get('/', (req: Request, res: Response) => {
  try {
    const action = req.query.action as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const records = dcRepository.devices.listLifecycleFiltered({ action, limit });
    res.json({ success: true, data: records });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
