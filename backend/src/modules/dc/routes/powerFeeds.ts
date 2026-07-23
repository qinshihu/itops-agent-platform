import type { Request, Response } from 'express';
import { dcCrudService } from '../services/dcCrudService';
import { Router } from 'express';
import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHelpers';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /power-feeds — 获取全部供电线路
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const panelId = req.query.power_panel_id as string | undefined;
    const list = dcCrudService.power.listFeeds({ panelId });
    res.json({ success: true, data: list });
  } catch (error: unknown) {
    logger.error('Failed to operate dc powerFeeds', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
    }
  });

/**
 * GET /power-feeds/rack/:rackId — 获取指定机柜的所有供电线路（用于功耗计算）
 */
router.get('/rack/:rackId', (req: Request, res: Response) => {
  try {
    const feeds = dcCrudService.power.listFeedsByRack(req.params.rackId);
    res.json({ success: true, data: feeds });
  } catch (error: unknown) {
    logger.error('Failed to operate dc powerFeeds', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * GET /power-feeds/:id — 单条供电线路详情
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const feed = dcCrudService.power.getFeedById(req.params.id);
    if (!feed) return res.status(404).json({ success: false, message: 'Power feed not found' });
    res.json({ success: true, data: feed });
  } catch (error: unknown) {
    logger.error('Failed to operate dc powerFeeds', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * POST /power-feeds — 创建供电线路
 */
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { power_panel_id, rack_id, name, status, feed_type, supply, voltage, amperage, max_utilization_pct, current_load_w, description } = req.body;
    if (!power_panel_id || !name) return res.status(400).json({ success: false, message: 'power_panel_id and name required' });
    const id = crypto.randomUUID();
    dcCrudService.power.createFeed({
      id, power_panel_id, rack_id, name, status, feed_type, supply,
      voltage, amperage, max_utilization_pct, current_load_w, description,
    });
    res.json({ success: true, data: { id } });
  } catch (error: unknown) {
    logger.error('Failed to operate dc powerFeeds', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * PUT /power-feeds/:id — 更新供电线路
 */
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { rack_id, name, status, feed_type, supply, voltage, amperage, max_utilization_pct, current_load_w, description } = req.body;
    dcCrudService.power.updateFeed(req.params.id, {
      rack_id, name, status, feed_type, supply, voltage, amperage,
      max_utilization_pct, current_load_w, description,
    });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc powerFeeds', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

/**
 * DELETE /power-feeds/:id — 删除供电线路
 */
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    dcCrudService.power.deleteFeed(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to operate dc powerFeeds', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
