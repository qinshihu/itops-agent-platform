import type { Request, Response } from 'express';
import { Router } from 'express';
import { costAnalysisService } from '../services/costAnalysisService';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

router.get('/containers', async (_req: Request, res: Response) => {
  try {
    const data = await costAnalysisService.getContainerCosts();
    // 把兄弟字段嵌入 data 内（避免被前端 axios 拦截器剥掉）
    res.json({ success: true, data: { items: data.data, totalMonthly: data.totalMonthly } });
  } catch (err: unknown) { res.status(500).json({ success: false, message: getErrorMessage(err) }); }
});

router.get('/vms', async (_req: Request, res: Response) => {
  try {
    const data = await costAnalysisService.getVMCosts();
    res.json({ success: true, data: { items: data.data, totalMonthly: data.totalMonthly } });
  } catch (err: unknown) { res.status(500).json({ success: false, message: getErrorMessage(err) }); }
});

router.get('/recommendations', (_req: Request, res: Response) => {
  try {
    const result = costAnalysisService.getRecommendations();
    res.json({ success: true, data: { items: result.data, totalSaving: result.totalSaving } });
  } catch (err: unknown) { res.status(500).json({ success: false, message: getErrorMessage(err) }); }
});

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const data = await costAnalysisService.getSummary();
    res.json({ success: true, data });
  } catch (err: unknown) { res.status(500).json({ success: false, message: getErrorMessage(err) }); }
});

export default router;
