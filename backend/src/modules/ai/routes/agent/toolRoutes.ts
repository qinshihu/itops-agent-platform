/**
 * Agent 工具管理 routes（2026-07-21 拆分）
 *
 * 从原 agentRoutes.ts L458-571 抽出：
 * - GET  /tools/list           (工具列表)
 * - POST /tools/test           (工具测试执行 + P0-2 审计日志)
 * - GET  /tools/descriptions   (LLM 友好描述)
 *
 * P0-1 (v2 2026-07-21)：tools/test 增加 requireRole('admin', 'operator') 鉴权
 * P0-2 (v2 2026-07-21)：危险工具执行后写 audit_logs（auditEnabled=true）
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../../utils/logger';
import { requireRole } from '../../../../middleware/auth';
import { validateBody } from '../../../../middleware/validation';
import { agentSchemas } from '../../../../shared/schemas/apiValidation';
import { agentToolRegistry } from '../../services/agents/agentToolRegistry';
import { createAuditLog } from '../../../audit/services/auditService';

const router = Router();

// GET /tools/list
router.get('/tools/list', (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    let tools;

    if (category) {
      tools = agentToolRegistry.listToolsByCategory(category as never);
    } else {
      tools = agentToolRegistry.listTools();
    }

    // 简化工具信息，避免暴露内部实现（P1-7 v2 2026-07-21 新增 riskLevel 字段）
    const simplifiedTools = tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      riskLevel: tool.riskLevel,
      schema: tool.schema,
    }));

    res.json({
      success: true,
      data: simplifiedTools,
    });
  } catch (error) {
    logger.error('Failed to get tools:', error);
    res
      .status(500)
      .json({ success: false, error: (error as Error).message || 'Failed to get tools' });
  }
});

// POST /tools/test
router.post(
  '/tools/test',
  requireRole('admin', 'operator'),
  validateBody(agentSchemas.testTool),
  async (req: Request, res: Response) => {
    try {
      const { toolId, args } = req.body;

      if (!toolId) {
        return res.status(400).json({ success: false, error: 'Tool ID is required' });
      }

      const tool = agentToolRegistry.getTool(toolId);
      if (!tool) {
        return res.status(404).json({ success: false, error: `Tool ${toolId} not found` });
      }

      // 执行工具
      const result = await tool.execute(args || {});

      // P0-2：写审计日志（仅 auditEnabled=true 的工具）
      if (tool.auditEnabled) {
        const user = (req as Request & { user?: { id?: string; username?: string } }).user;
        const userId = user?.id;
        const username = user?.username;
        createAuditLog({
          user_id: userId,
          action: 'agent_tool_executed',
          resource_type: 'agent_tool',
          resource_id: toolId,
          details: {
            toolId,
            toolName: tool.name,
            category: tool.category,
            riskLevel: tool.riskLevel,
            username: username ?? 'unknown',
            args: JSON.stringify(args || {}).slice(0, 2000),
            resultPreview: String(result).slice(0, 1000),
          },
          ip_address: req.ip,
        });
      }

      res.json({
        success: true,
        data: {
          toolId,
          args,
          result,
        },
      });
    } catch (error) {
      logger.error('Failed to execute tool:', error);
      res
        .status(500)
        .json({ success: false, error: (error as Error).message || 'Failed to execute tool' });
    }
  },
);

// GET /tools/descriptions
router.get('/tools/descriptions', (_req: Request, res: Response) => {
  try {
    const descriptions = agentToolRegistry.generateToolDescriptions();
    res.json({
      success: true,
      data: {
        description: descriptions,
      },
    });
  } catch (error) {
    logger.error('Failed to get tool descriptions:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get tool descriptions',
    });
  }
});

export default router;
