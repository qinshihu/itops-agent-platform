import type { Request, Response } from 'express';
import { Router } from 'express';
import crypto from 'crypto';
import { dcRepository } from '../../repositories';
import { getErrorMessage } from '../../utils/errorHelpers';

const router = Router();

/**
 * GET /power-panels — 获取全部配电柜（含关联机房名称）
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const list = dcRepository.power.listPanels();
    res.json({ success: true, data: list });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * GET /power-panels/:id — 单个配电柜详情（含供电线路）
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const panel = dcRepository.power.getPanelById(req.params.id);
    if (!panel) return res.status(404).json({ success: false, message: 'Power panel not found' });

    const feeds = dcRepository.power.listFeedsByPanel(req.params.id);
    res.json({ success: true, data: { ...panel, feeds } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * POST /power-panels — 创建配电柜
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { room_id, name, location_label, panel_type, voltage, amperage, phase_count, description, sort_order } = req.body;
    if (!room_id || !name) return res.status(400).json({ success: false, message: 'room_id and name required' });
    const id = crypto.randomUUID();
    dcRepository.power.createPanel({
      id, room_id, name, location_label, panel_type, voltage, amperage, phase_count, description, sort_order,
    });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * PUT /power-panels/:id — 更新配电柜
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, location_label, panel_type, voltage, amperage, phase_count, description, sort_order } = req.body;
    dcRepository.power.updatePanel(req.params.id, {
      name, location_label, panel_type, voltage, amperage, phase_count, description, sort_order,
    });
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * DELETE /power-panels/:id — 删除配电柜（有关联馈线时禁止）
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const cnt = dcRepository.power.countFeedsByPanel(req.params.id);
    if (cnt > 0) {
      return res.status(409).json({ success: false, message: `Cannot delete: ${cnt} power feed(s) still reference this panel` });
    }
    dcRepository.power.deletePanel(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
