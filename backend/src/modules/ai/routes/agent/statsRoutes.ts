/**
 * Agent 统计 / 测试输入 routes（2026-07-21 拆分）
 *
 * 从原 agentRoutes.ts L40-65 + L279-312 抽出：
 * - GET /stats/summary        (汇总统计)
 * - GET /:id/test-input       (推荐测试输入)
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { validateParams } from '../../../../middleware/validation';
import { agentSchemas } from '../../../../shared/schemas/apiValidation';
import { agentCrudService } from '../../services/agentCrudService';
import { PRESET_TEST_INPUTS } from './presetTestInputs';

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

router.get(
  '/:id/test-input',
  validateParams(agentSchemas.agentId),
  (req: Request, res: Response) => {
    try {
      const agent = agentCrudService.getAgentNameRoleCategory(req.params.id);
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }

      const agentName = agent.name;
      let testInput = PRESET_TEST_INPUTS[agentName];

      // 如果没有预设的测试输入，生成一个通用的
      if (!testInput) {
        const role = agent.role || '运维助手';
        testInput = `你好，我是${role}，请帮我处理一个运维相关的问题`;
      }

      res.json({
        success: true,
        data: {
          testInput,
          agentName,
        },
      });
    } catch (error) {
      logger.error('Failed to get test input:', error);
      res
        .status(500)
        .json({ success: false, error: (error as Error).message || 'Failed to get test input' });
    }
  },
);

export default router;
