/**
 * Agent 统计 routes（2026-07-21 拆分，2026-07-23 清理死路由）
 *
 * 仅保留 GET /stats/summary（前端 Agents.tsx 调用）；
 * GET /:id/test-input 已删除（前端无消费者）。
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { agentCrudService } from '../../services/agentCrudService';

const router = Router();

router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const totalAgents = agentCrudService.countAllAgents();
    const enabledAgents = agentCrudService.countEnabledAgents();
    const presetAgents = agentCrudService.countPresetAgents();
    const totalExecutions = agentCrudService.countAllExecutions();
    const categoryStats = agentCrudService.countAgentsByCategory();

    res.json({
      success: true,
      data: {
        totalAgents,
        enabledAgents,
        presetAgents,
        totalExecutions,
        categoryStats,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch agent stats:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to fetch agent stats',
    });
  }
});

export default router;
