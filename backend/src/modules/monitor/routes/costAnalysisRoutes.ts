import type { Request, Response } from 'express';
import { Router } from 'express';
import { costAnalysisService } from '../services/costAnalysisService';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

router.get('/containers', async (_req: Request, res: Response) => {
  try {
    const data = await costAnalysisService.getContainerCosts();
    res.json({ success: true, data: data.data, totalMonthly: data.totalMonthly });
  } catch (err: unknown) { res.status(500).json({ success: false, message: getErrorMessage(err) }); }
});

router.get('/vms', async (_req: Request, res: Response) => {
  try {
    const data = await costAnalysisService.getVMCosts();
    res.json({ success: true, data: data.data, totalMonthly: data.totalMonthly });
  } catch (err: unknown) { res.status(500).json({ success: false, message: getErrorMessage(err) }); }
});

router.get('/recommendations', (_req: Request, res: Response) => {
  try {
    const result = costAnalysisService.getRecommendations();
    res.json({ success: true, data: result.data, totalSaving: result.totalSaving });
  } catch (err: unknown) { res.status(500).json({ success: false, message: getErrorMessage(err) }); }
});

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const data = await costAnalysisService.getSummary();
    res.json({ success: true, data });
  } catch (err: unknown) { res.status(500).json({ success: false, message: getErrorMessage(err) }); }
});

export default router;
